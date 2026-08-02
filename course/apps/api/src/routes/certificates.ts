import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/certificates", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const certs = await query<any>(
      c.env,
      "SELECT * FROM certificates WHERE user_id = ?",
      [user.sub]
    );
    return c.json(
      apiResponse(
        true,
        certs.map((cert) => ({
          id: cert._id,
          ...Object.fromEntries(
            Object.entries(cert).filter(([k]) => k !== "_id")
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

app.get("/certificates/:cert_id", async (c) => {
  try {
    const user = c.get("user");
    const certId = c.req.param("cert_id");
    const cert = await queryOne<any>(
      c.env,
      "SELECT * FROM certificates WHERE _id = ?",
      [certId]
    );
    if (!cert) {
      return c.json({ success: false, data: null, error: "Certificate not found", meta: null }, 404);
    }
    if (user && cert.user_id !== user.sub && user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Not your certificate", meta: null }, 403);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: cert._id,
          ...Object.fromEntries(
            Object.entries(cert).filter(([k]) => k !== "_id")
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

app.post("/certificates/issue/:course_id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const courseId = c.req.param("course_id");
    const now = new Date().toISOString();
    const certId = `cert-${user.sub}-${courseId}`;
    const verificationCode = generateVerificationCode();

    await execute(
      c.env,
      "INSERT INTO certificates (_id, user_id, course_id, verification_code, issued_at) VALUES (?, ?, ?, ?, ?)",
      [certId, user.sub, courseId, verificationCode, now]
    );

    return c.json(
      apiResponse(
        true,
        { id: certId, user_id: user.sub, course_id: courseId, verification_code: verificationCode, issued_at: now },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/certificates/:cert_id/download", async (c) => {
  try {
    const user = c.get("user");
    const certId = c.req.param("cert_id");
    const cert = await queryOne<any>(
      c.env,
      "SELECT * FROM certificates WHERE _id = ?",
      [certId]
    );
    if (!cert) {
      return c.json({ success: false, data: null, error: "Certificate not found", meta: null }, 404);
    }
    if (user && cert.user_id !== user.sub && user.role !== "admin") {
      return c.json({ success: false, data: null, error: "Not your certificate", meta: null }, 403);
    }

    const pdfContent = generateCertificatePdf(cert);
    return new Response(pdfContent, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${certId}.pdf"`,
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/verify/:code", async (c) => {
  try {
    const code = c.req.param("code");
    const cert = await queryOne<any>(
      c.env,
      "SELECT * FROM certificates WHERE verification_code = ?",
      [code]
    );
    if (!cert) {
      return c.json(apiResponse(true, { valid: false, verification_code: code }, null, null), 200);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: cert._id,
          ...Object.fromEntries(
            Object.entries(cert).filter(([k]) => k !== "_id")
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

function generateVerificationCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateCertificatePdf(cert: any): string {
  return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 4 0 R
>>
>>
/MediaBox [0 0 612 792]
/Contents 5 0 R
>>
endobj
4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
>>
endobj
5 0 obj
<<
/Length 200
>>
stream
BT
/F1 24 Tf
100 400 Td
(Certificate of Completion) Tj
/F1 14 Tf
0 -40 Td
(Certificate ID: ${cert._id}) Tj
0 -20 Td
(User: ${cert.user_id}) Tj
0 -20 Td
(Course: ${cert.course_id}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000264 00000 n 
0000000345 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
554
%%EOF`;
}

export default app;
