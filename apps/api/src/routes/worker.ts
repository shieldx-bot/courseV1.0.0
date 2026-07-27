import { Hono } from "hono";
import { Env, Variables } from "../types";
import { apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/health", (c) => {
  return c.json(
    apiResponse(
      true,
      {
        status: "ok",
        runtime: "cloudflare-workers",
        timestamp: new Date().toISOString(),
      },
      null,
      null
    ),
    200
  );
});

app.get("/queue", async (c) => {
  try {
    return c.json(
      apiResponse(
        true,
        {
          queue_depth: 0,
          timestamp: new Date().toISOString(),
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

app.get("/dlq", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "100");
    return c.json(
      apiResponse(
        true,
        {
          count: 0,
          entries: [],
          timestamp: new Date().toISOString(),
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

app.post("/dlq/requeue/:index", async (c) => {
  try {
    const index = parseInt(c.req.param("index"));
    return c.json(
      apiResponse(
        true,
        { requeued: true, function: "unknown" },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/dlq/clear", async (c) => {
  try {
    return c.json(
      apiResponse(
        true,
        { cleared: true, timestamp: new Date().toISOString() },
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
