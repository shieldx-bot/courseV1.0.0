import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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

app.post("/:course_id/lessons/:lesson_id/ai-tutor/ask", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const courseId = c.req.param("course_id");
    const lessonId = c.req.param("lesson_id");
    const body = await c.req.json<{ question: string }>();
    const { question } = body;

    const course = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [courseId]);
    if (!course) {
      return c.json({ success: false, data: null, error: "Course not found", meta: null }, 404);
    }

    const lesson = (course.syllabus || []).find((l: any) => l.id === lessonId);
    if (!lesson) {
      return c.json({ success: false, data: null, error: "Lesson not found", meta: null }, 404);
    }

    const sessionId = `ai-session-${user.sub}-${courseId}-${lessonId}`;
    let session = await queryOne<any>(
      c.env,
      "SELECT * FROM ai_tutor_sessions WHERE _id = ?",
      [sessionId]
    );

    if (!session) {
      const now = new Date().toISOString();
      await execute(
        c.env,
        "INSERT INTO ai_tutor_sessions (_id, user_id, course_id, lesson_id, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [sessionId, user.sub, courseId, lessonId, JSON.stringify([]), now, now]
      );
      session = { _id: sessionId, user_id: user.sub, course_id: courseId, lesson_id: lessonId, messages: JSON.stringify([]), created_at: now, updated_at: now };
    }

    const messages = JSON.parse(session.messages || "[]");
    messages.push({ role: "user", content: question, timestamp: new Date().toISOString() });
    const aiResponse = `This is a simulated AI response to: ${question}`;
    messages.push({ role: "assistant", content: aiResponse, timestamp: new Date().toISOString() });

    await execute(
      c.env,
      "UPDATE ai_tutor_sessions SET messages = ?, updated_at = ? WHERE _id = ?",
      [JSON.stringify(messages), new Date().toISOString(), sessionId]
    );

    return c.json(apiResponse(true, { message: aiResponse }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/:course_id/lessons/:lesson_id/ai-tutor/history", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const courseId = c.req.param("course_id");
    const lessonId = c.req.param("lesson_id");

    const sessionId = `ai-session-${user.sub}-${courseId}-${lessonId}`;
    const session = await queryOne<any>(
      c.env,
      "SELECT * FROM ai_tutor_sessions WHERE _id = ?",
      [sessionId]
    );

    const messages = session ? JSON.parse(session.messages || "[]") : [];
    return c.json(apiResponse(true, { messages }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.delete("/:course_id/lessons/:lesson_id/ai-tutor/history", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const courseId = c.req.param("course_id");
    const lessonId = c.req.param("lesson_id");

    const sessionId = `ai-session-${user.sub}-${courseId}-${lessonId}`;
    const session = await queryOne<any>(
      c.env,
      "SELECT * FROM ai_tutor_sessions WHERE _id = ?",
      [sessionId]
    );

    if (session) {
      await execute(
        c.env,
        "UPDATE ai_tutor_sessions SET messages = ?, updated_at = ? WHERE _id = ?",
        [JSON.stringify([]), new Date().toISOString(), sessionId]
      );
    }

    return c.json(apiResponse(true, { cleared: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

export default app;
