import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/reviews", async (c) => {
  try {
    const reviews = await query<any>(c.env, "SELECT * FROM reviews");
    return c.json(
      apiResponse(
        true,
        reviews.map((r) => ({
          id: r._id,
          ...Object.fromEntries(
            Object.entries(r).filter(([k]) => k !== "_id")
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

export default app;
