"use client";

import { useEffect, useState } from "react";
import { adaptiveClient } from "@/lib/adaptive-client";
import { Button } from "@/components/ui/button";

type RemedialQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

type RemedialContent = {
  concept_id: string;
  concept_name: string;
  explanation: string;
  exercise: { questions: RemedialQuestion[] };
  analogies: string[];
  generated: boolean;
};

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExerciseState({});
    setExerciseSubmitted(false);

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

  function handleExerciseSubmit() {
    setExerciseSubmitted(true);
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
                  disabled={Object.keys(exerciseState).length < content.exercise.questions.length}
                >
                  Submit exercise
                </Button>
              )}
              {exerciseSubmitted && (
                <p className="text-xs text-neutral-600">
                  Exercise submitted. Review the explanation above and continue when ready.
                </p>
              )}
            </div>
          )}

          {!content.generated && (
            <p className="text-xs text-neutral-500">
              This content is generated by AI. Check back later for improved explanations.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
