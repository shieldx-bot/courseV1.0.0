import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/progress", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const progress = await query<any>(
      c.env,
      "SELECT * FROM progress WHERE user_id = ?",
      [user.sub]
    );
    return c.json(
      apiResponse(
        true,
        progress.map((p) => ({
          id: p._id,
          ...Object.fromEntries(
            Object.entries(p).filter(([k]) => k !== "_id")
          ),
        })),
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/progress/:lesson_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const lessonId = c.req.param("lesson_id");
    const record = await queryOne<any>(
      c.env,
      "SELECT * FROM progress WHERE _id = ?",
      [`prog-${user.sub}-${lessonId}`]
    );
    if (!record) {
      return c.json(apiResponse(true, null, null, null), 200);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: record._id,
          ...Object.fromEntries(
            Object.entries(record).filter(([k]) => k !== "_id")
          ),
        },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.put("/progress/:lesson_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const lessonId = c.req.param("lesson_id");
    const body = await c.req.json<{ completed?: boolean; last_position_seconds?: number; note?: string }>();
    const { completed, last_position_seconds, note } = body;

    const courses = await query<any>(c.env, "SELECT * FROM courses");
    let course: any = null;
    for (const c of courses) {
      if (c.syllabus?.some((l: any) => l.id === lessonId)) {
        course = c;
        break;
      }
    }

    if (!course) {
      return c.json({ success: false, data: null, error: "Lesson not found", meta: null }, 404);
    }

    const progressId = `prog-${user.sub}-${lessonId}`;
    const existing = await queryOne<any>(c.env, "SELECT * FROM progress WHERE _id = ?", [progressId]);
    const now = new Date().toISOString();

    const updateFields: any = {
      user_id: user.sub,
      course_id: course._id,
      lesson_id: lessonId,
      completed: completed ?? existing?.completed ?? false,
      last_position_seconds: last_position_seconds ?? existing?.last_position_seconds ?? 0,
      updated_at: now,
    };
    if (note !== undefined) {
      updateFields.note = note;
    } else if (existing?.note) {
      updateFields.note = existing.note;
    }

    if (existing) {
      const setParts = Object.keys(updateFields)
        .map((k) => `${k} = ?`)
        .join(", ");
      const values = Object.values(updateFields);
      values.push(progressId);
      await execute(
        c.env,
        `UPDATE progress SET ${setParts} WHERE _id = ?`,
        values
      );
    } else {
      updateFields._id = progressId;
      updateFields.created_at = now;
      const columns = Object.keys(updateFields).join(", ");
      const placeholders = Object.keys(updateFields).map(() => "?").join(", ");
      const values = Object.values(updateFields);
      await execute(
        c.env,
        `INSERT INTO progress (${columns}) VALUES (${placeholders})`,
        values
      );
    }

    const record = await queryOne<any>(c.env, "SELECT * FROM progress WHERE _id = ?", [progressId]);

    if (completed) {
      const lessonIds = new Set(
        (course.syllabus || []).map((l: any) => l.id)
      );
      const completedCount = await queryOne<any>(
        c.env,
        `SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND lesson_id IN (${Array.from(lessonIds).map(() => "?").join(",")}) AND completed = 1`,
        [user.sub, ...Array.from(lessonIds)]
      );
      if (completedCount && completedCount.count >= lessonIds.size) {
        const certId = `cert-${user.sub}-${course._id}`;
        const existingCert = await queryOne<any>(
          c.env,
          "SELECT * FROM certificates WHERE _id = ?",
          [certId]
        );
        if (!existingCert) {
          const verificationCode = generateVerificationCode();
          await execute(
            c.env,
            "INSERT INTO certificates (_id, user_id, course_id, verification_code, issued_at) VALUES (?, ?, ?, ?, ?)",
            [certId, user.sub, course._id, verificationCode, now]
          );
        }
      }
    }

    return c.json(
      apiResponse(
        true,
        {
          id: record._id,
          ...Object.fromEntries(
            Object.entries(record).filter(([k]) => k !== "_id")
          ),
        },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/progress/summary", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const progressRecords = await query<any>(
      c.env,
      "SELECT * FROM progress WHERE user_id = ?",
      [user.sub]
    );
    const courses = await query<any>(c.env, "SELECT * FROM courses");

    const summary = courses.map((course) => {
      const lessonIds = new Set((course.syllabus || []).map((l: any) => l.id));
      const completed = new Set(
        progressRecords
          .filter((p) => p.lesson_id && lessonIds.has(p.lesson_id) && p.completed)
          .map((p) => p.lesson_id)
      );
      const total = lessonIds.size;
      return {
        course_id: course._id,
        course_title: course.title,
        course_slug: course.slug,
        completed_lessons: completed.size,
        total_lessons: total,
        progress_pct: total > 0 ? Math.round((completed.size / total) * 100) : 0,
      };
    });

    return c.json(apiResponse(true, summary, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/progress/continue", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }

    const incomplete = await query<any>(
      c.env,
      "SELECT * FROM progress WHERE user_id = ? AND completed = 0 ORDER BY updated_at DESC LIMIT 1",
      [user.sub]
    );

    if (!incomplete || incomplete.length === 0) {
      const course = await queryOne<any>(c.env, "SELECT * FROM courses LIMIT 1");
      if (!course) {
        return c.json(apiResponse(true, null, null, null), 200);
      }
      const firstLesson = (course.syllabus || [])[0];
      return c.json(
        apiResponse(
          true,
          {
            course_id: course._id,
            course_title: course.title,
            course_slug: course.slug,
            lesson_id: firstLesson?.id,
            lesson_title: firstLesson?.title,
            lesson_index: 0,
            lesson_count: (course.syllabus || []).length,
          },
          null,
          null
        ),
        200
      );
    }

    const p = incomplete[0];
    const course = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [p.course_id]);
    if (!course) {
      return c.json(apiResponse(true, null, null, null), 200);
    }

    const lessonIndex = (course.syllabus || []).findIndex(
      (l: any) => l.id === p.lesson_id
    );
    const lesson = (course.syllabus || [])[lessonIndex >= 0 ? lessonIndex : 0];

    return c.json(
      apiResponse(
        true,
        {
          course_id: course._id,
          course_title: course.title,
          course_slug: course.slug,
          lesson_id: p.lesson_id,
          lesson_title: lesson?.title,
          lesson_index: lessonIndex >= 0 ? lessonIndex : 0,
          lesson_count: (course.syllabus || []).length,
          last_position_seconds: p.last_position_seconds || 0,
        },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

function generateVerificationCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default app;
