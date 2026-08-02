"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adaptiveClient } from "@/lib/adaptive-client";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RemedialPanel } from "./RemedialPanel";
import type { RecommendedLessonSequence } from "@/types/adaptive";

type LearningPathProps = {
  courseId: string;
  courseSlug?: string;
};

type LessonRef = { id: string; title: string };

function StatusBadge({ status }: { status: RecommendedLessonSequence["status"] }) {
  if (status === "ready-to-skip") {
    return <Badge variant="success" size="sm">Ready to skip</Badge>;
  }
  if (status === "remedial") {
    return <Badge variant="warning" size="sm">Practice first</Badge>;
  }
  return <Badge variant="outline" size="sm">Up next</Badge>;
}

/**
 * Dynamic learning path rendered from GET /adaptive/course/{id}/recommended-sequence.
 * Each lesson carries a badge (`ready-to-skip` / `remedial` / `normal`) with the
 * matching action (Skip, open remedial practice, or navigate). A "Show all lessons"
 * toggle guarantees users are never hidden lessons (design 16-de-xuat).
 */
export function LearningPath({ courseId, courseSlug }: LearningPathProps) {
  const router = useRouter();
  const [sequence, setSequence] = useState<RecommendedLessonSequence[]>([]);
  const [allLessons, setAllLessons] = useState<LessonRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [remedialTarget, setRemedialTarget] = useState<{ conceptId: string; conceptName: string } | null>(null);

  const loadSequence = useCallback(async () => {
    const data = await adaptiveClient.getRecommendedSequence(courseId);
    setSequence(data?.sequence || []);
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const data = await adaptiveClient.getRecommendedSequence(courseId);
      if (cancelled) return;
      setSequence(data?.sequence || []);
    })();
    // Full syllabus for the "show all lessons" view. Guarded: it must never
    // break the path when the courses endpoint is unavailable.
    apiClient.courses
      .get(courseSlug || courseId)
      .then((course) => {
        if (cancelled) return;
        setAllLessons((course?.syllabus || []).map((l) => ({ id: l.id, title: l.title })));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, courseSlug]);

  const statusByLesson = useMemo(() => {
    const map: Record<string, RecommendedLessonSequence["status"]> = {};
    sequence.forEach((s) => {
      if (!s.is_synthetic) map[s.lesson_id] = s.status;
    });
    return map;
  }, [sequence]);

  const hasReadyToSkip = sequence.some((s) => s.status === "ready-to-skip" && !s.is_synthetic);

  // Default view = recommended path. Toggle "show all lessons" reveals the full
  // syllabus with its status so no lesson is ever hidden from the learner.
  const items: Array<{ lesson_id: string; title: string; status: RecommendedLessonSequence["status"]; is_synthetic?: boolean; weak_concepts: string[]; target?: string }> =
    showAll && allLessons.length > 0
      ? allLessons.map((l) => ({
          lesson_id: l.id,
          title: l.title,
          status: statusByLesson[l.id] || "normal",
          weak_concepts: [],
        }))
      : sequence.map((s) => ({
          lesson_id: s.lesson_id,
          title: s.title,
          status: s.is_synthetic ? "remedial" : s.status,
          is_synthetic: s.is_synthetic,
          weak_concepts: s.weak_concepts || [],
          target: s.target_lesson_id,
        }));

  const goToLesson = (lessonId: string) => {
    router.push(`/learn/${courseSlug || courseId}/${lessonId}`);
  };

  async function handleSkip(lessonId: string) {
    setSkippingId(lessonId);
    try {
      const res = await adaptiveClient.skipLesson(courseId, lessonId);
      // Phase 6: backend may return the refreshed sequence directly.
      if (res?.updated_sequence) {
        setSequence(res.updated_sequence);
      } else {
        await loadSequence();
      }
    } finally {
      setSkippingId(null);
    }
  }

  async function openRemedial(item: { weak_concepts: string[] }) {
    const weak = await adaptiveClient.getWeak(courseId);
    const target =
      weak.find((w) => item.weak_concepts.includes(w.name)) ||
      weak[0];
    if (target) {
      setRemedialTarget({ conceptId: target.id, conceptName: target.name });
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading your recommended path...</p>;
  }

  return (
    <section aria-labelledby="learning-path-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="learning-path-title" className="text-lg font-medium">
          Recommended learning path
        </h2>
        {hasReadyToSkip && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} data-testid="toggle-show-all">
            {showAll ? "Show recommended" : "Show all lessons"}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">No recommended path yet.</p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid="learning-path-items">
          {items.map((item) => (
            <li
              key={item.lesson_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => goToLesson(item.is_synthetic ? item.target || item.lesson_id : item.lesson_id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="truncate text-sm font-medium text-neutral-800">{item.title}</span>
                {item.is_synthetic && (
                  <span className="ml-1 text-[10px] uppercase text-amber-600">Prerequisite practice</span>
                )}
              </button>
              <div className="flex items-center gap-2">
                <StatusBadge status={item.is_synthetic ? "remedial" : item.status} />
                {item.status === "ready-to-skip" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSkip(item.lesson_id)}
                    disabled={skippingId === item.lesson_id}
                    data-testid={`skip-${item.lesson_id}`}
                  >
                    {skippingId === item.lesson_id ? "Skipping..." : "Skip"}
                  </Button>
                )}
                {item.status === "remedial" && !item.is_synthetic && (
                  <Button size="sm" variant="secondary" onClick={() => openRemedial(item)}>
                    Practice
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {remedialTarget && (
        <div className="mt-4">
          <RemedialPanel
            courseId={courseId}
            conceptId={remedialTarget.conceptId}
            conceptName={remedialTarget.conceptName}
            onClose={() => setRemedialTarget(null)}
          />
        </div>
      )}
    </section>
  );
}