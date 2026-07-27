import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.post("/contact", async (c) => {
  try {
    const body = await c.req.json<{ name: string; email: string; subject: string; message: string }>();
    const { name, email, subject, message } = body;
    const contactId = `contact-${email}-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO contacts (_id, name, email, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [contactId, name, email, subject, message, "open", now]
    );
    return c.json(apiResponse(true, { success: true, id: contactId }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/admin/contacts", async (c) => {
  try {
    const user = c.get("user");
    if (!user || user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Forbidden", meta: null }, 403);
    }
    const contacts = await query<any>(c.env, "SELECT * FROM contacts ORDER BY created_at DESC");
    return c.json(
      apiResponse(
        true,
        contacts.map((ct) => ({
          id: ct._id,
          ...Object.fromEntries(
            Object.entries(ct).filter(([k]) => k !== "_id")
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

export default app;
