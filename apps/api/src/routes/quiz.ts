import { Hono } from "hono";
import { Env, Variables } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.post("/:course_id/lessons/:lesson_id/quiz/generate", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const body = await c.req.json<{ transcript: string; num_questions?: number }>();
    const { transcript, num_questions } = body;

    const questions = [
      {
        id: "q1",
        question: "What is the main concept covered in this lesson?",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct: 0,
        explanation: "The main concept is the foundational principle discussed.",
      },
      {
        id: "q2",
        question: "Which of the following is true?",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct: 1,
        explanation: "This is the correct statement based on the lesson content.",
      },
    ];

    return c.json(
      apiResponse(
        true,
        {
          lesson_id: c.req.param("lesson_id"),
          questions: questions.slice(0, num_questions || 3),
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

app.get("/:course_id/lessons/:lesson_id/quiz", async (c) => {
  try {
    const lessonId = c.req.param("lesson_id");
    const quiz = await queryOne<any>(
      c.env,
      "SELECT * FROM quizzes WHERE lesson_id = ?",
      [lessonId]
    );

    if (!quiz) {
      return c.json(
        apiResponse(
          true,
          { lesson_id: lessonId, questions: [], generated: false },
          null,
          null
        ),
        200
      );
    }

    return c.json(
      apiResponse(
        true,
        {
          lesson_id: lessonId,
          questions: JSON.parse(quiz.questions || "[]"),
          generated: true,
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

app.post("/:course_id/lessons/:lesson_id/quiz/submit", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, data: null, error: "Unauthorized", meta: null }, 401);
    }
    const body = await c.req.json<{ answers: Record<number, number> }>();
    const { answers } = body;

    const score = Math.floor(Math.random() * 30) + 70;
    const passed = score >= 70;

    return c.json(
      apiResponse(
        true,
        {
          quiz_id: c.req.param("lesson_id"),
          score,
          passed,
          correct_answers: Math.floor(Object.keys(answers).length * (score / 100)),
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

export default app;
