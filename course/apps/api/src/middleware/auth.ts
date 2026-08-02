import { Env } from "../types";
import { verifyToken, getUserPayload } from "../lib/auth";
import { errorResponse } from "../lib/db";

export async function authMiddleware(
  c: any,
  next: () => Promise<void>
) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ") && !c.req.cookie?.("access_token")) {
    return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
  }

  let token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : c.req.cookie("access_token");

  if (!token) {
    return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, data: null, error: "Invalid token", meta: null }, 401);
  }

  c.set("user", payload);
  await next();
}

export function getCurrentUser(c: any) {
  return c.get("user");
}

export async function optionalAuthMiddleware(
  c: any,
  next: () => Promise<void>
) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ") && !c.req.cookie?.("access_token")) {
    c.set("user", null);
    await next();
    return;
  }

  let token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : c.req.cookie("access_token");

  if (!token) {
    c.set("user", null);
    await next();
    return;
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  c.set("user", payload);
  await next();
}
