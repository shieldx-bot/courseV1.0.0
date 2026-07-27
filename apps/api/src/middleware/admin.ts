import { Env } from "../types";
import { errorResponse } from "../lib/db";

export async function adminMiddleware(
  c: any,
  next: () => Promise<void>
) {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json(
      { success: false, data: null, error: "Forbidden", meta: null },
      403
    );
  }
  await next();
}
