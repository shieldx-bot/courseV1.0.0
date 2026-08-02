import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function getCourseIdForLesson(env: Env, lessonId: string): Promise<string | null> {
  return new Promise(async (resolve) => {
    const courses = await query<any>(env, "SELECT * FROM courses");
    for (const course of courses) {
      if (course.syllabus?.some((l: any) => l.id === lessonId)) {
        resolve(course._id);
        return;
      }
    }
    resolve(null);
  });
}

function getCourseForLesson(env: Env, lessonId: string): Promise<any> {
  return new Promise(async (resolve) => {
    const courses = await query<any>(env, "SELECT * FROM courses");
    for (const course of courses) {
      if (course.syllabus?.some((l: any) => l.id === lessonId)) {
        resolve(course);
        return;
      }
    }
    resolve(null);
  });
}

app.get("/courses/:course_id/lessons/:lesson_id/discussions", async (c) => {
  try {
    const courseId = c.req.param("course_id");
    const lessonId = c.req.param("lesson_id");
    const page = parseInt(c.req.query("page") || "1");
    const perPage = parseInt(c.req.query("per_page") || "20");
    const sort = c.req.query("sort") || "newest";
    const offset = (page - 1) * perPage;

    let orderBy = "created_at DESC";
    if (sort === "oldest") orderBy = "created_at ASC";
    if (sort === "votes") orderBy = "vote_score DESC";

    const discussions = await query<any>(
      c.env,
      `SELECT * FROM discussions WHERE lesson_id = ? ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [lessonId, perPage, offset]
    );

    return c.json(
      apiResponse(
        true,
        discussions.map((d) => ({
          id: d._id,
          ...Object.fromEntries(
            Object.entries(d).filter(([k]) => k !== "_id")
          ),
        })),
        null,
        { page, per_page: perPage, total: discussions.length }
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/courses/:course_id/lessons/:lesson_id/discussions", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const lessonId = c.req.param("lesson_id");
    const body = await c.req.json<{ content: string }>();
    const { content } = body;

    const course = await getCourseForLesson(c.env, lessonId);
    if (!course) {
      return c.json({ success: false, data: null, error: "Lesson not found", meta: null }, 404);
    }

    const discussionId = `discussion-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO discussions (_id, course_id, lesson_id, user_id, content, votes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [discussionId, course._id, lessonId, user.sub, content, 0, now, now]
    );

    return c.json(
      apiResponse(
        true,
        {
          id: discussionId,
          course_id: course._id,
          lesson_id: lessonId,
          user_id: user.sub,
          content,
          votes: 0,
          created_at: now,
          updated_at: now,
        },
        null,
        null
      ),
      201
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id", async (c) => {
  try {
    const discussionId = c.req.param("discussion_id");
    const discussion = await queryOne<any>(
      c.env,
      "SELECT * FROM discussions WHERE _id = ?",
      [discussionId]
    );
    if (!discussion) {
      return c.json({ success: false, data: null, error: "Discussion not found", meta: null }, 404);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: discussion._id,
          ...Object.fromEntries(
            Object.entries(discussion).filter(([k]) => k !== "_id")
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

app.put("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const discussionId = c.req.param("discussion_id");
    const body = await c.req.json<{ content: string }>();
    const { content } = body;

    const discussion = await queryOne<any>(
      c.env,
      "SELECT * FROM discussions WHERE _id = ?",
      [discussionId]
    );
    if (!discussion) {
      return c.json({ success: false, data: null, error: "Discussion not found", meta: null }, 404);
    }
    if (discussion.user_id !== user.sub && user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Not authorized to edit this discussion", meta: null }, 403);
    }

    const now = new Date().toISOString();
    await execute(
      c.env,
      "UPDATE discussions SET content = ?, updated_at = ? WHERE _id = ?",
      [content, now, discussionId]
    );

    return c.json(
      apiResponse(
        true,
        { id: discussionId, content, updated_at: now },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.delete("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const discussionId = c.req.param("discussion_id");

    const discussion = await queryOne<any>(
      c.env,
      "SELECT * FROM discussions WHERE _id = ?",
      [discussionId]
    );
    if (!discussion) {
      return c.json({ success: false, data: null, error: "Discussion not found", meta: null }, 404);
    }
    if (discussion.user_id !== user.sub && user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Not authorized to delete this discussion", meta: null }, 403);
    }

    await execute(c.env, "DELETE FROM discussions WHERE _id = ?", [discussionId]);
    await execute(c.env, "DELETE FROM discussion_replies WHERE discussion_id = ?", [discussionId]);
    await execute(c.env, "DELETE FROM discussion_votes WHERE discussion_id = ?", [discussionId]);
    await execute(c.env, "DELETE FROM reply_votes WHERE discussion_id = ?", [discussionId]);

    return c.json(apiResponse(true, { id: discussionId }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/vote", async (c) => {
  try {
    const user = c.get("user");
    const discussionId = c.req.param("discussion_id");
    const body = await c.req.json<{ vote: number }>();
    const { vote } = body;

    const discussion = await queryOne<any>(
      c.env,
      "SELECT * FROM discussions WHERE _id = ?",
      [discussionId]
    );
    if (!discussion) {
      return c.json({ success: false, data: null, error: "Discussion not found", meta: null }, 404);
    }

    let change = 0;
    if (user) {
      const existing = await queryOne<any>(
        c.env,
        "SELECT * FROM discussion_votes WHERE discussion_id = ? AND user_id = ?",
        [discussionId, user.sub]
      );

      if (vote === 0) {
        if (existing) {
          change = -existing.vote;
          await execute(c.env, "DELETE FROM discussion_votes WHERE _id = ?", [existing._id]);
        }
      } else {
        if (existing) {
          if (existing.vote === vote) {
            change = 0;
          } else {
            change = vote - existing.vote;
            await execute(
              c.env,
              "UPDATE discussion_votes SET vote = ? WHERE _id = ?",
              [vote, existing._id]
            );
          }
        } else {
          const voteId = `dv-${Date.now()}`;
          await execute(
            c.env,
            "INSERT INTO discussion_votes (_id, discussion_id, user_id, vote, created_at) VALUES (?, ?, ?, ?, ?)",
            [voteId, discussionId, user.sub, vote, new Date().toISOString()]
          );
          change = vote;
        }
      }
    }

    if (change !== 0) {
      await execute(
        c.env,
        "UPDATE discussions SET votes = votes + ? WHERE _id = ?",
        [change, discussionId]
      );
    }

    const updated = await queryOne<any>(
      c.env,
      "SELECT * FROM discussions WHERE _id = ?",
      [discussionId]
    );

    return c.json(
      apiResponse(
        true,
        {
          id: updated._id,
          ...Object.fromEntries(
            Object.entries(updated).filter(([k]) => k !== "_id")
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

app.get("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies", async (c) => {
  try {
    const discussionId = c.req.param("discussion_id");
    const page = parseInt(c.req.query("page") || "1");
    const perPage = parseInt(c.req.query("per_page") || "50");
    const offset = (page - 1) * perPage;

    const discussion = await queryOne<any>(
      c.env,
      "SELECT * FROM discussions WHERE _id = ?",
      [discussionId]
    );
    if (!discussion) {
      return c.json({ success: false, data: null, error: "Discussion not found", meta: null }, 404);
    }

    const replies = await query<any>(
      c.env,
      "SELECT * FROM discussion_replies WHERE discussion_id = ? AND parent_reply_id IS NULL ORDER BY created_at ASC LIMIT ? OFFSET ?",
      [discussionId, perPage, offset]
    );

    return c.json(
      apiResponse(
        true,
        replies.map((r) => ({
          id: r._id,
          ...Object.fromEntries(
            Object.entries(r).filter(([k]) => k !== "_id")
          ),
        })),
        null,
        { page, per_page: perPage, total: replies.length }
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const discussionId = c.req.param("discussion_id");
    const body = await c.req.json<{ content: string; parent_reply_id?: string }>();
    const { content, parent_reply_id } = body;

    const discussion = await queryOne<any>(
      c.env,
      "SELECT * FROM discussions WHERE _id = ?",
      [discussionId]
    );
    if (!discussion) {
      return c.json({ success: false, data: null, error: "Discussion not found", meta: null }, 404);
    }
    if (discussion.is_locked) {
      return c.json({ success: false, data: null, error: "This discussion is locked", meta: null }, 403);
    }

    const replyId = `reply-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO discussion_replies (_id, discussion_id, user_id, content, parent_reply_id, votes, is_instructor_answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [replyId, discussionId, user.sub, content, parent_reply_id || null, 0, user.role === "instructor" ? 1 : 0, now, now]
    );

    await execute(
      c.env,
      "UPDATE discussions SET reply_count = reply_count + 1 WHERE _id = ?",
      [discussionId]
    );

    return c.json(
      apiResponse(
        true,
        {
          id: replyId,
          discussion_id: discussionId,
          user_id: user.sub,
          content,
          parent_reply_id: parent_reply_id || null,
          votes: 0,
          is_instructor_answer: user.role === "instructor",
          created_at: now,
          updated_at: now,
        },
        null,
        null
      ),
      201
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.put("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies/:reply_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const replyId = c.req.param("reply_id");
    const body = await c.req.json<{ content: string }>();
    const { content } = body;

    const reply = await queryOne<any>(
      c.env,
      "SELECT * FROM discussion_replies WHERE _id = ?",
      [replyId]
    );
    if (!reply) {
      return c.json({ success: false, data: null, error: "Reply not found", meta: null }, 404);
    }
    if (reply.user_id !== user.sub && !["admin", "instructor"].includes(user.role)) {
      return c.json({ success: false, data: null, error: "Not authorized to edit this reply", meta: null }, 403);
    }

    const now = new Date().toISOString();
    await execute(
      c.env,
      "UPDATE discussion_replies SET content = ?, updated_at = ? WHERE _id = ?",
      [content, now, replyId]
    );

    return c.json(
      apiResponse(
        true,
        { id: replyId, content, updated_at: now },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.delete("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies/:reply_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const replyId = c.req.param("reply_id");

    const reply = await queryOne<any>(
      c.env,
      "SELECT * FROM discussion_replies WHERE _id = ?",
      [replyId]
    );
    if (!reply) {
      return c.json({ success: false, data: null, error: "Reply not found", meta: null }, 404);
    }
    if (reply.user_id !== user.sub && !["admin", "instructor"].includes(user.role)) {
      return c.json({ success: false, data: null, error: "Not authorized to delete this reply", meta: null }, 403);
    }

    await execute(c.env, "DELETE FROM discussion_replies WHERE _id = ?", [replyId]);
    await execute(c.env, "DELETE FROM discussion_replies WHERE parent_reply_id = ?", [replyId]);
    await execute(
      c.env,
      "UPDATE discussions SET reply_count = reply_count - 1 WHERE _id = ?",
      [reply.discussion_id]
    );

    return c.json(apiResponse(true, { id: replyId }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies/:reply_id/vote", async (c) => {
  try {
    const user = c.get("user");
    const replyId = c.req.param("reply_id");
    const body = await c.req.json<{ vote: number }>();
    const { vote } = body;

    const reply = await queryOne<any>(
      c.env,
      "SELECT * FROM discussion_replies WHERE _id = ?",
      [replyId]
    );
    if (!reply) {
      return c.json({ success: false, data: null, error: "Reply not found", meta: null }, 404);
    }

    let change = 0;
    if (user) {
      const existing = await queryOne<any>(
        c.env,
        "SELECT * FROM reply_votes WHERE reply_id = ? AND user_id = ?",
        [replyId, user.sub]
      );

      if (vote === 0) {
        if (existing) {
          change = -existing.vote;
          await execute(c.env, "DELETE FROM reply_votes WHERE _id = ?", [existing._id]);
        }
      } else {
        if (existing) {
          if (existing.vote === vote) {
            change = 0;
          } else {
            change = vote - existing.vote;
            await execute(
              c.env,
              "UPDATE reply_votes SET vote = ? WHERE _id = ?",
              [vote, existing._id]
            );
          }
        } else {
          const voteId = `rv-${Date.now()}`;
          await execute(
            c.env,
            "INSERT INTO reply_votes (_id, reply_id, user_id, vote, created_at) VALUES (?, ?, ?, ?, ?)",
            [voteId, replyId, user.sub, vote, new Date().toISOString()]
          );
          change = vote;
        }
      }
    }

    if (change !== 0) {
      await execute(
        c.env,
        "UPDATE discussion_replies SET votes = votes + ? WHERE _id = ?",
        [change, replyId]
      );
    }

    const updated = await queryOne<any>(
      c.env,
      "SELECT * FROM discussion_replies WHERE _id = ?",
      [replyId]
    );

    return c.json(
      apiResponse(
        true,
        {
          id: updated._id,
          ...Object.fromEntries(
            Object.entries(updated).filter(([k]) => k !== "_id")
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

app.post("/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies/:reply_id/mark-answer", async (c) => {
  try {
    const user = c.get("user");
    if (!user || !["admin", "instructor"].includes(user.role)) {
      return c.json({ success: false, data: null, error: "Only instructors can mark answers", meta: null }, 403);
    }
    const replyId = c.req.param("reply_id");

    const reply = await queryOne<any>(
      c.env,
      "SELECT * FROM discussion_replies WHERE _id = ?",
      [replyId]
    );
    if (!reply) {
      return c.json({ success: false, data: null, error: "Reply not found", meta: null }, 404);
    }

    await execute(
      c.env,
      "UPDATE discussion_replies SET is_instructor_answer = 0 WHERE discussion_id = ?",
      [reply.discussion_id]
    );
    await execute(
      c.env,
      "UPDATE discussion_replies SET is_instructor_answer = 1 WHERE _id = ?",
      [replyId]
    );

    return c.json(apiResponse(true, { id: replyId, is_instructor_answer: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

export default app;
