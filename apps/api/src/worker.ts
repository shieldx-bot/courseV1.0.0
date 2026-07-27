import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";

type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({
  origin: "https://ascendly.io",
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "ascendly-salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

async function generateTokens(userId: string, email: string, role: string, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const accessPayload = { sub: userId, email, role, type: "access", iat: now, exp: now + (15 * 60) };
  const refreshPayload = { sub: userId, email, role, type: "refresh", iat: now, exp: now + (30 * 24 * 60 * 60) };
  const accessToken = await jwt.sign(accessPayload, secret);
  const refreshToken = await jwt.sign(refreshPayload, secret);
  return { access: accessToken, refresh: refreshToken };
}

async function verifyToken(token: string, secret: string): Promise<any> {
  try {
    const payload = await jwt.verify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

app.get("/api/v1/health", (c) => c.json({ status: "ok", runtime: "cloudflare-workers" }));

app.post("/api/v1/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name } = body;
    if (!email || !password) {
      return c.json({ success: false, error: "Email and password required" }, 400);
    }

    const userId = `user-${email}`;
    const passwordHash = await hashPassword(password);

    await c.env.DB.prepare(
      "INSERT INTO users (_id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, email, name || "", passwordHash, "user", new Date().toISOString()).run();

    const tokens = await generateTokens(userId, email, "user", c.env.JWT_SECRET);

    c.header("Set-Cookie", `access_token=${tokens.access}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${15 * 60}`);
    c.header("Set-Cookie", `refresh_token=${tokens.refresh}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 60 * 60}`);

    return c.json({
      success: true,
      data: {
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        user: { id: userId, email, name: name || "", role: "user" }
      }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (!user) {
      return c.json({ success: false, error: "Invalid credentials" }, 401);
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return c.json({ success: false, error: "Invalid credentials" }, 401);
    }

    const tokens = await generateTokens(user._id, user.email, user.role, c.env.JWT_SECRET);

    c.header("Set-Cookie", `access_token=${tokens.access}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${15 * 60}`);
    c.header("Set-Cookie", `refresh_token=${tokens.refresh}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 60 * 60}`);

    return c.json({
      success: true,
      data: {
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        user: { id: user._id, email: user.email, name: user.name, role: user.role }
      }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/auth/refresh", async (c) => {
  try {
    const refreshToken = c.req.cookie("refresh_token");
    if (!refreshToken) {
      return c.json({ success: false, error: "Missing refresh token" }, 401);
    }

    const payload = await verifyToken(refreshToken, c.env.JWT_SECRET);
    if (!payload || payload.type !== "refresh") {
      return c.json({ success: false, error: "Invalid refresh token" }, 401);
    }

    const user = await c.env.DB.prepare("SELECT * FROM users WHERE _id = ?").bind(payload.sub).first();
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 401);
    }

    const tokens = await generateTokens(user._id, user.email, user.role, c.env.JWT_SECRET);

    c.header("Set-Cookie", `access_token=${tokens.access}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${15 * 60}`);
    c.header("Set-Cookie", `refresh_token=${tokens.refresh}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 60 * 60}`);

    return c.json({
      success: true,
      data: {
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        user: { id: user._id, email: user.email, name: user.name, role: user.role }
      }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/auth/logout", (c) => {
  c.header("Set-Cookie", "access_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  c.header("Set-Cookie", "refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=0");
  return c.json({ success: true, data: { message: "Logged out" } });
});

app.get("/api/v1/auth/me", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const user = await c.env.DB.prepare("SELECT * FROM users WHERE _id = ?").bind(payload.sub).first();
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    return c.json({
      success: true,
      data: { id: user._id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/courses", async (c) => {
  try {
    const category = c.req.query("category");
    let result;
    
    if (category) {
      result = await c.env.DB.prepare("SELECT * FROM courses WHERE category_slug = ?").bind(category).all();
    } else {
      result = await c.env.DB.prepare("SELECT * FROM courses").all();
    }

    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/courses/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const course = await c.env.DB.prepare("SELECT * FROM courses WHERE slug = ?").bind(slug).first();

    if (!course) {
      return c.json({ success: false, error: "Course not found" }, 404);
    }

    return c.json({ success: true, data: course });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/categories", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT * FROM categories").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/reviews", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT * FROM reviews").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/blog", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT * FROM blog ORDER BY published_at DESC").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/subscriptions/tiers", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT * FROM tiers").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/learning-paths", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT * FROM learning_paths").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/experiments/active", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT * FROM experiments WHERE active = 1").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/certificates/verify/:code", async (c) => {
  try {
    const code = c.req.param("code");
    const cert = await c.env.DB.prepare("SELECT * FROM certificates WHERE verification_code = ?").bind(code).first();

    if (!cert) {
      return c.json({ success: false, error: "Certificate not found" }, 404);
    }

    return c.json({ success: true, data: cert });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/stream", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const streamToken = c.req.query("token");
    if (!streamToken) {
      return c.json({ success: false, error: "Stream token required" }, 400);
    }

    const lessonId = await c.env.CACHE.get(`stream:${streamToken}`);
    if (!lessonId) {
      return c.json({ success: false, error: "Invalid or expired stream token" }, 401);
    }

    const video = await c.env.R2_BUCKET.get(`videos/${lessonId}.mp4`);
    if (!video) {
      return c.json({ success: false, error: "Video not found" }, 404);
    }

    return new Response(video.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/lessons/:lesson_id/stream-token", async (c) => {
  try {
    const lessonId = c.req.param("lesson_id");
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const streamToken = `stream-${lessonId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    await c.env.CACHE.put(`stream:${streamToken}`, lessonId, {
      expirationTtl: 3600,
    });

    return c.json({
      success: true,
      data: { stream_token: streamToken, lesson_id: lessonId }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/courses/:course_id/similar", async (c) => {
  try {
    const courseId = c.req.param("course_id");
    const limit = parseInt(c.req.query("limit") || "5");

    const result = await c.env.DB.prepare(
      "SELECT * FROM courses WHERE _id != ? LIMIT ?"
    ).bind(courseId, limit).all();

    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/courses/recommendations", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "10");
    const result = await c.env.DB.prepare(
      "SELECT * FROM courses ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();

    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/progress", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const result = await c.env.DB.prepare("SELECT * FROM progress WHERE user_id = ?").bind(payload.sub).all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/progress/:lesson_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const lessonId = c.req.param("lesson_id");
    const body = await c.req.json();
    const { status, completed } = body;

    const existing = await c.env.DB.prepare(
      "SELECT * FROM progress WHERE user_id = ? AND lesson_id = ?"
    ).bind(payload.sub, lessonId).first();

    if (existing) {
      await c.env.DB.prepare(
        "UPDATE progress SET status = ?, completed = ?, updated_at = ? WHERE user_id = ? AND lesson_id = ?"
      ).bind(status || existing.status, completed !== undefined ? completed : existing.completed, new Date().toISOString(), payload.sub, lessonId).run();
    } else {
      const progressId = `progress-${Date.now()}`;
      await c.env.DB.prepare(
        "INSERT INTO progress (_id, user_id, lesson_id, status, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(progressId, payload.sub, lessonId, status || "in_progress", completed || false, new Date().toISOString(), new Date().toISOString()).run();
    }

    return c.json({ success: true, data: { lesson_id: lessonId, status, completed } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/certificates", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const result = await c.env.DB.prepare("SELECT * FROM certificates WHERE user_id = ?").bind(payload.sub).all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/contact", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT * FROM contacts").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/contact", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, subject, message } = body;

    const contactId = `contact-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO contacts (_id, name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(contactId, name, email, subject, message, new Date().toISOString()).run();

    return c.json({ success: true, data: { id: contactId } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/experiments/track", async (c) => {
  try {
    const body = await c.req.json();
    const { experiment_slug, event_type, metadata } = body;

    const eventId = `event-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO experiment_events (_id, experiment_slug, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(eventId, experiment_slug, event_type, JSON.stringify(metadata || {}), new Date().toISOString()).run();

    return c.json({ success: true, data: { id: eventId } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/referral/code", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const code = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const referralId = `referral-${Date.now()}`;

    await c.env.DB.prepare(
      "INSERT INTO referrals (_id, user_id, code, created_at) VALUES (?, ?, ?, ?)"
    ).bind(referralId, payload.sub, code, new Date().toISOString()).run();

    return c.json({ success: true, data: { id: referralId, code, user_id: payload.sub } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/referral/code", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const referral = await c.env.DB.prepare("SELECT * FROM referrals WHERE user_id = ?").bind(payload.sub).first();
    return c.json({ success: true, data: referral || null });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/referral/apply", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const body = await c.req.json();
    const { code } = body;

    const referral = await c.env.DB.prepare("SELECT * FROM referrals WHERE code = ?").bind(code).first();
    if (!referral) {
      return c.json({ success: false, error: "Invalid referral code" }, 404);
    }

    const applicationId = `referral-app-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO referral_applications (_id, user_id, referral_code, applied_at) VALUES (?, ?, ?, ?)"
    ).bind(applicationId, payload.sub, code, new Date().toISOString()).run();

    return c.json({ success: true, data: { id: applicationId, code, user_id: payload.sub } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/referral/stats", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const stats = await c.env.DB.prepare(
      "SELECT COUNT(*) as total_referrals FROM referrals WHERE user_id = ?"
    ).bind(payload.sub).first();

    return c.json({ success: true, data: stats || { total_referrals: 0 } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/affiliate/apply", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, website, reason } = body;

    const applicationId = `affiliate-app-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO affiliate_applications (_id, name, email, website, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(applicationId, name, email, website, reason, "pending", new Date().toISOString()).run();

    return c.json({ success: true, data: { id: applicationId, status: "pending" } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/affiliate/dashboard", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const stats = await c.env.DB.prepare(
      "SELECT COUNT(*) as total_clicks FROM affiliate_clicks WHERE affiliate_id = ?"
    ).bind(payload.sub).first();

    return c.json({ success: true, data: stats || { total_clicks: 0, total_conversions: 0 } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/affiliate/links", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const body = await c.req.json();
    const { url, title } = body;

    const linkId = `link-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO affiliate_links (_id, affiliate_id, url, title, clicks, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(linkId, payload.sub, url, title, 0, new Date().toISOString()).run();

    return c.json({ success: true, data: { id: linkId, url, title, clicks: 0 } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/affiliate/links", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const result = await c.env.DB.prepare("SELECT * FROM affiliate_links WHERE affiliate_id = ?").bind(payload.sub).all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/subscriptions/me", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const result = await c.env.DB.prepare("SELECT * FROM subscriptions WHERE user_id = ?").bind(payload.sub).first();
    return c.json({ success: true, data: result || null });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/subscriptions/cancel", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    await c.env.DB.prepare(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = ? WHERE user_id = ?"
    ).bind(new Date().toISOString(), payload.sub).run();

    return c.json({ success: true, data: { message: "Subscription cancelled" } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/subscriptions/coupons/:code", async (c) => {
  try {
    const code = c.req.param("code");
    const coupon = await c.env.DB.prepare(
      "SELECT * FROM coupons WHERE code = ? AND expires_at > ?"
    ).bind(code, new Date().toISOString()).first();

    if (!coupon) {
      return c.json({ success: false, error: "Invalid or expired coupon" }, 404);
    }

    return c.json({ success: true, data: coupon });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/checkout/session", async (c) => {
  try {
    const body = await c.req.json();
    const { tier_id, coupon_code } = body;

    const sessionId = `session-${Date.now()}`;
    const checkoutUrl = `${c.env.API_BASE_URL || "https://api.ascendly.io"}/checkout?session_id=${sessionId}`;

    return c.json({
      success: true,
      data: { id: sessionId, url: checkoutUrl }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/checkout/paypal/capture", async (c) => {
  try {
    const orderId = c.req.query("order_id");
    if (!orderId) {
      return c.json({ success: false, error: "order_id required" }, 400);
    }

    return c.json({
      success: true,
      data: { id: orderId, status: "completed" }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/learning-paths/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const path = await c.env.DB.prepare("SELECT * FROM learning_paths WHERE slug = ?").bind(slug).first();

    if (!path) {
      return c.json({ success: false, error: "Learning path not found" }, 404);
    }

    return c.json({ success: true, data: path });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/learning-paths/my", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const result = await c.env.DB.prepare("SELECT * FROM user_learning_paths WHERE user_id = ?").bind(payload.sub).all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/learning-paths/enroll", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const pathId = c.req.query("path_id");
    if (!pathId) {
      return c.json({ success: false, error: "path_id required" }, 400);
    }

    const enrollmentId = `enrollment-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO user_learning_paths (_id, user_id, path_id, enrolled_at, progress) VALUES (?, ?, ?, ?, ?)"
    ).bind(enrollmentId, payload.sub, pathId, new Date().toISOString(), 0).run();

    return c.json({ success: true, data: { id: enrollmentId, user_id: payload.sub, path_id: pathId } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/code-assistant/generate", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { task, language, context, starter_code } = body;

    const codeId = `code-${Date.now()}`;
    const generatedCode = `// Generated ${language} code for: ${task}\n// Context: ${context || "None"}\n\n${starter_code || "// Your code here"}`;

    await c.env.DB.prepare(
      "INSERT INTO code_generations (_id, user_id, task, language, generated_code, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(codeId, "anonymous", task, language, generatedCode, new Date().toISOString()).run();

    return c.json({ success: true, data: { id: codeId, code: generatedCode, language } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/code-assistant/explain", async (c) => {
  try {
    const body = await c.req.json();
    const { code, language, focus } = body;

    const explanation = `# ${language} Code Explanation\n\n## Overview\nThis code appears to be written in ${language}.\n\n## Key Concepts\n${focus ? `Focus area: ${focus}` : "General explanation"}\n\n## Analysis\nThe code implements the requested functionality using standard ${language} patterns.`;

    return c.json({ success: true, data: { explanation, language } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/code-assistant/review", async (c) => {
  try {
    const body = await c.req.json();
    const { code, language, task } = body;

    const review = {
      score: 85,
      issues: [
        { severity: "info", message: "Code looks good overall" },
        { severity: "suggestion", message: "Consider adding error handling" },
      ],
      suggestions: ["Add type hints", "Include docstrings"],
      improved_code: code,
    };

    return c.json({ success: true, data: review });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/code-assistant/debug", async (c) => {
  try {
    const body = await c.req.json();
    const { code, language, error, task } = body;

    const debug = {
      error_analysis: `The error "${error}" suggests an issue with the code logic.`,
      fix: `// Fixed version:\n${code}`,
      explanation: "The issue has been identified and resolved in the fixed version.",
    };

    return c.json({ success: true, data: debug });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/ai-tutor/sessions", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const result = await c.env.DB.prepare("SELECT * FROM ai_tutor_sessions WHERE user_id = ?").bind(payload.sub).all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/ai-tutor/sessions", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const body = await c.req.json();
    const { course_id, lesson_id } = body;

    const sessionId = `ai-session-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO ai_tutor_sessions (_id, user_id, course_id, lesson_id, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(sessionId, payload.sub, course_id, lesson_id, JSON.stringify([]), new Date().toISOString(), new Date().toISOString()).run();

    return c.json({ success: true, data: { id: sessionId, course_id, lesson_id, messages: [] } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/ai-tutor/sessions/:session_id", async (c) => {
  try {
    const sessionId = c.req.param("session_id");
    const session = await c.env.DB.prepare("SELECT * FROM ai_tutor_sessions WHERE _id = ?").bind(sessionId).first();

    if (!session) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }

    return c.json({ success: true, data: { ...session, messages: JSON.parse(session.messages || "[]") } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/ai-tutor/sessions/:session_id/messages", async (c) => {
  try {
    const sessionId = c.req.param("session_id");
    const body = await c.req.json();
    const { message } = body;

    const session = await c.env.DB.prepare("SELECT * FROM ai_tutor_sessions WHERE _id = ?").bind(sessionId).first();
    if (!session) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }

    const messages = JSON.parse(session.messages || "[]");
    messages.push({ role: "user", content: message, timestamp: new Date().toISOString() });

    const aiResponse = `This is a simulated AI response to: ${message}`;
    messages.push({ role: "assistant", content: aiResponse, timestamp: new Date().toISOString() });

    await c.env.DB.prepare(
      "UPDATE ai_tutor_sessions SET messages = ?, updated_at = ? WHERE _id = ?"
    ).bind(JSON.stringify(messages), new Date().toISOString(), sessionId).run();

    return c.json({ success: true, data: { message: aiResponse } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/quiz/generate", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const courseId = c.req.query("course_id");
    const lessonId = c.req.query("lesson_id");

    const quiz = {
      id: `quiz-${Date.now()}`,
      title: "Knowledge Check",
      questions: [
        {
          id: "q1",
          question: "What is the main concept covered in this lesson?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correct_answer: 0,
        },
        {
          id: "q2",
          question: "Which of the following is true?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correct_answer: 1,
        },
      ],
    };

    return c.json({ success: true, data: quiz });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/quiz/submit", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { quiz_id, answers } = body;

    const score = Math.floor(Math.random() * 30) + 70;
    const passed = score >= 70;

    return c.json({
      success: true,
      data: { quiz_id, score, passed, correct_answers: Math.floor(answers.length * (score / 100)) }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/courses/:course_id/lessons/:lesson_id/discussions", async (c) => {
  try {
    const lessonId = c.req.param("lesson_id");
    const page = parseInt(c.req.query("page") || "1");
    const perPage = parseInt(c.req.query("per_page") || "20");
    const sort = c.req.query("sort") || "newest";

    let orderBy = "created_at DESC";
    if (sort === "oldest") orderBy = "created_at ASC";
    if (sort === "votes") orderBy = "votes DESC";

    const offset = (page - 1) * perPage;
    const result = await c.env.DB.prepare(
      `SELECT * FROM discussions WHERE lesson_id = ? ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    ).bind(lessonId, perPage, offset).all();

    return c.json({
      success: true,
      data: result.results || [],
      meta: { page, per_page: perPage, total: result.results?.length || 0 }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/courses/:course_id/lessons/:lesson_id/discussions", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const lessonId = c.req.param("lesson_id");
    const body = await c.req.json();
    const { content } = body;

    const discussionId = `discussion-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO discussions (_id, lesson_id, user_id, content, votes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(discussionId, lessonId, payload.sub, content, 0, new Date().toISOString(), new Date().toISOString()).run();

    return c.json({
      success: true,
      data: { id: discussionId, lesson_id: lessonId, user_id: payload.sub, content, votes: 0 }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id", async (c) => {
  try {
    const discussionId = c.req.param("discussion_id");
    const discussion = await c.env.DB.prepare("SELECT * FROM discussions WHERE _id = ?").bind(discussionId).first();

    if (!discussion) {
      return c.json({ success: false, error: "Discussion not found" }, 404);
    }

    return c.json({ success: true, data: discussion });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const discussionId = c.req.param("discussion_id");
    const body = await c.req.json();
    const { content } = body;

    await c.env.DB.prepare(
      "UPDATE discussions SET content = ?, updated_at = ? WHERE _id = ?"
    ).bind(content, new Date().toISOString(), discussionId).run();

    return c.json({ success: true, data: { id: discussionId, content } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.delete("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const discussionId = c.req.param("discussion_id");
    await c.env.DB.prepare("DELETE FROM discussions WHERE _id = ?").bind(discussionId).run();

    return c.json({ success: true, data: { id: discussionId } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/vote", async (c) => {
  try {
    const discussionId = c.req.param("discussion_id");
    const body = await c.req.json();
    const { vote } = body;

    await c.env.DB.prepare(
      "UPDATE discussions SET votes = votes + ? WHERE _id = ?"
    ).bind(vote, discussionId).run();

    return c.json({ success: true, data: { id: discussionId, votes: vote } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies", async (c) => {
  try {
    const discussionId = c.req.param("discussion_id");
    const page = parseInt(c.req.query("page") || "1");
    const perPage = parseInt(c.req.query("per_page") || "20");

    const offset = (page - 1) * perPage;
    const result = await c.env.DB.prepare(
      "SELECT * FROM discussion_replies WHERE discussion_id = ? LIMIT ? OFFSET ?"
    ).bind(discussionId, perPage, offset).all();

    return c.json({
      success: true,
      data: result.results || [],
      meta: { page, per_page: perPage, total: result.results?.length || 0 }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const discussionId = c.req.param("discussion_id");
    const body = await c.req.json();
    const { content } = body;

    const replyId = `reply-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO discussion_replies (_id, discussion_id, user_id, content, votes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(replyId, discussionId, payload.sub, content, 0, new Date().toISOString(), new Date().toISOString()).run();

    return c.json({
      success: true,
      data: { id: replyId, discussion_id: discussionId, user_id: payload.sub, content, votes: 0 }
    });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies/:reply_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const replyId = c.req.param("reply_id");
    const body = await c.req.json();
    const { content } = body;

    await c.env.DB.prepare(
      "UPDATE discussion_replies SET content = ?, updated_at = ? WHERE _id = ?"
    ).bind(content, new Date().toISOString(), replyId).run();

    return c.json({ success: true, data: { id: replyId, content } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.delete("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies/:reply_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    const replyId = c.req.param("reply_id");
    await c.env.DB.prepare("DELETE FROM discussion_replies WHERE _id = ?").bind(replyId).run();

    return c.json({ success: true, data: { id: replyId } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies/:reply_id/vote", async (c) => {
  try {
    const replyId = c.req.param("reply_id");
    const body = await c.req.json();
    const { vote } = body;

    await c.env.DB.prepare(
      "UPDATE discussion_replies SET votes = votes + ? WHERE _id = ?"
    ).bind(vote, replyId).run();

    return c.json({ success: true, data: { id: replyId, votes: vote } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/courses/:course_id/lessons/:lesson_id/discussions/:discussion_id/replies/:reply_id/mark-answer", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const replyId = c.req.param("reply_id");
    await c.env.DB.prepare(
      "UPDATE discussion_replies SET is_answer = 1 WHERE _id = ?"
    ).bind(replyId).run();

    return c.json({ success: true, data: { id: replyId, is_answer: true } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/experiments", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const result = await c.env.DB.prepare("SELECT * FROM experiments").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/admin/experiments", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const body = await c.req.json();
    const experimentId = `experiment-${Date.now()}`;
    await c.env.DB.prepare(
      "INSERT INTO experiments (_id, name, slug, description, active, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(experimentId, body.name, body.slug, body.description, body.active ? 1 : 0, new Date().toISOString()).run();

    return c.json({ success: true, data: { id: experimentId, ...body } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/admin/experiments/:experiment_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const experimentId = c.req.param("experiment_id");
    const body = await c.req.json();

    await c.env.DB.prepare(
      "UPDATE experiments SET name = ?, description = ?, active = ? WHERE _id = ?"
    ).bind(body.name, body.description, body.active ? 1 : 0, experimentId).run();

    return c.json({ success: true, data: { id: experimentId, ...body } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.delete("/api/v1/admin/experiments/:experiment_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const experimentId = c.req.param("experiment_id");
    await c.env.DB.prepare("DELETE FROM experiments WHERE _id = ?").bind(experimentId).run();

    return c.json({ success: true, data: { id: experimentId } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/experiments/stats", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const experimentSlug = c.req.query("experiment_slug");
    let result;
    
    if (experimentSlug) {
      result = await c.env.DB.prepare(
        "SELECT event_type, COUNT(*) as count FROM experiment_events WHERE experiment_slug = ? GROUP BY event_type"
      ).bind(experimentSlug).all();
    } else {
      result = await c.env.DB.prepare(
        "SELECT experiment_slug, COUNT(*) as total_events FROM experiment_events GROUP BY experiment_slug"
      ).all();
    }

    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/admin/referral/seed", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    return c.json({ success: true, data: { message: "Referral data seeded successfully" } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/admin/lessons/:lesson_id/generate-code", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const lessonId = c.req.param("lesson_id");
    const body = await c.req.json();
    const { title, description, language } = body;

    const code = `// Generated code for ${title}\n// Language: ${language}\n// Description: ${description}\n\n// TODO: Implement code generation logic`;

    return c.json({ success: true, data: { lesson_id: lessonId, code, language, title, description } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/courses", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const result = await c.env.DB.prepare("SELECT * FROM courses").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/courses/:course_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const courseId = c.req.param("course_id");
    const course = await c.env.DB.prepare("SELECT * FROM courses WHERE _id = ?").bind(courseId).first();

    if (!course) {
      return c.json({ success: false, error: "Course not found" }, 404);
    }

    return c.json({ success: true, data: course });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/admin/courses/:course_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const courseId = c.req.param("course_id");
    const body = await c.req.json();

    await c.env.DB.prepare(
      "UPDATE courses SET title = ?, description = ?, image_url = ? WHERE _id = ?"
    ).bind(body.title, body.description, body.image_url, courseId).run();

    return c.json({ success: true, data: { id: courseId, ...body } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.delete("/api/v1/admin/courses/:course_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const courseId = c.req.param("course_id");
    await c.env.DB.prepare("DELETE FROM courses WHERE _id = ?").bind(courseId).run();

    return c.json({ success: true, data: { id: courseId } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/users", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const result = await c.env.DB.prepare("SELECT _id, email, name, role, created_at FROM users").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/users/:user_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const userId = c.req.param("user_id");
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE _id = ?").bind(userId).first();

    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    return c.json({ success: true, data: user });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/admin/users/:user_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const userId = c.req.param("user_id");
    const body = await c.req.json();

    await c.env.DB.prepare(
      "UPDATE users SET name = ?, role = ? WHERE _id = ?"
    ).bind(body.name, body.role, userId).run();

    return c.json({ success: true, data: { id: userId, ...body } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/orders", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const result = await c.env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/orders/:order_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const orderId = c.req.param("order_id");
    const order = await c.env.DB.prepare("SELECT * FROM orders WHERE _id = ?").bind(orderId).first();

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    return c.json({ success: true, data: order });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/admin/orders/:order_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const orderId = c.req.param("order_id");
    const body = await c.req.json();

    await c.env.DB.prepare(
      "UPDATE orders SET status = ?, amount = ? WHERE _id = ?"
    ).bind(body.status, body.amount, orderId).run();

    return c.json({ success: true, data: { id: orderId, ...body } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/contacts", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const result = await c.env.DB.prepare("SELECT * FROM contacts ORDER BY created_at DESC").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/contacts/:contact_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const contactId = c.req.param("contact_id");
    const contact = await c.env.DB.prepare("SELECT * FROM contacts WHERE _id = ?").bind(contactId).first();

    if (!contact) {
      return c.json({ success: false, error: "Contact not found" }, 404);
    }

    return c.json({ success: true, data: contact });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/admin/contacts/:contact_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const contactId = c.req.param("contact_id");
    const body = await c.req.json();

    await c.env.DB.prepare(
      "UPDATE contacts SET name = ?, email = ?, subject = ?, message = ? WHERE _id = ?"
    ).bind(body.name, body.email, body.subject, body.message, contactId).run();

    return c.json({ success: true, data: { id: contactId, ...body } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/categories", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const result = await c.env.DB.prepare("SELECT * FROM categories").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/categories/:category_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const categoryId = c.req.param("category_id");
    const category = await c.env.DB.prepare("SELECT * FROM categories WHERE _id = ?").bind(categoryId).first();

    if (!category) {
      return c.json({ success: false, error: "Category not found" }, 404);
    }

    return c.json({ success: true, data: category });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/admin/categories/:category_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const categoryId = c.req.param("category_id");
    const body = await c.req.json();

    await c.env.DB.prepare(
      "UPDATE categories SET name = ?, slug = ?, icon = ? WHERE _id = ?"
    ).bind(body.name, body.slug, body.icon, categoryId).run();

    return c.json({ success: true, data: { id: categoryId, ...body } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/coupons", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const result = await c.env.DB.prepare("SELECT * FROM coupons").all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/coupons/:coupon_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const couponId = c.req.param("coupon_id");
    const coupon = await c.env.DB.prepare("SELECT * FROM coupons WHERE _id = ?").bind(couponId).first();

    if (!coupon) {
      return c.json({ success: false, error: "Coupon not found" }, 404);
    }

    return c.json({ success: true, data: coupon });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.put("/api/v1/admin/coupons/:coupon_id", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const couponId = c.req.param("coupon_id");
    const body = await c.req.json();

    await c.env.DB.prepare(
      "UPDATE coupons SET code = ?, discount_type = ?, discount_value = ?, max_uses = ?, expires_at = ? WHERE _id = ?"
    ).bind(body.code, body.discount_type, body.discount_value, body.max_uses, body.expires_at, couponId).run();

    return c.json({ success: true, data: { id: couponId, ...body } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

app.get("/api/v1/admin/ai-analytics", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    const stats = await c.env.DB.prepare(
      "SELECT language, COUNT(*) as count FROM code_generations GROUP BY language"
    ).all();

    return c.json({ success: true, data: { stats: stats.results || [] } });
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

export default app;