import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_TOKENS_PER_HOUR = 10;
const userTokenCount: Record<string, number[]> = {};

function cleanupUserTokens(userId: string): number[] {
  const now = Date.now() / 1000;
  const tokens = userTokenCount[userId] || [];
  const recent = tokens.filter((t) => t > now - 3600);
  userTokenCount[userId] = recent;
  return recent;
}

function trialUnlockedCount(course: any): number {
  return Math.max(1, Math.ceil((course.syllabus || []).length * 0.1));
}

function trialActive(user: any): boolean {
  if (!user.trial_active) return false;
  const expires = user.trial_expires;
  if (!expires) return false;
  try {
    const expiresDate = new Date(expires);
    if (isNaN(expiresDate.getTime())) return false;
    return Date.now() < expiresDate.getTime();
  } catch {
    return false;
  }
}

async function hasAccess(
  env: Env,
  user: any,
  course: any,
  lessonIndex: number
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (trialActive(user) && lessonIndex < trialUnlockedCount(course)) {
    return true;
  }
  const sub = await queryOne<any>(
    env,
    "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'",
    [user._id]
  );
  if (!sub) return false;
  try {
    const endsAt = new Date(sub.ends_at);
    if (isNaN(endsAt.getTime())) return false;
    return Date.now() < endsAt.getTime();
  } catch {
    return false;
  }
}

app.get("/stream", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }

    const token = authHeader.slice(7);
    const payload = c.get("user");
    if (!payload) {
      return c.json({ success: false, data: null, error: "Invalid token", meta: null }, 401);
    }

    const streamToken = c.req.query("token");
    if (!streamToken) {
      return c.json({ success: false, data: null, error: "Stream token required", meta: null }, 400);
    }

    const lessonId = await c.env.CACHE.get(`stream:${streamToken}`);
    if (!lessonId) {
      return c.json({ success: false, data: null, error: "Invalid or expired stream token", meta: null }, 401);
    }

    const video = await c.env.R2_BUCKET.get(`videos/${lessonId}.mp4`);
    if (!video) {
      return c.json({ success: false, data: null, error: "Video not found", meta: null }, 404);
    }

    return new Response(video.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/lessons/:lesson_id/stream-token", async (c) => {
  try {
    const lessonId = c.req.param("lesson_id");
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }

    const courses = await query<any>(c.env, "SELECT * FROM courses");
    let course: any = null;
    let lesson: any = null;
    let lessonIndex = -1;

    for (const c of courses) {
      const syllabus = c.syllabus || [];
      for (let i = 0; i < syllabus.length; i++) {
        if (syllabus[i].id === lessonId) {
          course = c;
          lesson = syllabus[i];
          lessonIndex = i;
          break;
        }
      }
      if (course) break;
    }

    if (!course || !lesson) {
      return c.json({ success: false, data: null, error: "Lesson not found", meta: null }, 404);
    }

    const dbUser = await queryOne<any>(c.env, "SELECT * FROM users WHERE _id = ?", [user.sub]);
    if (!dbUser) {
      return c.json({ success: false, data: null, error: "User not found", meta: null }, 404);
    }

    if (!(await hasAccess(c.env, dbUser, course, lessonIndex))) {
      return c.json({ success: false, data: null, error: "Subscription or trial required", meta: null }, 403);
    }

    const userTokens = cleanupUserTokens(user.sub);
    if (userTokens.length >= MAX_TOKENS_PER_HOUR) {
      return c.json(
        { success: false, data: null, error: `Rate limit exceeded. Max ${MAX_TOKENS_PER_HOUR} tokens per hour.`, meta: null },
        429
      );
    }

    const r2Key = lesson.r2_key || lesson.drive_file_id;
    if (!r2Key) {
      return c.json({ success: false, data: null, error: "No video file associated with this lesson", meta: null }, 404);
    }

    const streamToken = `stream-${lessonId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await c.env.CACHE.put(`stream:${streamToken}`, lessonId, {
      expirationTtl: 3600,
    });

    userTokenCount[user.sub] = [...userTokens, Date.now() / 1000];

    return c.json(
      apiResponse(
        true,
        { stream_token: streamToken, lesson_id: lessonId },
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
