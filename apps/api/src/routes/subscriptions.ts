import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/tiers", async (c) => {
  try {
    const tiers = await query<any>(c.env, "SELECT * FROM tiers ORDER BY duration_months");
    return c.json(
      apiResponse(
        true,
        tiers.map((t) => ({
          id: t._id,
          ...Object.fromEntries(
            Object.entries(t).filter(([k]) => k !== "_id")
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

app.get("/coupons/:code", async (c) => {
  try {
    const code = c.req.param("code").toUpperCase();
    const coupon = await queryOne<any>(
      c.env,
      "SELECT * FROM coupons WHERE code = ? AND (expires_at IS NULL OR expires_at > ?)",
      [code, new Date().toISOString()]
    );
    if (!coupon) {
      return c.json({ success: false, data: null, error: "Invalid or expired coupon", meta: null }, 404);
    }
    if (coupon.max_uses && (coupon.used_count || 0) >= coupon.max_uses) {
      return c.json({ success: false, data: null, error: "Coupon usage limit reached", meta: null }, 404);
    }
    return c.json(
      apiResponse(
        true,
        {
          code: coupon.code,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
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

app.get("/me", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const sub = await queryOne<any>(
      c.env,
      "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'",
      [user.sub]
    );
    if (!sub) {
      return c.json(apiResponse(true, null, null, null), 200);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: sub._id,
          tier: sub.tier,
          status: sub.status,
          starts_at: sub.starts_at,
          ends_at: sub.ends_at,
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

app.get("/orders", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const orders = await query<any>(
      c.env,
      "SELECT * FROM orders WHERE user_id = ?",
      [user.sub]
    );
    return c.json(
      apiResponse(
        true,
        orders.map((o) => ({
          id: o._id,
          ...Object.fromEntries(
            Object.entries(o).filter(([k]) => k !== "_id")
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

app.post("/cancel", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const sub = await queryOne<any>(
      c.env,
      "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'",
      [user.sub]
    );
    if (!sub) {
      return c.json({ success: false, data: null, error: "No active subscription found", meta: null }, 404);
    }
    const now = new Date().toISOString();
    await execute(
      c.env,
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = ? WHERE user_id = ?",
      [now, user.sub]
    );
    return c.json(apiResponse(true, { message: "Subscription cancelled" }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/checkout/session", async (c) => {
  try {
    const body = await c.req.json<{ tier_id: string; coupon_code?: string }>();
    const { tier_id, coupon_code } = body;
    const tier = await queryOne<any>(
      c.env,
      "SELECT * FROM tiers WHERE _id = ? OR id = ?",
      [tier_id, tier_id]
    );
    if (!tier) {
      return c.json({ success: false, data: null, error: "Tier not found", meta: null }, 404);
    }

    let coupon = null;
    if (coupon_code) {
      coupon = await queryOne<any>(
        c.env,
        "SELECT * FROM coupons WHERE code = ?",
        [coupon_code.toUpperCase()]
      );
    }

    const base = tier.duration_months >= 999 ? 999 : tier.price_per_month * tier.duration_months;
    let amount = base;
    if (coupon && coupon.discount_type === "percent") {
      amount = Math.floor(base * (1 - coupon.discount_value / 100));
    }

    const sessionId = `session-${Date.now()}`;
    const checkoutUrl = `${c.env.API_BASE_URL || "https://api.ascendly.io"}/checkout?session_id=${sessionId}`;

    return c.json(
      apiResponse(
        true,
        { id: sessionId, url: checkoutUrl, amount },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/checkout/paypal/capture", async (c) => {
  try {
    const orderId = c.req.query("order_id");
    if (!orderId) {
      return c.json({ success: false, data: null, error: "order_id required", meta: null }, 400);
    }
    return c.json(
      apiResponse(
        true,
        { id: orderId, status: "completed" },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/webhooks/stripe", async (c) => {
  try {
    const body = await c.req.text();
    const sigHeader = c.req.header("stripe-signature");
    return c.json(apiResponse(true, { received: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/webhooks/paypal", async (c) => {
  try {
    const body = await c.req.text();
    return c.json(apiResponse(true, { received: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/admin/renewal-reminders", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const days = parseInt(c.req.query("days") || "7");
    const jobId = `renewal-reminder-${Date.now()}`;
    await c.env.BACKGROUND_QUEUE.send({
      type: "send_batch_renewal_reminders_task",
      args: { days },
    });
    return c.json(
      apiResponse(
        true,
        { enqueued: true, job_id: jobId, days },
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
