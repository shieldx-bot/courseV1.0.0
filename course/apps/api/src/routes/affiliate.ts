import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/config", async (c) => {
  try {
    const config = await queryOne<any>(c.env, "SELECT * FROM referral_config LIMIT 1");
    if (!config) {
      const defaultConfig = {
        id: "referral-config",
        commission_rate: 10,
        min_payout: 50,
        enabled: true,
      };
      await execute(
        c.env,
        "INSERT INTO referral_config (_id, commission_rate, min_payout, enabled) VALUES (?, ?, ?, ?)",
        ["referral-config", 10, 50, 1]
      );
      return c.json(apiResponse(true, defaultConfig, null, null), 200);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: config._id,
          commission_rate: config.commission_rate,
          min_payout: config.min_payout,
          enabled: !!config.enabled,
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

app.put("/config", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Admin required", meta: null }, 403);
    }
    const body = await c.req.json<{ commission_rate?: number; min_payout?: number; enabled?: boolean }>();
    const updates: string[] = [];
    const params: any[] = [];

    if (body.commission_rate !== undefined) {
      updates.push("commission_rate = ?");
      params.push(body.commission_rate);
    }
    if (body.min_payout !== undefined) {
      updates.push("min_payout = ?");
      params.push(body.min_payout);
    }
    if (body.enabled !== undefined) {
      updates.push("enabled = ?");
      params.push(body.enabled ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push("referral-config");
      await execute(
        c.env,
        `UPDATE referral_config SET ${updates.join(", ")} WHERE _id = ?`,
        params
      );
    }

    const config = await queryOne<any>(c.env, "SELECT * FROM referral_config WHERE _id = ?", ["referral-config"]);
    return c.json(
      apiResponse(
        true,
        {
          id: config._id,
          commission_rate: config.commission_rate,
          min_payout: config.min_payout,
          enabled: !!config.enabled,
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

app.post("/code", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const existing = await queryOne<any>(c.env, "SELECT * FROM referrals WHERE user_id = ?", [user.sub]);
    if (existing) {
      return c.json(apiResponse(true, existing, null, null), 200);
    }

    const code = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const referralId = `referral-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO referrals (_id, user_id, code, created_at) VALUES (?, ?, ?, ?)",
      [referralId, user.sub, code, now]
    );

    return c.json(apiResponse(true, { id: referralId, code, user_id: user.sub, created_at: now }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/code", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const referral = await queryOne<any>(c.env, "SELECT * FROM referrals WHERE user_id = ?", [user.sub]);
    return c.json(apiResponse(true, referral || null, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/apply", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const body = await c.req.json<{ code: string }>();
    const { code } = body;

    const referral = await queryOne<any>(c.env, "SELECT * FROM referrals WHERE code = ?", [code.toUpperCase()]);
    if (!referral) {
      return c.json({ success: false, data: null, error: "Invalid referral code", meta: null }, 404);
    }

    const applicationId = `referral-app-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO referral_applications (_id, user_id, referral_code, applied_at) VALUES (?, ?, ?, ?)",
      [applicationId, user.sub, code.toUpperCase(), now]
    );

    return c.json(apiResponse(true, { id: applicationId, code: code.toUpperCase(), user_id: user.sub, applied_at: now }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/apply-discount", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const application = await queryOne<any>(
      c.env,
      "SELECT * FROM referral_applications WHERE user_id = ?",
      [user.sub]
    );
    if (!application) {
      return c.json(apiResponse(true, { applied: false, message: "No referral application found" }, null, null), 200);
    }
    return c.json(apiResponse(true, { applied: true, code: application.referral_code }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/stats", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const stats = await queryOne<any>(
      c.env,
      "SELECT COUNT(*) as total_referrals FROM referrals WHERE user_id = ?",
      [user.sub]
    );
    return c.json(
      apiResponse(
        true,
        { total_referrals: stats?.total_referrals || 0 },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/dashboard", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const stats = await queryOne<any>(
      c.env,
      "SELECT COUNT(*) as total_clicks FROM affiliate_clicks WHERE affiliate_id = ?",
      [user.sub]
    );
    return c.json(
      apiResponse(
        true,
        { total_clicks: stats?.total_clicks || 0, total_conversions: 0 },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/links", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const body = await c.req.json<{ url: string; label?: string }>();
    const { url, label } = body;

    const linkId = `link-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO affiliate_links (_id, affiliate_id, url, title, clicks, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [linkId, user.sub, url, label || "", 0, now]
    );

    return c.json(
      apiResponse(
        true,
        { id: linkId, url, title: label || "", clicks: 0, created_at: now },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/links", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const links = await query<any>(
      c.env,
      "SELECT * FROM affiliate_links WHERE affiliate_id = ?",
      [user.sub]
    );
    return c.json(
      apiResponse(
        true,
        links.map((l) => ({
          id: l._id,
          ...Object.fromEntries(
            Object.entries(l).filter(([k]) => k !== "_id")
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

app.get("/r/:tracking_code", async (c) => {
  try {
    const trackingCode = c.req.param("tracking_code");
    const link = await queryOne<any>(
      c.env,
      "SELECT * FROM affiliate_links WHERE _id = ?",
      [trackingCode]
    );
    if (!link) {
      return c.json({ success: false, data: null, error: "Invalid tracking code", meta: null }, 404);
    }

    await execute(
      c.env,
      "UPDATE affiliate_links SET clicks = clicks + 1 WHERE _id = ?",
      [trackingCode]
    );

    await execute(
      c.env,
      "INSERT INTO affiliate_clicks (_id, affiliate_id, link_id, clicked_at) VALUES (?, ?, ?, ?)",
      [`click-${Date.now()}`, link.affiliate_id, trackingCode, new Date().toISOString()]
    );

    return c.json(apiResponse(true, { url: link.url }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/conversion", async (c) => {
  try {
    const trackingCode = c.req.query("tracking_code");
    const orderId = c.req.query("order_id");
    const amount = parseFloat(c.req.query("amount") || "0");
    const commissionRate = parseFloat(c.req.query("commission_rate") || "0");

    if (!trackingCode) {
      return c.json({ success: false, data: null, error: "Invalid tracking code", meta: null }, 404);
    }

    const link = await queryOne<any>(
      c.env,
      "SELECT * FROM affiliate_links WHERE _id = ?",
      [trackingCode]
    );

    return c.json(
      apiResponse(
        true,
        {
          tracked: true,
          link_id: trackingCode,
          order_id: orderId,
          amount,
          commission: (amount * commissionRate) / 100,
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

app.post("/admin/seed", async (c) => {
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

export default app;
