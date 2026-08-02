"use client";

import { useEffect, useState } from "react";
import { adaptiveClient } from "@/lib/adaptive-client";
import { Button } from "@/components/ui/button";
import type { RemedialContent, RemedialExerciseResult } from "@/types/adaptive";

type RemedialPanelProps = {
  courseId: string;
  conceptId: string;
  conceptName: string;
  onClose?: () => void;
};

export function RemedialPanel({ courseId, conceptId, conceptName, onClose }: RemedialPanelProps) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<RemedialContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exerciseState, setExerciseState] = useState<Record<number, number>>({});
  const [exerciseSubmitted, setExerciseSubmitted] = useState(false);
  const [submittingExercise, setSubmittingExercise] = useState(false);
  const [exerciseResult, setExerciseResult] = useState<RemedialExerciseResult | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackFailed, setFeedbackFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExerciseState({});
    setExerciseSubmitted(false);
    setExerciseResult(null);
    setFeedbackSent(false);
    setFeedbackFailed(false);

    adaptiveClient
      .remediationContent(courseId, conceptId)
      .then((data) => {
        if (!cancelled) {
          setContent(data as RemedialContent);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, conceptId]);

  function handleExerciseSelect(questionIndex: number, optionIndex: number) {
    setExerciseState((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  }

  async function handleExerciseSubmit() {
    setSubmittingExercise(true);
    // Phase 6 endpoint — when AI-A ships it, mastery is updated server-side and
    // the before/after delta is shown. Until then we fall back to local grading.
    const remote = await adaptiveClient.submitRemedialExercise(courseId, conceptId, exerciseState);
    setSubmittingExercise(false);
    if (remote) {
      setExerciseResult(remote);
    }
    setExerciseSubmitted(true);
  }

  async function handleFeedback(helpful: boolean) {
    const sent = await adaptiveClient.sendRemedialFeedback(courseId, conceptId, helpful);
    if (sent) {
      setFeedbackSent(true);
    } else {
      setFeedbackFailed(true);
    }
  }

  if (!content && !loading && !error) {
    return null;
  }

  return (
    <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Remedial Practice: {conceptName}</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Let&apos;s strengthen this concept before moving on.
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Skip
          </Button>
        )}
      </div>

      {loading && <p className="mt-4 text-sm text-neutral-600">Loading remedial content...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {content && !loading && (
        <div className="mt-4 space-y-5">
          {content.explanation && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase text-neutral-500">Explanation</p>
              <p className="text-sm leading-relaxed">{content.explanation}</p>
            </div>
          )}

          {content.analogies && content.analogies.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase text-neutral-500">Analogies</p>
              <ul className="space-y-1">
                {content.analogies.map((analogy, idx) => (
                  <li key={idx} className="text-sm text-neutral-800">
                    • {analogy}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.exercise?.questions?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase text-neutral-500">Micro-Exercise</p>
              {content.exercise.questions.map((q, qIdx) => {
                const selected = exerciseState[qIdx];
                const submitted = exerciseSubmitted;
                const isCorrect = submitted && selected === q.correct;
                const isWrong = submitted && selected !== undefined && selected !== q.correct;
                return (
                  <div
                    key={qIdx}
                    className={`rounded-md border p-3 ${
                      isCorrect ? "border-green-200 bg-green-50" : isWrong ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-medium">{qIdx + 1}. {q.question}</p>
                    <div className="mt-2 grid gap-2">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = selected === optIdx;
                        const isAnswer = optIdx === q.correct;
                        let className = "rounded-md border px-3 py-2 text-left text-sm";
                        if (submitted && isAnswer) {
                          className += " border-green-500 bg-green-50";
                        } else if (isSelected && isWrong) {
                          className += " border-red-400 bg-red-50";
                        } else if (isSelected) {
                          className += " border-accent-500 bg-accent-50";
                        } else {
                          className += " border-neutral-200 hover:border-neutral-300";
                        }
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={submitted}
                            onClick={() => handleExerciseSelect(qIdx, optIdx)}
                            className={className}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {submitted && q.explanation && (
                      <p className="mt-2 text-xs text-neutral-600">{q.explanation}</p>
                    )}
                  </div>
                );
              })}
              {!exerciseSubmitted && (
                <Button
                  size="sm"
                  onClick={handleExerciseSubmit}
                  disabled={
                    submittingExercise ||
                    Object.keys(exerciseState).length < content.exercise.questions.length
                  }
                >
                  {submittingExercise ? "Submitting..." : "Submit exercise"}
                </Button>
              )}
              {exerciseSubmitted && (
                <div className="space-y-2">
                  {exerciseResult && (
                    <div
                      className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs"
                      data-testid="exercise-mastery-result"
                    >
                      Mastery: {exerciseResult.mastery_before.toFixed(1)} →{" "}
                      {exerciseResult.mastery_after.toFixed(1)}
                    </div>
                  )}
                  <p className="text-xs text-neutral-600">
                    Exercise submitted. Review the explanation above and continue when ready.
                  </p>
                </div>
              )}
            </div>
          )}

          {!content.generated && (
            <p className="text-xs text-neutral-500">
              This content is generated by AI. Check back later for improved explanations.
            </p>
          )}

          <div className="border-t border-neutral-200 pt-3">
            {feedbackSent ? (
              <p className="text-xs text-neutral-500" data-testid="feedback-thanks">
                Thanks! Your feedback helps us improve.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-500">Was this helpful?</span>
                <button
                  type="button"
                  aria-label="Helpful"
                  onClick={() => handleFeedback(true)}
                  className="rounded-md border border-neutral-200 px-2 py-1 text-sm hover:border-emerald-300 hover:bg-emerald-50"
                >
                  👍
                </button>
                <button
                  type="button"
                  aria-label="Not helpful"
                  onClick={() => handleFeedback(false)}
                  className="rounded-md border border-neutral-200 px-2 py-1 text-sm hover:border-red-300 hover:bg-red-50"
                >
                  👎
                </button>
                {feedbackFailed && (
                  <span className="text-xs text-neutral-400">Could not record feedback.</span>
                )}
              </div>
            )}
          </div>

          {onClose && (
            <div className="border-t border-neutral-200 pt-3">
              <Button size="sm" variant="secondary" onClick={onClose}>
                I got it, skip anyway
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
