"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RemedialPanel } from "./RemedialPanel";

export type QuizQuestion = {
  concept_id: string;
  concept_name: string;
  difficulty: number;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

export type QuizResult = {
  quiz_id: string;
  score: number;
  total_questions: number;
  score_pct: number;
  passed: boolean;
  results: Array<{
    question_index: number;
    concept_id: string;
    correct: boolean;
    selected_answer: number;
    correct_answer: number;
    explanation: string;
    mastery_delta?: number;
  }>;
  concept_results: Array<{
    concept_id: string;
    concept_name: string;
    mastery_before: number;
    mastery_after: number;
    mastery_delta: number;
    correct: boolean;
  }>;
  weak_concepts: Array<{
    concept_id: string;
    concept_name: string;
    mastery_after: number;
  }>;
};

type AdaptiveQuizProps = {
  courseId: string;
  lessonId: string;
  userId: string;
};

export function AdaptiveQuiz({ courseId, lessonId, userId }: AdaptiveQuizProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quiz, setQuiz] = useState<{
    quiz_id: string | null;
    questions: QuizQuestion[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadQuiz() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/v1/adaptive/quiz/${encodeURIComponent(courseId)}/generate?lesson_id=${encodeURIComponent(lessonId)}&num_questions=5`, {
        headers: { Authorization: `Bearer ${userId}` },
      });
      if (!res.ok) throw new Error((await res.text()) || `${res.status}`);
      const json = await res.json();
      setQuiz({
        quiz_id: json.data?.quiz_id || null,
        questions: json.data?.questions || [],
      });
      setAnswers({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load quiz");
    } finally {
      setLoading(false);
    }
  }

  async function submitQuiz() {
    if (!quiz?.quiz_id || !quiz.questions.length) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/adaptive/quiz/${encodeURIComponent(courseId)}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          quiz_id: quiz.quiz_id,
          answers,
          questions: quiz.questions,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `${res.status}`);
      const json = await res.json();
      setResult(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const weakest = result.weak_concepts[0] || result.concept_results.find((cr) => !cr.correct);

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 p-4">
          <h3 className="text-lg font-semibold">Quiz Complete</h3>
          <p className="text-sm text-neutral-600">
            Score: {result.score} / {result.total_questions} ({result.score_pct}%)
          </p>
          <p className="text-sm text-neutral-600">{result.passed ? "Passed" : "Not passed yet"}</p>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Results by concept</h4>
          {result.concept_results.map((cr) => (
            <div key={cr.concept_id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{cr.concept_name}</span>
                <span className={`text-xs ${cr.correct ? "text-success" : "text-error"}`}>
                  {cr.correct ? "Correct" : "Incorrect"}
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-600">
                Mastery: {cr.mastery_before.toFixed(1)} → {cr.mastery_after.toFixed(1)} ({cr.mastery_delta >= 0 ? "+" : ""}{cr.mastery_delta.toFixed(2)})
              </div>
            </div>
          ))}
        </div>

        {weakest && (
          <RemedialPanel
            courseId={courseId}
            conceptId={weakest.concept_id}
            conceptName={weakest.concept_name}
          />
        )}

        <div className="flex gap-2">
          <Button onClick={loadQuiz} disabled={loading}>Try again</Button>
          <Button variant="secondary" onClick={() => setResult(null)}>Back to lesson</Button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="space-y-3">
        <Button onClick={loadQuiz} disabled={loading}>
          {loading ? "Loading quiz..." : "Start adaptive quiz"}
        </Button>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Adaptive Quiz</h3>
        <span className="text-xs text-neutral-600">
          Question 1 / {quiz.questions.length}
        </span>
      </div>

      <div className="space-y-4">
        {quiz.questions.map((q, idx) => (
          <div key={idx} className="rounded-lg border border-neutral-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-neutral-500">{q.concept_name}</span>
              <span className="text-xs text-neutral-500">Difficulty: {q.difficulty}/10</span>
            </div>
            <p className="mb-3 text-sm font-medium">{q.question}</p>
            <div className="grid gap-2">
              {q.options.map((opt, optIdx) => (
                <button
                  key={optIdx}
                  onClick={() => setAnswers((prev) => ({ ...prev, [idx]: optIdx }))}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    answers[idx] === optIdx
                      ? "border-accent-500 bg-accent-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={submitQuiz} disabled={submitting || Object.keys(answers).length !== quiz.questions.length}>
          {submitting ? "Submitting..." : "Submit answers"}
        </Button>
        <Button variant="secondary" onClick={() => setQuiz(null)}>Cancel</Button>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
