import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/blog", async (c) => {
  try {
    const posts = await query<any>(c.env, "SELECT * FROM blog ORDER BY published_at DESC");
    return c.json(
      apiResponse(
        true,
        posts.map((p) => ({
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

app.get("/blog/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const post = await queryOne<any>(c.env, "SELECT * FROM blog WHERE slug = ?", [slug]);
    if (!post) {
      return c.json({ success: false, data: null, error: "Post not found", meta: null }, 404);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: post._id,
          ...Object.fromEntries(
            Object.entries(post).filter(([k]) => k !== "_id")
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

export default app;
