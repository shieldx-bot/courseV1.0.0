"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Lock, Paperclip, SkipBack, SkipForward, Clock, MessageSquare, FileText, Sparkles, FileCode, HelpCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { WatermarkOverlay } from "@/components/shared/watermark-overlay";
import { Course, Lesson, Progress, Subscription } from "@/types";
import { adaptiveClient } from "@/lib/adaptive-client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DiscussionTab } from "@/components/learn/DiscussionTab";
import { AiTutorTab } from "@/components/learn/AiTutorTab";
import { CodeAssistantTab } from "@/components/learn/CodeAssistantTab";

export function CoursePlayerClient({
  course: initialCourse,
  progress: initialProgress,
  subscription: initialSubscription,
  params,
}: {
  course: Course;
  progress: Progress[];
  subscription: Subscription | null;
  params: { course: string; lesson: string };
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [course, setCourse] = useState<Course>(initialCourse);
  const [progress, setProgress] = useState<Record<string, Progress>>(() => {
    const map: Record<string, Progress> = {};
    initialProgress.forEach((p) => (map[p.lesson_id] = p));
    return map;
  });
  const [subscription, setSubscription] = useState<Subscription | null>(initialSubscription);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const current: Lesson | undefined = course.syllabus.find((l) => l.id === params.lesson);
  const currentIndex = course.syllabus.findIndex((l) => l.id === params.lesson) ?? 0;

  useEffect(() => {
    if (current && progress[current.id]?.note) {
      setNote(progress[current.id].note || "");
    } else {
      setNote("");
    }
  }, [current, progress]);

  const trialActive = !!user?.trial_active && !!user?.trial_expires && new Date(user.trial_expires) > new Date();
  const trialUnlockCount = course ? Math.max(1, Math.ceil(course.syllabus.length * 0.1)) : 0;

  let trialDaysLeft = 0;
  if (trialActive && user?.trial_expires) {
    trialDaysLeft = Math.max(0, Math.ceil((new Date(user.trial_expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  const hasAccess = useCallback(
    (lessonIndex: number) => {
      if (user?.role === "admin" || subscription?.status === "active") return true;
      if (trialActive) return lessonIndex < trialUnlockCount;
      return false;
    },
    [user, subscription, trialActive, trialUnlockCount]
  );

  const isSubscriber = user?.role === "admin" || subscription?.status === "active";

  const [activeTab, setActiveTab] = useState<"notes" | "discussion" | "ai-tutor" | "code-assistant">("notes");
  const [sequenceStatus, setSequenceStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user?.id || !course?.id) return;
    adaptiveClient.getRecommendedSequence(course.id)
      .then((data) => {
        const map: Record<string, string> = {};
        (data?.sequence || []).forEach((item: any) => {
          if (item.lesson_id && !item.is_synthetic) {
            map[item.lesson_id] = item.status;
          }
        });
        setSequenceStatus(map);
      })
      .catch(() => {});
  }, [user?.id, course?.id]);

  useEffect(() => {
    if (!current || !hasAccess(currentIndex)) return;
    setVideoUrl(null);
    setError("");
    apiClient.lessons.streamToken(current.id)
      .then((data) => setVideoUrl(data.stream_url))
      .catch((e) => setError(e.message));
  }, [current, currentIndex, hasAccess]);

  const updateProgress = useCallback((completed: boolean, last_position_seconds: number) => {
    if (!current) return;
    apiClient.progress.update(current.id, { completed, last_position_seconds })
      .then((p: Progress) => {
        setProgress((prev) => ({ ...prev, [current.id]: p }));
      });
  }, [current]);

  const throttledProgress = (completed: boolean, position: number) => {
    const now = Date.now();
    if (now - lastUpdateRef.current > 5000 || completed) {
      lastUpdateRef.current = now;
      updateProgress(completed, position);
    }
  };

  const saveNote = async () => {
    if (!current) return;
    setSavingNote(true);
    try {
      const p = await apiClient.progress.update(current.id, {
        completed: progress[current.id]?.completed || false,
        last_position_seconds: progress[current.id]?.last_position_seconds || 0,
        note,
      });
      setProgress((prev) => ({ ...prev, [current.id]: p }));
      toast("Note saved", { type: "success" });
    } catch {
      toast("Failed to save note", { type: "error" });
    }
    setSavingNote(false);
  };

  const isLocked = (lesson: Lesson) => {
    const idx = course.syllabus.findIndex((l) => l.id === lesson.id) ?? 0;
    if (!hasAccess(idx)) return true;
    if (idx === 0) return false;
    if (isSubscriber) return false;
    const prev = course.syllabus[idx - 1];
    return prev ? !progress[prev.id]?.completed : false;
  };

  const goToLesson = (lesson: Lesson) => {
    if (isLocked(lesson)) return;
    router.push(`/learn/${params.course}/${lesson.id}`);
  };

  const prevLesson = currentIndex > 0 ? course.syllabus[currentIndex - 1] : null;
  const nextLesson = currentIndex < course.syllabus.length - 1 ? course.syllabus[currentIndex + 1] : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!course) return;

      switch (e.key) {
        case "n":
        case "N": {
          e.preventDefault();
          const next = course.syllabus[currentIndex + 1];
          if (next) router.push(`/learn/${params.course}/${next.id}`);
          break;
        }
        case "p":
        case "P": {
          e.preventDefault();
          const prev = course.syllabus[currentIndex - 1];
          if (prev) router.push(`/learn/${params.course}/${prev.id}`);
          break;
        }
        case "m":
        case "M":
          if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
          break;
        case "?":
          e.preventDefault();
          setShowKeyboardHelp(true);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [course, currentIndex, router, params.course]);

  const markAsComplete = () => {
    const pos = videoRef.current ? Math.floor(videoRef.current.currentTime) : 0;
    updateProgress(true, pos);
      toast("Lesson marked as complete", { type: "success" });
  };

  const skipCurrentLesson = async (lessonId: string) => {
    try {
      await adaptiveClient.skipLesson(course.id, lessonId);
      setProgress((prev) => ({ ...prev, [lessonId]: { ...(prev[lessonId] || { lesson_id: lessonId }), skipped: true, mastery_skip: true } }));
      toast("Lesson skipped", { type: "success" });
    } catch {
      toast("Unable to skip this lesson", { type: "error" });
    }
  };

  if (loading) return <p className="py-20 text-center text-neutral-600">Loading course...</p>;
  if (!course || !current) return <p className="py-20 text-center text-error">{error || "Course not found"}</p>;

  if (!hasAccess(currentIndex)) {
    return (
      <section className="py-20 text-center">
        <h1 className="text-2xl font-semibold text-primary-900">This lesson is locked</h1>
        <p className="mt-2 text-neutral-600">
          {trialActive
            ? "Your free preview covers the first 10% of this course. Subscribe to unlock the full library."
            : "Verify your phone for a 3-day preview, or subscribe for full access."}
        </p>
        <div className="mt-6 flex justify-center gap-4">
          {!trialActive && (
            <Link href={`/verify-phone?next=/learn/${params.course}/${params.lesson}`}>
              <Button>Start free preview</Button>
            </Link>
          )}
          <Link href="/pricing">
            <Button variant="secondary">See plans</Button>
          </Link>
          <Link href="/checkout">
            <Button variant="checkout">Subscribe now</Button>
          </Link>
        </div>
      </section>
    );
  }

  const currentProgress = progress[current.id];
  const startPosition = currentProgress?.last_position_seconds || 0;
  const isCompleted = currentProgress?.completed ?? false;

  return (
    <section className="py-6">
      <div className="mx-auto max-w-page px-6">
        {trialActive && !isSubscriber && (
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
            <span>
              Your free preview ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}.
              <Link href="/pricing" className="ml-1 font-medium underline hover:text-amber-900">
                Subscribe to keep learning
              </Link>
            </span>
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="aspect-video rounded-lg bg-neutral-900 flex items-center justify-center overflow-hidden relative">
              {videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    controlsList="nodownload"
                    playsInline
                    className="h-full w-full select-none"
                    onContextMenu={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
                        e.preventDefault();
                      }
                    }}
                    onLoadedMetadata={(e) => {
                      if (startPosition > 0) {
                        e.currentTarget.currentTime = startPosition;
                      }
                    }}
                    onTimeUpdate={(e) => throttledProgress(false, Math.floor(e.currentTarget.currentTime))}
                    onPause={(e) => updateProgress(false, Math.floor(e.currentTarget.currentTime))}
                    onEnded={() => updateProgress(true, 0)}
                  />
                  <WatermarkOverlay />
                </>
              ) : (
                <p className="text-center text-neutral-300">{error || "Loading video..."}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-primary-900">{current.title}</h1>
                <p className="text-sm text-neutral-600">
                  Lesson {currentIndex + 1} of {course.lesson_count}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => prevLesson && goToLesson(prevLesson)} disabled={!prevLesson || isLocked(prevLesson)} title="Previous lesson (p)">
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  variant={isCompleted ? "secondary" : "primary"}
                  size="sm"
                  onClick={markAsComplete}
                >
                  <Check className="mr-1 h-4 w-4" />
                  {isCompleted ? "Completed" : "Mark complete"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => nextLesson && goToLesson(nextLesson)} disabled={!nextLesson || isLocked(nextLesson)} title="Next lesson (n)">
                  <SkipForward className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowKeyboardHelp(true)} title="Keyboard shortcuts (?)">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {current.attachments && current.attachments.length > 0 && (
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-semibold text-primary-900"><Paperclip className="h-4 w-4" /> Attachments</h2>
                <ul className="mt-3 space-y-2">
                  {current.attachments.map((a, i) => (
                    <li key={i}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-700 hover:underline">
                        {a.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="border-t pt-6">
              <div className="flex gap-1 mb-4 flex-wrap">
                <Button
                  variant={activeTab === "notes" ? "primary" : "ghost"}
                  className="text-sm"
                  onClick={() => setActiveTab("notes")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Notes
                </Button>
                <Button
                  variant={activeTab === "discussion" ? "primary" : "ghost"}
                  className="text-sm"
                  onClick={() => setActiveTab("discussion")}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Discussion
                </Button>
                <Button
                  variant={activeTab === "ai-tutor" ? "primary" : "ghost"}
                  className="text-sm"
                  onClick={() => setActiveTab("ai-tutor")}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Tutor
                </Button>
                <Button
                  variant={activeTab === "code-assistant" ? "primary" : "ghost"}
                  className="text-sm"
                  onClick={() => setActiveTab("code-assistant")}
                >
                  <FileCode className="h-4 w-4 mr-2" />
                  Code Assistant
                </Button>
                <Link href="/ide">
                  <Button variant="ghost" className="text-sm">
                    <FileCode className="h-4 w-4 mr-2" />
                    IDE
                  </Button>
                </Link>
              </div>

              {activeTab === "notes" && (
                <Card className="p-5">
                  <h2 className="font-semibold text-primary-900">My notes</h2>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Write a note for this lesson..."
                    className="mt-3 min-h-[100px]"
                  />
                  <Button className="mt-3" onClick={saveNote} disabled={savingNote}>{savingNote ? "Saving..." : "Save note"}</Button>
                </Card>
              )}

              {activeTab === "discussion" && (
                <DiscussionTab
                  courseId={course.id}
                  lessonId={current.id}
                  courseSlug={params.course}
                />
              )}

              {activeTab === "ai-tutor" && (
                <AiTutorTab courseId={course.id} lessonId={current.id} />
              )}

              {activeTab === "code-assistant" && (
                <CodeAssistantTab
                  courseId={course.id}
                  lessonId={current.id}
                  lessonTitle={current.title}
                  lessonLanguage={current.language || "python"}
                  lessonContext={current.transcript || current.description}
                  starterCode={current.starter_code}
                />
              )}

              <p className="text-center text-xs text-neutral-400 mt-6">
                <kbd className="rounded border border-neutral-300 px-1 font-mono text-neutral-500">n</kbd> next lesson &middot;
                <kbd className="rounded border border-neutral-300 px-1 font-mono text-neutral-500">p</kbd> previous lesson &middot;
                <kbd className="rounded border border-neutral-300 px-1 font-mono text-neutral-500">m</kbd> toggle mute &middot;
                <kbd className="rounded border border-neutral-300 px-1 font-mono text-neutral-500">?</kbd> keyboard shortcuts
              </p>
            </div>
          </div>
          <Card className="h-fit p-5">
            <h2 className="font-semibold text-primary-900">{course.title}</h2>
            {course.chapters && course.chapters.length > 0 ? (
              course.chapters.map((chapter, ci) => {
                let globalIdx = 0;
                for (let k = 0; k < ci; k++) {
                  globalIdx += (course.chapters?.[k]?.lessons?.length ?? 0);
                }
                return (
                  <div key={chapter.id} className="mt-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-700">{chapter.title}</p>
                    <ul className="space-y-1">
                      {chapter.lessons.map((l, li) => {
                        const idx = globalIdx + li;
                        const locked = isLocked(l);
                        const completed = progress[l.id]?.completed;
                        const skipped = progress[l.id]?.skipped || progress[l.id]?.mastery_skip;
                        const seqStatus = sequenceStatus[l.id];
                        const progressPct = !locked && !completed && !skipped && l.duration_seconds > 0 && (progress[l.id]?.last_position_seconds ?? 0) > 0
                          ? Math.min(100, Math.round(((progress[l.id]?.last_position_seconds ?? 0) / l.duration_seconds) * 100))
                          : 0;
                        return (
                          <li key={l.id}>
                            <button
                              onClick={() => skipped ? undefined : goToLesson(l)}
                              disabled={locked || skipped}
                              className={cn(
                                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                                locked && "text-neutral-400 cursor-not-allowed",
                                skipped && "text-neutral-400 line-through",
                                !locked && !skipped && l.id === params.lesson && "bg-accent-100 font-medium text-accent-600",
                                !locked && !skipped && l.id !== params.lesson && "text-neutral-900 hover:bg-neutral-100"
                              )}
                            >
                              <span className="truncate">{idx + 1}. {l.title}</span>
                              {skipped ? (
                              <span className="text-[10px] uppercase text-neutral-400">Skipped</span>
                            ) : seqStatus === "ready-to-skip" ? (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => skipCurrentLesson(l.id)}>Skip</Button>
                            ) : completed ? (
                              <Check className="h-4 w-4 shrink-0 text-success" />
                            ) : locked ? (
                              <Lock className="h-4 w-4 shrink-0 text-neutral-300" />
                            ) : null}
                            </button>
                            {seqStatus === "remedial" && !skipped && (
                              <div className="mx-3 mt-1 text-[10px] uppercase text-amber-700">Remedial focus</div>
                            )}
                            {progressPct > 0 && (
                              <div className="mx-3 mb-1 h-1 overflow-hidden rounded-full bg-neutral-100">
                                <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${progressPct}%` }} />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            ) : (
              <ul className="mt-4 space-y-1">
                {course.syllabus.map((l) => {
                  const idx = course.syllabus.indexOf(l);
                const locked = isLocked(l);
                const completed = progress[l.id]?.completed;
                const skipped = progress[l.id]?.skipped || progress[l.id]?.mastery_skip;
                const seqStatus = sequenceStatus[l.id];
                const progressPct = !locked && !completed && !skipped && l.duration_seconds > 0 && (progress[l.id]?.last_position_seconds ?? 0) > 0
                  ? Math.min(100, Math.round(((progress[l.id]?.last_position_seconds ?? 0) / l.duration_seconds) * 100))
                  : 0;
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => skipped ? undefined : goToLesson(l)}
                      disabled={locked || skipped}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                        locked && "text-neutral-400 cursor-not-allowed",
                        skipped && "text-neutral-400 line-through",
                        !locked && !skipped && l.id === params.lesson && "bg-accent-100 font-medium text-accent-600",
                        !locked && !skipped && l.id !== params.lesson && "text-neutral-900 hover:bg-neutral-100"
                      )}
                    >
                      <span className="truncate">{idx + 1}. {l.title}</span>
                      {skipped ? (
                      <span className="text-[10px] uppercase text-neutral-400">Skipped</span>
                    ) : seqStatus === "ready-to-skip" ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => skipCurrentLesson(l.id)}>Skip</Button>
                    ) : completed ? (
                      <Check className="h-4 w-4 shrink-0 text-success" />
                    ) : locked ? (
                      <Lock className="h-4 w-4 shrink-0 text-neutral-300" />
                    ) : null}
                    </button>
                    {seqStatus === "remedial" && !skipped && (
                      <div className="mx-3 mt-1 text-[10px] uppercase text-amber-700">Remedial focus</div>
                    )}
                    {progressPct > 0 && (
                      <div className="mx-3 mb-1 h-1 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${progressPct}%` }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            )}
          </Card>
        </div>
      </div>
      
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-slide-in" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5" /> Keyboard Shortcuts
            </h3>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between"><kbd className="px-2 py-1 bg-slate-800 rounded">n</kbd><span>Next lesson</span></div>
              <div className="flex justify-between"><kbd className="px-2 py-1 bg-slate-800 rounded">p</kbd><span>Previous lesson</span></div>
              <div className="flex justify-between"><kbd className="px-2 py-1 bg-slate-800 rounded">m</kbd><span>Toggle mute</span></div>
              <div className="flex justify-between"><kbd className="px-2 py-1 bg-slate-800 rounded">?</kbd><span>Show this help</span></div>
            </div>
            <button onClick={() => setShowKeyboardHelp(false)} className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors">Got it</button>
          </div>
        </div>
      )}
    </section>
  );
}