"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RemedialPanel } from "./RemedialPanel";
import { adaptiveClient } from "@/lib/adaptive-client";
import type {
  AdaptiveQuiz as AdaptiveQuizEnvelope,
  QuizResult,
} from "@/types/adaptive";

type AdaptiveQuizProps = {
  courseId: string;
  lessonId?: string;
  userId?: string;
  mode?: string;
};

/**
 * Animates a value from 0 up to `target` using requestAnimationFrame.
 * The eased value reaches the target deterministically once enough time passes.
 */
function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function AnimatedScore({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <span className="tabular-nums">{animated.toFixed(1)}</span>;
}

export function AdaptiveQuiz({ courseId, lessonId, mode }: AdaptiveQuizProps) {
  const isMasteryCheck = mode === "mastery-check";
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [quiz, setQuiz] = useState<AdaptiveQuizEnvelope | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [masteryMap, setMasteryMap] = useState<Record<string, number>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [remediationDismissed, setRemediationDismissed] = useState(false);
  const [skipNotice, setSkipNotice] = useState<{ success: boolean; message: string } | null>(null);
  // Per-question stopwatch start (performance.now) so the submit payload can
  // carry `time_seconds` for the backend Elo time_factor.
  const startTimesRef = useRef<number[]>([]);

  const goToQuestion = (index: number) => {
    startTimesRef.current[index] = performance.now();
    setActiveIndex(index);
  };

  useEffect(() => {
    let cancelled = false;
    adaptiveClient
      .getCourseMastery(courseId)
      .then((list) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        (list || []).forEach((c) => {
          map[c.id] = c.mastery_score;
        });
        setMasteryMap(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function loadQuiz() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSkipNotice(null);
    setRemediationDismissed(false);
    try {
      const data = await adaptiveClient.generateAdaptiveQuiz(
        courseId,
        lessonId,
        isMasteryCheck ? "mastery-check" : "practice"
      );
      if (!data?.questions?.length) {
        throw new Error(data?.message || "Quiz returned no questions");
      }
      setQuiz(data);
      setAnswers({});
      startTimesRef.current = data.questions.map(() => performance.now());
      setActiveIndex(0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load quiz";
      setError(
        isMasteryCheck
          ? "Mastery check is not available yet. Try the lesson quiz instead."
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitQuiz() {
    if (!quiz?.quiz_id || !quiz.questions.length) return;
    setSubmitting(true);
    setError(null);
    setSkipNotice(null);
    setRemediationDismissed(false);
    try {
      const now = performance.now();
      const questionsWithTime = quiz.questions.map((q, i) => {
        const startedAt = startTimesRef.current[i];
        return {
          ...q,
          time_seconds:
            typeof startedAt === "number"
              ? Math.max(0, Math.round((now - startedAt) / 1000))
              : undefined,
        };
      });
      const data = await adaptiveClient.submitQuiz(courseId, quiz.quiz_id, answers, questionsWithTime);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    if (!lessonId) return;
    setSkipping(true);
    setError(null);
    try {
      await adaptiveClient.skipLesson(courseId, lessonId);
      setSkipNotice({
        success: true,
        message: "Lesson marked as ready to skip. You can continue to the next lesson.",
      });
    } catch (e: unknown) {
      setSkipNotice({
        success: false,
        message: e instanceof Error ? e.message : "Unable to skip this lesson",
      });
    } finally {
      setSkipping(false);
    }
  }

  const conceptChips = useMemo(() => {
    if (!quiz) return [];
    const order: Array<{ conceptId: string; name: string; firstIndex: number }> = [];
    quiz.questions.forEach((q, idx) => {
      if (!order.some((c) => c.conceptId === q.concept_id)) {
        order.push({ conceptId: q.concept_id, name: q.concept_name, firstIndex: idx });
      }
    });
    return order;
  }, [quiz]);

  const activeConceptId = quiz?.questions[activeIndex]?.concept_id;

  if (result) {
    const weakest =
      result.weak_concepts[0] || result.concept_results.find((cr) => !cr.correct);
    const canSkip =
      result.passed && result.weak_concepts.length === 0 && !!lessonId && !skipNotice?.success;

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
          {result.concept_results.map((cr) => {
            const isWeak = cr.mastery_after < 3;
            return (
              <div
                key={cr.concept_id}
                className={`rounded-lg border p-3 ${isWeak ? "border-red-200 bg-red-50" : "border-neutral-200"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{cr.concept_name}</span>
                  <div className="flex items-center gap-2">
                    {isWeak && <Badge variant="danger">Weak</Badge>}
                    <span className={`text-xs ${cr.correct ? "text-success" : "text-error"}`}>
                      {cr.correct ? "Correct" : "Incorrect"}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  Mastery: {cr.mastery_before.toFixed(1)} → {cr.mastery_after.toFixed(1)} ({cr.mastery_delta >= 0 ? "+" : ""}{cr.mastery_delta.toFixed(2)})
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-accent-500 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, (cr.mastery_after / 10) * 100))}%` }}
                    />
                  </div>
                  <span className="text-xs text-neutral-500" data-testid={`mastery-count-${cr.concept_id}`}>
                    <AnimatedScore value={cr.mastery_after} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {canSkip && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">
              Great job! No weak concepts remain.
            </p>
            <p className="mt-1 text-xs text-emerald-700">Ready to move on to harder content?</p>
            <Button size="sm" className="mt-3" onClick={handleSkip} disabled={skipping}>
              {skipping ? "Skipping..." : "Skip to harder content"}
            </Button>
          </div>
        )}

        {skipNotice && (
          <div
            className={`rounded-lg border p-4 ${
              skipNotice.success ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
            }`}
          >
            <p className={`text-sm font-medium ${skipNotice.success ? "text-emerald-800" : "text-red-700"}`}>
              {skipNotice.message}
            </p>
            {skipNotice.success && (
              <Link
                href={`/learn/${courseId}/mastery`}
                className="mt-2 inline-block text-xs font-medium text-accent-600 underline"
              >
                Continue to mastery dashboard
              </Link>
            )}
          </div>
        )}

        {weakest && !remediationDismissed && (
          <RemedialPanel
            courseId={courseId}
            conceptId={weakest.concept_id}
            conceptName={weakest.concept_name}
            onClose={() => setRemediationDismissed(true)}
          />
        )}

        <div className="flex gap-2">
          <Button onClick={loadQuiz} disabled={loading}>
            Try again
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setQuiz(null);
            }}
          >
            Back to lesson
          </Button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="space-y-3">
        <Button onClick={loadQuiz} disabled={loading}>
          {loading
            ? isMasteryCheck
              ? "Loading mastery check..."
              : "Loading quiz..."
            : isMasteryCheck
              ? "Start mastery check"
              : "Start adaptive quiz"}
        </Button>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{isMasteryCheck ? "Mastery Check" : "Adaptive Quiz"}</h3>
        <span className="text-xs text-neutral-600">
          Question {activeIndex + 1} / {quiz.questions.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="concept-progress">
        {conceptChips.map((chip) => {
          const isActive = chip.conceptId === activeConceptId;
          const score = masteryMap[chip.conceptId];
          return (
            <button
              key={chip.conceptId}
              type="button"
              onClick={() => goToQuestion(chip.firstIndex)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-accent-500 bg-accent-50 text-accent-700"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
              }`}
            >
              {chip.name}
              {score !== undefined && <span className="ml-1 text-neutral-400">{score.toFixed(1)}</span>}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {quiz.questions.map((q, idx) => (
          <div
            key={idx}
            className={`rounded-lg border p-4 ${
              idx === activeIndex ? "border-accent-400 ring-1 ring-accent-200" : "border-neutral-200"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-neutral-500">{q.concept_name}</span>
              <span className="text-xs text-neutral-500">Difficulty: {q.difficulty}/10</span>
            </div>
            <p className="mb-3 text-sm font-medium">{q.question}</p>
            <div className="grid gap-2">
              {q.options.map((opt, optIdx) => (
                <button
                  key={optIdx}
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, [idx]: optIdx }));
                    goToQuestion(idx);
                  }}
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
        <Button
          onClick={submitQuiz}
          disabled={submitting || Object.keys(answers).length !== quiz.questions.length}
        >
          {submitting ? "Submitting..." : "Submit answers"}
        </Button>
        <Button variant="secondary" onClick={() => setQuiz(null)}>
          Cancel
        </Button>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
