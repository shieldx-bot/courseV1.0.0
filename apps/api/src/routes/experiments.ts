import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/active", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const experiments = await query<any>(
      c.env,
      "SELECT * FROM experiments WHERE active = 1"
    );
    return c.json(apiResponse(true, experiments, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/variant-map", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const variantMap: Record<string, string> = {};
    const experiments = await query<any>(
      c.env,
      "SELECT * FROM experiments WHERE active = 1"
    );
    for (const exp of experiments) {
      if (exp.variants && exp.variants.length > 0) {
        const index = Math.floor(Math.random() * exp.variants.length);
        variantMap[exp.slug] = exp.variants[index];
      }
    }
    return c.json(apiResponse(true, variantMap, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/track", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json<{ experiment_slug: string; variant_name: string; variant_index: number; event_type: string }>();
    const { experiment_slug, variant_name, variant_index, event_type } = body;

    const eventId = `event-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO experiment_events (_id, experiment_slug, event_type, user_id, variant_name, variant_index, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [eventId, experiment_slug, event_type, user?.sub || null, variant_name, variant_index, JSON.stringify({ user_role: user?.role || "anonymous" }), now]
    );

    return c.json(apiResponse(true, { tracked: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/admin/experiments", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const experiments = await query<any>(c.env, "SELECT * FROM experiments");
    return c.json(apiResponse(true, experiments, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/admin/experiments", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const body = await c.req.json<{ name: string; slug: string; description: string; active?: boolean; variants?: string[]; traffic_split?: number[] }>();
    const { name, slug, description, active, variants, traffic_split } = body;

    const experimentId = `experiment-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO experiments (_id, name, slug, description, active, variants, traffic_split, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [experimentId, name, slug, description, active ? 1 : 0, JSON.stringify(variants || []), JSON.stringify(traffic_split || []), now]
    );

    return c.json(
      apiResponse(
        true,
        { id: experimentId, name, slug, description, active: !!active, variants: variants || [], traffic_split: traffic_split || [], created_at: now },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.put("/admin/experiments/:experiment_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const experimentId = c.req.param("experiment_id");
    const body = await c.req.json<{ name?: string; description?: string; active?: boolean; variants?: string[]; traffic_split?: number[] }>();
    const { name, description, active, variants, traffic_split } = body;

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push("name = ?"); params.push(name); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (active !== undefined) { updates.push("active = ?"); params.push(active ? 1 : 0); }
    if (variants !== undefined) { updates.push("variants = ?"); params.push(JSON.stringify(variants)); }
    if (traffic_split !== undefined) { updates.push("traffic_split = ?"); params.push(JSON.stringify(traffic_split)); }

    if (updates.length > 0) {
      params.push(experimentId);
      await execute(
        c.env,
        `UPDATE experiments SET ${updates.join(", ")} WHERE _id = ?`,
        params
      );
    }

    const updated = await queryOne<any>(c.env, "SELECT * FROM experiments WHERE _id = ?", [experimentId]);
    return c.json(
      apiResponse(
        true,
        { id: updated._id, name: updated.name, description: updated.description, active: !!updated.active, variants: JSON.parse(updated.variants || "[]"), traffic_split: JSON.parse(updated.traffic_split || "[]") },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.delete("/admin/experiments/:experiment_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const experimentId = c.req.param("experiment_id");
    await execute(c.env, "DELETE FROM experiments WHERE _id = ?", [experimentId]);
    return c.json(apiResponse(true, { deleted: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/admin/experiments/stats", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const experimentSlug = c.req.query("experiment_slug");
    let result;

    if (experimentSlug) {
      result = await query<any>(
        c.env,
        "SELECT event_type, COUNT(*) as count FROM experiment_events WHERE experiment_slug = ? GROUP BY event_type",
        [experimentSlug]
      );
    } else {
      result = await query<any>(
        c.env,
        "SELECT experiment_slug, COUNT(*) as total_events FROM experiment_events GROUP BY experiment_slug"
      );
    }

    return c.json(apiResponse(true, result || [], null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

export default app;
