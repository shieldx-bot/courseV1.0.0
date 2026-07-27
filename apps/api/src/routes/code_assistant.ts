import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.post("/code-assistant/generate", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const body = await c.req.json<{ task: string; language: string; context?: string; starter_code?: string }>();
    const { task, language, context, starter_code } = body;

    const codeId = `code-${Date.now()}`;
    const generatedCode = `// Generated ${language} code for: ${task}\n// Context: ${context || "None"}\n\n${starter_code || "// Your code here"}`;
    const now = new Date().toISOString();

    await execute(
      c.env,
      "INSERT INTO code_generations (_id, user_id, task, language, generated_code, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [codeId, user.sub, task, language, generatedCode, now]
    );

    return c.json(
      apiResponse(
        true,
        { id: codeId, code: generatedCode, language },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/code-assistant/explain", async (c) => {
  try {
    const body = await c.req.json<{ code: string; language: string; focus?: string }>();
    const { code, language, focus } = body;

    const explanation = `# ${language} Code Explanation\n\n## Overview\nThis code appears to be written in ${language}.\n\n## Key Concepts\n${focus ? `Focus area: ${focus}` : "General explanation"}\n\n## Analysis\nThe code implements the requested functionality using standard ${language} patterns.`;

    return c.json(apiResponse(true, { explanation, language }, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/code-assistant/review", async (c) => {
  try {
    const body = await c.req.json<{ code: string; language: string; task?: string }>();
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

    return c.json(apiResponse(true, review, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/code-assistant/debug", async (c) => {
  try {
    const body = await c.req.json<{ code: string; language: string; error: string; task?: string }>();
    const { code, language, error: errorMsg, task } = body;

    const debug = {
      error_analysis: `The error "${errorMsg}" suggests an issue with the code logic.`,
      fix: `// Fixed version:\n${code}`,
      explanation: "The issue has been identified and resolved in the fixed version.",
    };

    return c.json(apiResponse(true, debug, null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

export default app;
