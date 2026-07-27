import { Hono } from "hono";
import { Env, Variables, User } from "../types";
import { hashPassword, verifyPassword, generateTokens, verifyToken, getUserPayload, buildTokenData } from "../lib/auth";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.post("/signup", async (c) => {
  try {
    const body = await c.req.json<{ email: string; password: string; name?: string }>();
    const { email, password, name } = body;
    if (!email || !password) {
      return c.json({ success: false, data: null, error: "Email and password required", meta: null }, 400);
    }

    const existing = await queryOne<User>(
      c.env,
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    if (existing) {
      return c.json({ success: false, data: null, error: "Account already exists", meta: null }, 400);
    }

    const userId = `user-${email}`;
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    await execute(
      c.env,
      "INSERT INTO users (_id, email, name, password_hash, role, phone, phone_verified, trial_active, trial_expires, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [userId, email, name || "", passwordHash, "user", null, 0, 0, null, now]
    );

    const tokens = await generateTokens(userId, email, "user", c.env.JWT_SECRET);

    c.header("Set-Cookie", `access_token=${tokens.access}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${15 * 60}`);
    c.header("Set-Cookie", `refresh_token=${tokens.refresh}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 60 * 60}`);

    return c.json({
      success: true,
      data: {
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        user: getUserPayload({ _id: userId, email, name: name || "", role: "user", created_at: now }),
      },
      error: null,
      meta: null,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/login", async (c) => {
  try {
    const body = await c.req.json<{ email: string; password: string }>();
    const { email, password } = body;

    const user = await queryOne<User>(c.env, "SELECT * FROM users WHERE email = ?", [email]);
    if (!user || !user.password_hash) {
      return c.json({ success: false, data: null, error: "Invalid credentials", meta: null }, 401);
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return c.json({ success: false, data: null, error: "Invalid credentials", meta: null }, 401);
    }

    const tokens = await generateTokens(user._id, user.email, user.role, c.env.JWT_SECRET);

    c.header("Set-Cookie", `access_token=${tokens.access}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${15 * 60}`);
    c.header("Set-Cookie", `refresh_token=${tokens.refresh}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 60 * 60}`);

    return c.json({
      success: true,
      data: {
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        user: getUserPayload(user),
      },
      error: null,
      meta: null,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/otp/request", async (c) => {
  try {
    const body = await c.req.json<{ phone: string }>();
    const { phone } = body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const sanitized = phone.replace(/[^0-9+]/g, "");
    await c.env.CACHE.put(`otp:${sanitized}`, code, { expirationTtl: 300 });
    return c.json({ success: true, data: { message: "OTP sent", phone: sanitized }, error: null, meta: null });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/otp/verify", async (c) => {
  try {
    const body = await c.req.json<{ phone: string; code: string }>();
    const { phone, code } = body;
    const sanitized = phone.replace(/[^0-9+]/g, "");
    const stored = await c.env.CACHE.get(`otp:${sanitized}`);
    if (!stored || stored !== code) {
      return c.json({ success: false, data: null, error: "Invalid or expired OTP", meta: null }, 400);
    }

    const user = await queryOne<User>(c.env, "SELECT * FROM users WHERE phone = ?", [sanitized]);
    if (!user) {
      return c.json({ success: false, data: null, error: "No account found with this phone number. Please sign up first.", meta: null }, 400);
    }

    const trialExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await execute(
      c.env,
      "UPDATE users SET phone = ?, phone_verified = ?, trial_active = ?, trial_expires = ? WHERE _id = ?",
      [sanitized, 1, 1, trialExpires, user._id]
    );
    await c.env.CACHE.delete(`otp:${sanitized}`);

    const updated = await queryOne<User>(c.env, "SELECT * FROM users WHERE _id = ?", [user._id]);
    if (!updated) {
      return c.json({ success: false, data: null, error: "User not found", meta: null }, 404);
    }
    const tokens = await generateTokens(updated._id, updated.email, updated.role, c.env.JWT_SECRET);

    c.header("Set-Cookie", `access_token=${tokens.access}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${15 * 60}`);
    c.header("Set-Cookie", `refresh_token=${tokens.refresh}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 60 * 60}`);

    return c.json({
      success: true,
      data: {
        ...getUserPayload(updated),
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        verified: true,
        trial_active: true,
        trial_expires: trialExpires,
      },
      error: null,
      meta: null,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/forgot-password", async (c) => {
  try {
    const body = await c.req.json<{ email: string }>();
    const { email } = body;
    const user = await queryOne<User>(c.env, "SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      return c.json({ success: true, data: { message: "If the account exists, a reset email was sent." }, error: null, meta: null });
    }

    const token = generateResetToken();
    await c.env.CACHE.put(`pwdreset:${email}:${token}`, "1", { expirationTtl: 900 });
    return c.json({ success: true, data: { message: "If the account exists, a reset email was sent." }, error: null, meta: null });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/reset-password", async (c) => {
  try {
    const body = await c.req.json<{ email: string; token: string; new_password: string }>();
    const { email, token, new_password } = body;
    const stored = await c.env.CACHE.get(`pwdreset:${email}:${token}`);
    if (!stored) {
      return c.json({ success: false, data: null, error: "Invalid or expired token", meta: null }, 400);
    }

    const user = await queryOne<User>(c.env, "SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      return c.json({ success: false, data: null, error: "Invalid or expired token", meta: null }, 400);
    }

    const newHash = await hashPassword(new_password);
    await execute(c.env, "UPDATE users SET password_hash = ? WHERE _id = ?", [newHash, user._id]);
    await c.env.CACHE.delete(`pwdreset:${email}:${token}`);
    return c.json({ success: true, data: { message: "Password updated" }, error: null, meta: null });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/google", async (c) => {
  try {
    const body = await c.req.json<{ token: string }>();
    const { token } = body;
    return c.json({ success: false, data: null, error: "Google auth requires server-side verification", meta: null }, 501);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/refresh", async (c) => {
  try {
    const cookieHeader = c.req.header("cookie") || "";
    const match = cookieHeader.match(/refresh_token=([^;]+)/);
    const refreshToken = match ? match[1] : null;
    if (!refreshToken) {
      return c.json({ success: false, data: null, error: "Missing refresh token", meta: null }, 401);
    }

    const payload = await verifyToken(refreshToken, c.env.JWT_SECRET);
    if (!payload || payload.type !== "refresh") {
      return c.json({ success: false, data: null, error: "Invalid refresh token", meta: null }, 401);
    }

    const revoked = await c.env.CACHE.get(`revoked:${refreshToken}`);
    if (revoked) {
      return c.json({ success: false, data: null, error: "Refresh token revoked", meta: null }, 401);
    }

    const user = await queryOne<User>(c.env, "SELECT * FROM users WHERE _id = ?", [payload.sub]);
    if (!user) {
      return c.json({ success: false, data: null, error: "User not found", meta: null }, 401);
    }

    const tokens = await generateTokens(user._id, user.email, user.role, c.env.JWT_SECRET);

    c.header("Set-Cookie", `access_token=${tokens.access}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${15 * 60}`);
    c.header("Set-Cookie", `refresh_token=${tokens.refresh}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=${30 * 24 * 60 * 60}`);

    return c.json({
      success: true,
      data: {
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        user: getUserPayload(user),
      },
      error: null,
      meta: null,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/logout", (c) => {
  c.header("Set-Cookie", "access_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  c.header("Set-Cookie", "refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=0");
  return c.json({ success: true, data: { message: "Logged out" }, error: null, meta: null });
});

app.get("/me", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }

    const dbUser = await queryOne<User>(c.env, "SELECT * FROM users WHERE _id = ?", [user.sub]);
    if (!dbUser) {
      return c.json({ success: false, data: null, error: "User not found", meta: null }, 404);
    }

    return c.json({ success: true, data: getUserPayload(dbUser), error: null, meta: null });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.put("/me", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }

    const body = await c.req.json<{ name?: string }>();
    const updates: string[] = [];
    const params: any[] = [];

    if (body.name !== undefined) {
      updates.push("name = ?");
      params.push(body.name);
    }

    if (updates.length > 0) {
      params.push(user.sub);
      await execute(
        c.env,
        `UPDATE users SET ${updates.join(", ")} WHERE _id = ?`,
        params
      );
    }

    const updated = await queryOne<User>(c.env, "SELECT * FROM users WHERE _id = ?", [user.sub]);
    if (!updated) {
      return c.json({ success: false, data: null, error: "User not found", meta: null }, 404);
    }

    return c.json({ success: true, data: getUserPayload(updated), error: null, meta: null });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.put("/me/password", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }

    const body = await c.req.json<{ old_password: string; new_password: string }>();
    const { old_password, new_password } = body;

    const dbUser = await queryOne<User>(c.env, "SELECT * FROM users WHERE _id = ?", [user.sub]);
    if (!dbUser) {
      return c.json({ success: false, data: null, error: "User not found", meta: null }, 404);
    }

    if (dbUser.password_hash && !(await verifyPassword(old_password, dbUser.password_hash))) {
      return c.json({ success: false, data: null, error: "Incorrect current password", meta: null }, 400);
    }

    const newHash = await hashPassword(new_password);
    await execute(c.env, "UPDATE users SET password_hash = ? WHERE _id = ?", [newHash, user.sub]);
    return c.json({ success: true, data: { message: "Password updated" }, error: null, meta: null });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

function generateResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default app;
