import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/referral/seed", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    return c.json(apiResponse(true, { message: "Referral data seeded successfully" }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/referral/seed", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    return c.json(apiResponse(true, { seeded: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/lessons/:lesson_id/generate-code", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const lessonId = c.req.param("lesson_id");
    const body = await c.req.json<{ title: string; description: string; language: string }>();
    const { title, description, language } = body;

    const code = `// Generated code for ${title}\n// Language: ${language}\n// Description: ${description}\n\n// TODO: Implement code generation logic`;

    return c.json(
      apiResponse(
        true,
        { lesson_id: lessonId, code, language, title, description },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

export default app;
