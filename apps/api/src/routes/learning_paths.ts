import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/learning-paths", async (c) => {
  try {
    const goal = c.req.query("goal");
    const limit = parseInt(c.req.query("limit") || "20");
    let paths;
    if (goal) {
      paths = await query<any>(
        c.env,
        "SELECT * FROM learning_paths WHERE goal = ? LIMIT ?",
        [goal, limit]
      );
    } else {
      paths = await query<any>(c.env, "SELECT * FROM learning_paths LIMIT ?", [limit]);
    }
    return c.json(
      apiResponse(
        true,
        paths.map((p) => ({
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

app.get("/learning-paths/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const path = await queryOne<any>(c.env, "SELECT * FROM learning_paths WHERE slug = ?", [slug]);
    if (!path) {
      return c.json({ success: false, data: null, error: "Learning path not found", meta: null }, 404);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: path._id,
          ...Object.fromEntries(
            Object.entries(path).filter(([k]) => k !== "_id")
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

app.post("/learning-paths/enroll", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const pathId = c.req.query("path_id");
    if (!pathId) {
      return c.json({ success: false, data: null, error: "path_id required", meta: null }, 400);
    }
    const enrollmentId = `enrollment-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO user_learning_paths (_id, user_id, path_id, enrolled_at, progress) VALUES (?, ?, ?, ?, ?)",
      [enrollmentId, user.sub, pathId, now, 0]
    );
    return c.json(
      apiResponse(
        true,
        { id: enrollmentId, user_id: user.sub, path_id: pathId, enrolled_at: now, progress: 0 },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/learning-paths/my", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const enrollments = await query<any>(
      c.env,
      "SELECT * FROM user_learning_paths WHERE user_id = ?",
      [user.sub]
    );
    return c.json(
      apiResponse(
        true,
        enrollments.map((e) => ({
          id: e._id,
          ...Object.fromEntries(
            Object.entries(e).filter(([k]) => k !== "_id")
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

app.post("/learning-paths/seed", async (c) => {
  try {
    return c.json(apiResponse(true, { seeded: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

export default app;
