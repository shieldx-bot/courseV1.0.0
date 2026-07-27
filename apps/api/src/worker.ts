import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types";
import authRoutes from "./routes/auth";
import coursesRoutes from "./routes/courses";
import subscriptionsRoutes from "./routes/subscriptions";
import streamRoutes from "./routes/stream";
import progressRoutes from "./routes/progress";
import discussionsRoutes from "./routes/discussions";
import aiTutorRoutes from "./routes/ai_tutor";
import quizRoutes from "./routes/quiz";
import codeAssistantRoutes from "./routes/code_assistant";
import affiliateRoutes from "./routes/affiliate";
import experimentsRoutes from "./routes/experiments";
import certificatesRoutes from "./routes/certificates";
import contactRoutes from "./routes/contact";
import blogRoutes from "./routes/blog";
import reviewsRoutes from "./routes/reviews";
import learningPathsRoutes from "./routes/learning_paths";
import adminRoutes from "./routes/admin";
import workerRoutes from "./routes/worker";
import referralRoutes from "./routes/referral";
import { authMiddleware, optionalAuthMiddleware } from "./middleware/auth";
import { adminMiddleware } from "./middleware/admin";
import { verifyToken } from "./lib/auth";
import type { UserPayload } from "./types";

const app = new Hono<{ Bindings: Env; Variables: { user: UserPayload } }>();

const ALLOWED_ORIGINS = [
  "https://vanhstack.dev",
  "https://ascendly.io",
  "http://localhost:3000",
  "http://localhost:3001",
];

const getCorsOrigin = (origin: string | null): string | undefined => {
  if (!origin) return undefined;
  return ALLOWED_ORIGINS.includes(origin) ? origin : undefined;
};

app.use("*", cors({
  origin: (origin) => getCorsOrigin(origin),
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.get("/api/v1/health", (c) => c.json({ success: true, data: { status: "ok", runtime: "cloudflare-workers" }, error: null, meta: null }));

app.route("/api/v1/auth", authRoutes);

app.use("/api/v1/*", async (c, next) => {
  if (c.req.path.startsWith("/api/v1/auth")) {
    return next();
  }

  const publicPaths = [
    "/api/v1/health",
    "/api/v1/categories",
    "/api/v1/courses",
    "/api/v1/reviews",
    "/api/v1/blog",
    "/api/v1/learning-paths",
    "/api/v1/contact",
    "/api/v1/worker",
    "/api/v1/affiliate",
    "/api/v1/experiments",
    "/api/v1/referral",
    "/api/v1/certificates",
  ];

  const isPublic = publicPaths.some((prefix) => {
    if (prefix === "/api/v1/courses" || prefix === "/api/v1/blog" || prefix === "/api/v1/learning-paths" || prefix === "/api/v1/certificates") {
      return c.req.path === prefix || c.req.path.startsWith(prefix + "/");
    }
    if (prefix === "/api/v1/affiliate") {
      return c.req.path === prefix || c.req.path.startsWith(prefix + "/");
    }
    if (prefix === "/api/v1/experiments") {
      return c.req.path === "/api/v1/experiments/active" || c.req.path.startsWith("/api/v1/experiments/variant-map");
    }
    if (prefix === "/api/v1/referral") {
      return c.req.path === "/api/v1/referral/apply";
    }
    return c.req.path === prefix;
  });

  if (isPublic) {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  const cookieHeader = c.req.header("cookie") || "";
  const cookieMatch = cookieHeader.match(/access_token=([^;]+)/);
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cookieMatch
      ? cookieMatch[1]
      : null;
  if (!accessToken) {
    return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
  }
  const payload = await verifyToken(accessToken, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, data: null, error: "Invalid token", meta: null }, 401);
  }
  c.set("user", payload as UserPayload);
  await next();
});

app.route("/api/v1", coursesRoutes);
app.route("/api/v1", aiTutorRoutes);
app.route("/api/v1", quizRoutes);
app.route("/api/v1", discussionsRoutes);
app.route("/api/v1", subscriptionsRoutes);
app.route("/api/v1", streamRoutes);
app.route("/api/v1", progressRoutes);
app.route("/api/v1", codeAssistantRoutes);
app.route("/api/v1", affiliateRoutes);
app.route("/api/v1", experimentsRoutes);
app.route("/api/v1", certificatesRoutes);
app.route("/api/v1", contactRoutes);
app.route("/api/v1", blogRoutes);
app.route("/api/v1", reviewsRoutes);
app.route("/api/v1", learningPathsRoutes);
app.route("/api/v1", workerRoutes);
app.route("/api/v1", referralRoutes);

app.use("/api/v1/admin/*", adminMiddleware);
app.route("/api/v1/admin", adminRoutes);

export default app;
