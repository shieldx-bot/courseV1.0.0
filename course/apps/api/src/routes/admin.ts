import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/dashboard", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }

    const totalUsers = await queryOne<any>(c.env, "SELECT COUNT(*) as count FROM users");
    const activeSubs = await queryOne<any>(c.env, "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'");
    const totalCourses = await queryOne<any>(c.env, "SELECT COUNT(*) as count FROM courses");
    const courses = await query<any>(c.env, "SELECT syllabus FROM courses");
    const totalLessons = courses.reduce(
      (sum, c) => sum + (JSON.parse(c.syllabus || "[]").length || 0),
      0
    );
    const orders = await query<any>(c.env, "SELECT amount FROM orders");
    const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentOrders = orders.filter((o) => o.created_at >= thirtyDaysAgo);
    const recentRevenue = recentOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

    return c.json(
      apiResponse(
        true,
        {
          total_members: totalUsers?.count || 0,
          active_subscriptions: activeSubs?.count || 0,
          total_courses: totalCourses?.count || 0,
          total_lessons: totalLessons,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          recent_revenue: Math.round(recentRevenue * 100) / 100,
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

app.get("/analytics/summary", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const users = await query<any>(c.env, "SELECT * FROM users");
    const progress = await query<any>(c.env, "SELECT * FROM progress");
    const subscriptions = await query<any>(c.env, "SELECT * FROM subscriptions");
    const courses = await query<any>(c.env, "SELECT * FROM courses");
    const orders = await query<any>(c.env, "SELECT * FROM orders");

    const metrics = buildMetrics(users, progress, subscriptions, courses, orders);

    return c.json(
      apiResponse(
        true,
        {
          segment: metrics.segment,
          churn_risk_users: metrics.churn_risk_users,
          active_subscriptions: metrics.active_subscriptions,
          top_category: metrics.top_category,
          recent_30_day_revenue: metrics.recent_30_day_revenue,
          recommendation: "Offer a 3-day extension to users who completed 2+ lessons then paused.",
          content_gap: `Category with most courses: ${metrics.top_category} (${metrics.top_category_count} courses).`,
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

app.get("/analytics/forecast", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const orders = await query<any>(c.env, "SELECT * FROM orders");
    const progress = await query<any>(c.env, "SELECT * FROM progress");
    const subscriptions = await query<any>(c.env, "SELECT * FROM subscriptions");
    const users = await query<any>(c.env, "SELECT * FROM users");

    const revenue = forecastRevenue(orders, users, progress, subscriptions, 30);
    const subs = forecastNewSubscriptions(orders, 50, 30);
    const churn = forecastChurn(progress, subscriptions, users);

    return c.json(
      apiResponse(
        true,
        {
          next_30_days: {
            predicted_revenue: revenue.predicted_revenue,
            predicted_new_subscriptions: subs.predicted_new_subscriptions,
            predicted_churn_rate: churn.predicted_churn_rate,
            confidence: revenue.confidence,
          },
          churn_risk_users: churn.churn_risk_users,
          churn_model: churn.model || "rule-based",
          note: revenue.note,
          model: revenue.model || "fallback",
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

app.get("/courses", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const courses = await query<any>(c.env, "SELECT * FROM courses");
    return c.json(
      apiResponse(
        true,
        courses.map((course) => ({
          id: course._id,
          ...Object.fromEntries(
            Object.entries(course).filter(([k]) => k !== "_id")
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

app.post("/courses", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const body = await c.req.json<{
      category_id: string;
      title: string;
      slug: string;
      description: string;
      image_url?: string;
      instructor?: any;
      syllabus?: any[];
      outcome?: string[];
    }>();
    const { category_id, title, slug, description, image_url, instructor, syllabus, outcome } = body;

    const cat = await queryOne<any>(c.env, "SELECT * FROM categories WHERE _id = ?", [category_id]);
    if (!cat) {
      return c.json({ success: false, data: null, error: "Category not found", meta: null }, 400);
    }

    const courseId = `course-${slug}`;
    const existing = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [courseId]);
    if (existing) {
      return c.json({ success: false, data: null, error: "Course slug already exists", meta: null }, 400);
    }

    const now = new Date().toISOString();
    const courseSyllabus = (syllabus || []).map((s, i) => ({
      id: `${courseId}-lesson-${i + 1}`,
      ...s,
    }));

    await execute(
      c.env,
      "INSERT INTO courses (_id, category_id, category_slug, category_name, title, slug, description, image_url, instructor, lesson_count, syllabus, outcome, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        courseId,
        category_id,
        cat.slug,
        cat.name,
        title,
        slug,
        description,
        image_url || "",
        instructor ? JSON.stringify(instructor) : null,
        courseSyllabus.length,
        JSON.stringify(courseSyllabus),
        JSON.stringify(outcome || []),
        now,
      ]
    );

    return c.json(
      apiResponse(
        true,
        {
          id: courseId,
          category_id,
          category_slug: cat.slug,
          category_name: cat.name,
          title,
          slug,
          description,
          image_url: image_url || "",
          instructor,
          lesson_count: courseSyllabus.length,
          syllabus: courseSyllabus,
          outcome: outcome || [],
          created_at: now,
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

app.get("/courses/:course_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const courseId = c.req.param("course_id");
    const course = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [courseId]);
    if (!course) {
      return c.json({ success: false, data: null, error: "Course not found", meta: null }, 404);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: course._id,
          ...Object.fromEntries(
            Object.entries(course).filter(([k]) => k !== "_id")
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

app.put("/courses/:course_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const courseId = c.req.param("course_id");
    const body = await c.req.json<{
      category_id: string;
      title: string;
      slug: string;
      description: string;
      image_url?: string;
      instructor?: any;
      syllabus?: any[];
      outcome?: string[];
    }>();
    const { category_id, title, slug, description, image_url, instructor, syllabus, outcome } = body;

    const cat = await queryOne<any>(c.env, "SELECT * FROM categories WHERE _id = ?", [category_id]);
    if (!cat) {
      return c.json({ success: false, data: null, error: "Category not found", meta: null }, 400);
    }

    const courseSyllabus = (syllabus || []).map((s, i) => ({
      id: `${courseId}-lesson-${i + 1}`,
      ...s,
    }));

    await execute(
      c.env,
      "UPDATE courses SET category_id = ?, category_slug = ?, category_name = ?, title = ?, slug = ?, description = ?, image_url = ?, instructor = ?, lesson_count = ?, syllabus = ?, outcome = ? WHERE _id = ?",
      [
        category_id,
        cat.slug,
        cat.name,
        title,
        slug,
        description,
        image_url || "",
        instructor ? JSON.stringify(instructor) : null,
        courseSyllabus.length,
        JSON.stringify(courseSyllabus),
        JSON.stringify(outcome || []),
        courseId,
      ]
    );

    const updated = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [courseId]);
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

app.delete("/courses/:course_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const courseId = c.req.param("course_id");
    await execute(c.env, "DELETE FROM courses WHERE _id = ?", [courseId]);
    return c.json(apiResponse(true, { deleted: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/courses/:course_id/generate-content", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const courseId = c.req.param("course_id");
    const course = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [courseId]);
    if (!course) {
      return c.json({ success: false, data: null, error: "Course not found", meta: null }, 404);
    }
    return c.json(
      apiResponse(
        true,
        {
          course_id: courseId,
          short_description: `Learn ${course.title}`,
          long_description: course.description,
          learning_outcomes: course.outcome || [],
          thumbnail_prompt: `A professional thumbnail for ${course.title}`,
          source: "fallback",
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

app.post("/courses/:course_id/lessons", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const courseId = c.req.param("course_id");
    const body = await c.req.json<{
      title: string;
      order: number;
      duration_seconds: number;
      drive_file_id?: string | null;
      r2_key?: string | null;
      language?: string | null;
      starter_code?: string | null;
      solution_code?: string | null;
      test_cases?: string | null;
      attachments?: any[];
    }>();
    const { title, order, duration_seconds, drive_file_id, r2_key, language, starter_code, solution_code, test_cases, attachments } = body;

    const course = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [courseId]);
    if (!course) {
      return c.json({ success: false, data: null, error: "Course not found", meta: null }, 404);
    }

    const syllabus = JSON.parse(course.syllabus || "[]");
    const lessonId = `${courseId}-lesson-${syllabus.length + 1}`;
    const lesson = {
      id: lessonId,
      title,
      order,
      duration_seconds,
      drive_file_id: drive_file_id || null,
      r2_key: r2_key || null,
      language: language || null,
      starter_code: starter_code || null,
      solution_code: solution_code || null,
      test_cases: test_cases || null,
      attachments: attachments || [],
    };
    syllabus.push(lesson);

    await execute(
      c.env,
      "UPDATE courses SET syllabus = ?, lesson_count = ? WHERE _id = ?",
      [JSON.stringify(syllabus), syllabus.length, courseId]
    );

    return c.json(apiResponse(true, lesson, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.delete("/courses/:course_id/lessons/:lesson_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const courseId = c.req.param("course_id");
    const lessonId = c.req.param("lesson_id");

    const course = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [courseId]);
    if (!course) {
      return c.json({ success: false, data: null, error: "Course not found", meta: null }, 404);
    }

    const syllabus = JSON.parse(course.syllabus || "[]");
    const filtered = syllabus.filter((l: any) => l.id !== lessonId);

    await execute(
      c.env,
      "UPDATE courses SET syllabus = ?, lesson_count = ? WHERE _id = ?",
      [JSON.stringify(filtered), filtered.length, courseId]
    );

    return c.json(apiResponse(true, { deleted: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/users", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const search = c.req.query("search");
    const role = c.req.query("role");

    let sql = "SELECT _id, email, name, role, phone_verified, created_at FROM users";
    const params: any[] = [];
    const conditions: string[] = [];

    if (role) {
      conditions.push("role = ?");
      params.push(role);
    }
    if (search) {
      conditions.push("(email LIKE ? OR name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    const users = await query<any>(c.env, sql, params);
    return c.json(
      apiResponse(
        true,
        users.map((u) => ({
          id: u._id,
          email: u.email,
          name: u.name || "",
          role: u.role,
          phone_verified: !!u.phone_verified,
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

app.get("/users/:user_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const userId = c.req.param("user_id");
    const dbUser = await queryOne<any>(c.env, "SELECT * FROM users WHERE _id = ?", [userId]);
    if (!dbUser) {
      return c.json({ success: false, data: null, error: "User not found", meta: null }, 404);
    }
    const sub = await queryOne<any>(
      c.env,
      "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'",
      [userId]
    );
    return c.json(
      apiResponse(
        true,
        {
          id: dbUser._id,
          email: dbUser.email,
          name: dbUser.name || "",
          role: dbUser.role,
          phone_verified: !!dbUser.phone_verified,
          subscription: sub || null,
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

app.put("/users/:user_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const userId = c.req.param("user_id");
    const body = await c.req.json<{ name?: string; role?: string }>();
    const { name, role } = body;

    const dbUser = await queryOne<any>(c.env, "SELECT * FROM users WHERE _id = ?", [userId]);
    if (!dbUser) {
      return c.json({ success: false, data: null, error: "User not found", meta: null }, 404);
    }

    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); params.push(name); }
    if (role !== undefined) { updates.push("role = ?"); params.push(role); }

    if (updates.length > 0) {
      params.push(userId);
      await execute(
        c.env,
        `UPDATE users SET ${updates.join(", ")} WHERE _id = ?`,
        params
      );
    }

    const updated = await queryOne<any>(c.env, "SELECT * FROM users WHERE _id = ?", [userId]);
    return c.json(
      apiResponse(
        true,
        { id: updated._id, email: updated.email, name: updated.name || "", role: updated.role },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/users/:user_id/subscription", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const userId = c.req.param("user_id");
    const body = await c.req.json<{ tier_id: string; duration_months?: number; ends_at?: string; status?: string }>();
    const { tier_id, duration_months, ends_at, status } = body;

    const dbUser = await queryOne<any>(c.env, "SELECT * FROM users WHERE _id = ?", [userId]);
    if (!dbUser) {
      return c.json({ success: false, data: null, error: "User not found", meta: null }, 404);
    }

    const tier = await queryOne<any>(c.env, "SELECT * FROM tiers WHERE _id = ? OR id = ?", [tier_id, tier_id]);
    if (!tier) {
      return c.json({ success: false, data: null, error: "Tier not found", meta: null }, 404);
    }

    await execute(
      c.env,
      "UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE user_id = ? AND status = 'active'",
      [new Date().toISOString(), userId]
    );

    const now = new Date();
    const endDate = ends_at
      ? new Date(ends_at)
      : duration_months
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 * duration_months)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subId = `sub-${userId}-${now.getTime()}`;
    await execute(
      c.env,
      "INSERT INTO subscriptions (_id, user_id, tier, status, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)",
      [subId, userId, tier.id || tier._id, status || "active", now.toISOString(), endDate.toISOString()]
    );

    return c.json(
      apiResponse(
        true,
        { subscription_id: subId, status: status || "active", ends_at: endDate.toISOString() },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.delete("/users/:user_id/subscription", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const userId = c.req.param("user_id");
    const result = await execute(
      c.env,
      "UPDATE subscriptions SET status = 'canceled', ends_at = ?, updated_at = ? WHERE user_id = ? AND status = 'active'",
      [new Date().toISOString(), new Date().toISOString(), userId]
    );
    return c.json(apiResponse(true, { canceled: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/orders", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const search = c.req.query("search");
    const status = c.req.query("status");
    const provider = c.req.query("provider");

    let sql = "SELECT * FROM orders";
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) { conditions.push("payment_status = ?"); params.push(status); }
    if (provider) { conditions.push("payment_provider = ?"); params.push(provider); }
    if (search) {
      conditions.push("(user_id LIKE ? OR _id LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";

    const orders = await query<any>(c.env, sql, params);
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

app.post("/orders/:order_id/refund", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const orderId = c.req.param("order_id");
    const order = await queryOne<any>(c.env, "SELECT * FROM orders WHERE _id = ?", [orderId]);
    if (!order) {
      return c.json({ success: false, data: null, error: "Order not found", meta: null }, 404);
    }
    if (order.payment_status === "refunded") {
      return c.json({ success: false, data: null, error: "Order already refunded", meta: null }, 400);
    }

    const now = new Date().toISOString();
    await execute(
      c.env,
      "UPDATE orders SET payment_status = 'refunded', refunded_at = ?, refund_error = ? WHERE _id = ?",
      [now, null, orderId]
    );

    if (order.subscription_id) {
      await execute(
        c.env,
        "UPDATE subscriptions SET status = 'canceled', ends_at = ?, updated_at = ? WHERE _id = ?",
        [now, now, order.subscription_id]
      );
    }

    return c.json(apiResponse(true, { refunded: true, order_id: orderId, refund_error: null }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/coupons", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const coupons = await query<any>(c.env, "SELECT * FROM coupons");
    return c.json(
      apiResponse(
        true,
        coupons.map((cp) => ({
          id: cp._id,
          ...Object.fromEntries(
            Object.entries(cp).filter(([k]) => k !== "_id")
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

app.post("/coupons", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const body = await c.req.json<{ code: string; discount_type: string; discount_value: number; max_uses?: number | null; expires_at?: string | null }>();
    const { code, discount_type, discount_value, max_uses, expires_at } = body;

    const couponId = `coupon-${code.toUpperCase()}`;
    const existing = await queryOne<any>(c.env, "SELECT * FROM coupons WHERE _id = ?", [couponId]);
    if (existing) {
      return c.json({ success: false, data: null, error: "Coupon code already exists", meta: null }, 400);
    }

    await execute(
      c.env,
      "INSERT INTO coupons (_id, code, discount_type, discount_value, max_uses, used_count, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [couponId, code.toUpperCase(), discount_type, discount_value, max_uses || null, 0, expires_at || null]
    );

    return c.json(
      apiResponse(
        true,
        {
          id: couponId,
          code: code.toUpperCase(),
          discount_type,
          discount_value,
          max_uses: max_uses || null,
          used_count: 0,
          expires_at: expires_at || null,
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

app.delete("/coupons/:coupon_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const couponId = c.req.param("coupon_id");
    await execute(c.env, "DELETE FROM coupons WHERE _id = ?", [couponId]);
    return c.json(apiResponse(true, { deleted: true }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/lessons/:lesson_id/migrate-to-r2", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const lessonId = c.req.param("lesson_id");
    const body = await c.req.json<{ drive_file_id: string; watermark_text?: string }>();
    const { drive_file_id, watermark_text } = body;

    const jobId = `migrate-${Date.now()}`;
    await c.env.BACKGROUND_QUEUE.send({
      type: "migrate_video_task",
      args: { lesson_id: lessonId, drive_file_id, watermark_text },
    });

    return c.json(apiResponse(true, { lesson_id: lessonId, job_id: jobId, status: "enqueued" }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/courses/:course_id/migrate-to-r2", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const courseId = c.req.param("course_id");
    const course = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [courseId]);
    if (!course) {
      return c.json({ success: false, data: null, error: "Course not found", meta: null }, 404);
    }

    const syllabus = JSON.parse(course.syllabus || "[]");
    const jobs = [];
    for (const lesson of syllabus) {
      if (lesson.drive_file_id && !lesson.r2_key) {
        const jobId = `migrate-${Date.now()}-${lesson.id}`;
        await c.env.BACKGROUND_QUEUE.send({
          type: "migrate_video_task",
          args: { lesson_id: lesson.id, drive_file_id: lesson.drive_file_id },
        });
        jobs.push({ lesson_id: lesson.id, job_id: jobId, status: "enqueued" });
      }
    }

    return c.json(
      apiResponse(
        true,
        { course_id: courseId, jobs, total_enqueued: jobs.length },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/r2/status", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    return c.json(
      apiResponse(
        true,
        {
          configured: true,
          object_count: 0,
          total_bytes: 0,
          bucket: c.env.R2_BUCKET_NAME || "ascendly-videos",
          auto_delete_days: parseInt(c.env.R2_AUTO_DELETE_DAYS || "1"),
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

app.post("/r2/set-lifecycle", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    return c.json(
      apiResponse(
        true,
        { status: "ok", auto_delete_days: parseInt(c.env.R2_AUTO_DELETE_DAYS || "1") },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.put("/courses/:course_id/lessons/:lesson_id/drive", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const courseId = c.req.param("course_id");
    const lessonId = c.req.param("lesson_id");
    const body = await c.req.json<{ drive_file_id: string; r2_key?: string | null }>();
    const { drive_file_id, r2_key } = body;

    const course = await queryOne<any>(c.env, "SELECT * FROM courses WHERE _id = ?", [courseId]);
    if (!course) {
      return c.json({ success: false, data: null, error: "Course not found", meta: null }, 404);
    }

    const syllabus = JSON.parse(course.syllabus || "[]");
    let updated = false;
    for (const lesson of syllabus) {
      if (lesson.id === lessonId) {
        lesson.drive_file_id = drive_file_id;
        if (r2_key !== undefined) lesson.r2_key = r2_key;
        updated = true;
        break;
      }
    }

    if (!updated) {
      return c.json({ success: false, data: null, error: "Lesson not found", meta: null }, 404);
    }

    await execute(
      c.env,
      "UPDATE courses SET syllabus = ? WHERE _id = ?",
      [JSON.stringify(syllabus), courseId]
    );

    return c.json(apiResponse(true, { lesson_id: lessonId, drive_file_id }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/drive/files", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    return c.json(apiResponse(true, { configured: false, files: [] }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/drive/scan", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    return c.json(apiResponse(true, { configured: false, candidates: [] }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/drive/import", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    return c.json(apiResponse(true, { id: "", title: "", lesson_count: 0 }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/drive/import-all", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    return c.json(apiResponse(true, { results: [], errors: [] }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/campaigns/run", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const jobId = `campaign-${Date.now()}`;
    await c.env.BACKGROUND_QUEUE.send({
      type: "run_email_campaigns_task",
      args: {},
    });
    return c.json(apiResponse(true, { enqueued: true, job_id: jobId }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/campaigns/stats", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const campaigns = await query<any>(c.env, "SELECT * FROM email_campaigns");
    return c.json(
      apiResponse(
        true,
        {
          total_campaign_emails_sent: campaigns.length,
          by_campaign: {},
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

app.get("/categories", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const categories = await query<any>(c.env, "SELECT * FROM categories");
    return c.json(
      apiResponse(
        true,
        categories.map((cat) => ({
          id: cat._id,
          ...Object.fromEntries(
            Object.entries(cat).filter(([k]) => k !== "_id")
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

app.post("/categories", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const body = await c.req.json<{ name: string; slug: string; icon?: string; description?: string; course_count?: number }>();
    const { name, slug, icon, description, course_count } = body;

    const existing = await queryOne<any>(
      c.env,
      "SELECT * FROM categories WHERE slug = ? OR name = ?",
      [slug, name]
    );
    if (existing) {
      return c.json({ success: false, data: null, error: "Category with this slug or name already exists", meta: null }, 400);
    }

    const categoryId = `cat-${slug}`;
    await execute(
      c.env,
      "INSERT INTO categories (_id, name, slug, icon, description, course_count) VALUES (?, ?, ?, ?, ?, ?)",
      [categoryId, name, slug, icon || "book", description || "", course_count || 0]
    );

    return c.json(
      apiResponse(
        true,
        { id: categoryId, name, slug, icon: icon || "book", description: description || "", course_count: course_count || 0 },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/categories/:category_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const categoryId = c.req.param("category_id");
    const category = await queryOne<any>(c.env, "SELECT * FROM categories WHERE _id = ?", [categoryId]);
    if (!category) {
      return c.json({ success: false, data: null, error: "Category not found", meta: null }, 404);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: category._id,
          ...Object.fromEntries(
            Object.entries(category).filter(([k]) => k !== "_id")
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

app.put("/categories/:category_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const categoryId = c.req.param("category_id");
    const body = await c.req.json<{ name?: string; slug?: string; icon?: string; description?: string; course_count?: number }>();
    const { name, slug, icon, description, course_count } = body;

    const category = await queryOne<any>(c.env, "SELECT * FROM categories WHERE _id = ?", [categoryId]);
    if (!category) {
      return c.json({ success: false, data: null, error: "Category not found", meta: null }, 404);
    }

    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); params.push(name); }
    if (slug !== undefined) { updates.push("slug = ?"); params.push(slug); }
    if (icon !== undefined) { updates.push("icon = ?"); params.push(icon); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (course_count !== undefined) { updates.push("course_count = ?"); params.push(course_count); }

    if (updates.length > 0) {
      params.push(categoryId);
      await execute(
        c.env,
        `UPDATE categories SET ${updates.join(", ")} WHERE _id = ?`,
        params
      );
    }

    const updated = await queryOne<any>(c.env, "SELECT * FROM categories WHERE _id = ?", [categoryId]);
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

app.delete("/categories/:category_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const categoryId = c.req.param("category_id");

    const category = await queryOne<any>(c.env, "SELECT * FROM categories WHERE _id = ?", [categoryId]);
    if (!category) {
      return c.json({ success: false, data: null, error: "Category not found", meta: null }, 404);
    }

    const coursesCount = await queryOne<any>(
      c.env,
      "SELECT COUNT(*) as count FROM courses WHERE category_id = ?",
      [categoryId]
    );
    if (coursesCount && coursesCount.count > 0) {
      return c.json(
        { success: false, data: null, error: `Cannot delete category. ${coursesCount.count} course(s) are using this category.`, meta: null },
        400
      );
    }

    await execute(c.env, "DELETE FROM categories WHERE _id = ?", [categoryId]);
    return c.json(apiResponse(true, { deleted: true, category_id: categoryId }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/ai-analytics", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const stats = await query<any>(
      c.env,
      "SELECT language, COUNT(*) as count FROM code_generations GROUP BY language"
    );
    return c.json(
      apiResponse(
        true,
        { stats: stats || [] },
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

function buildMetrics(users: any[], progress: any[], subscriptions: any[], courses: any[], orders: any[]) {
  const activeSubscriptions = subscriptions.filter((s) => s.status === "active").length;
  const recent30Days = orders.filter((o) => o.created_at >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  const recent30DayRevenue = recent30Days.reduce((sum, o) => sum + (o.amount || 0), 0);

  const categoryCounts: Record<string, number> = {};
  for (const course of courses) {
    const cat = course.category_name || course.category_slug || "unknown";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0] || ["unknown", 0];

  return {
    segment: users.length,
    churn_risk_users: 0,
    active_subscriptions: activeSubscriptions,
    top_category: topCategory[0],
    top_category_count: topCategory[1],
    recent_30_day_revenue: Math.round(recent30DayRevenue * 100) / 100,
  };
}

function forecastRevenue(orders: any[], users: any[], progress: any[], subscriptions: any[], days: number) {
  const avgDaily = orders.reduce((sum, o) => sum + (o.amount || 0), 0) / 30;
  return {
    predicted_revenue: Math.round(avgDaily * days * 100) / 100,
    confidence: 0.5,
    note: "Based on historical averages",
    model: "fallback",
  };
}

function forecastNewSubscriptions(orders: any[], avgValue: number, days: number) {
  const rate = orders.length / 30;
  return {
    predicted_new_subscriptions: Math.round(rate * days),
  };
}

function forecastChurn(progress: any[], subscriptions: any[], users: any[]) {
  return {
    predicted_churn_rate: 0.05,
    churn_risk_users: [],
    model: "rule-based",
  };
}
