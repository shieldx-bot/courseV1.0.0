"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import type { Challenge } from "@/types/community";
import {
  GOAL_OPTIONS,
  INTEREST_OPTIONS,
  LEVEL_OPTIONS,
  ONBOARDING_STEPS,
  dailyObjectiveLabel,
  goalMotivation,
  greetingName,
  isOnboardingComplete,
  MAX_INTERESTS,
  normalizeOnboarding,
  pickFirstChallenge,
  recommendedPathLabel,
  recommendedPathSlug,
  type OnboardingStep,
  type RecommendedChallenge,
  weeklyXpEstimate,
} from "@/lib/onboarding-data";
import { Button } from "@/components/ui/button";

type StepKey = OnboardingStep;
type Fn = () => void;

interface WizardProps {
  initialStep?: StepKey;
}

const STEP_ORDER: StepKey[] = [...ONBOARDING_STEPS];

function StepShell({
  title,
  subtitle,
  children,
  onContinue,
  continueLabel = "Continue",
  continueDisabled,
  onSkip,
  step,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onContinue?: Fn;
  continueLabel?: string;
  continueDisabled?: boolean;
  onSkip?: Fn;
  step: number;
}) {
  const total = STEP_ORDER.length;
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      <div className="mb-8 flex items-center gap-2">
        {STEP_ORDER.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              i <= step ? "bg-primary-600" : "bg-neutral-200"
            }`}
          />
        ))}
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
        {title}
      </h1>
      {subtitle && <p className="mt-3 text-lg text-neutral-600">{subtitle}</p>}
      <div className="mt-8 flex-1">{children}</div>
      <div className="mt-10 flex items-center justify-between gap-4">
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-neutral-500 underline-offset-4 hover:text-neutral-700 hover:underline"
          >
            Skip for now
          </button>
        ) : (
          <span />
        )}
        {onContinue && (
          <Button onClick={onContinue} disabled={continueDisabled} size="lg">
            {continueLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border-2 p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        selected
          ? "border-primary-600 bg-primary-50 shadow-md"
          : "border-neutral-200 bg-white hover:border-primary-300 hover:shadow-sm"
      }`}
    >
      {children}
    </button>
  );
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  const pieces = Array.from({ length: 24 });
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((_, i) => {
        const left = `${(i * 41) % 100}%`;
        const delay = `${(i % 8) * 0.12}s`;
        const color = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444"][i % 4];
        return (
          <span
            key={i}
            className="absolute top-0 h-3 w-2 rounded-sm"
            style={{
              left,
              background: color,
              animation: `confetti-fall ${1.6 + (i % 4) * 0.3}s ${delay} ease-in forwards`,
            }}
          />
        );
      })}
    </div>
  );
}

export function OnboardingWizard({ initialStep = "welcome" }: WizardProps) {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<StepKey>(initialStep);
  const [interests, setInterests] = useState<string[]>([]);
  const [level, setLevel] = useState("");
  const [goal, setGoal] = useState("");
  const [liveChallenges, setLiveChallenges] = useState<Challenge[]>([]);
  const [saving, setSaving] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const visitedRef = useRef<string[]>([]);

  const profile = useMemo(() => normalizeOnboarding(user?.onboarding), [user]);
  const name = greetingName(user?.name);
  const firstChallenge = useMemo<RecommendedChallenge>(
    () => pickFirstChallenge(interests, level, liveChallenges),
    [interests, level, liveChallenges]
  );
  const pathSlug = recommendedPathSlug(interests);
  const pathLabel = recommendedPathLabel(interests);
  const weeklyXp = weeklyXpEstimate(level);

  useEffect(() => {
    communityApi
      .listChallenges({ per_page: 20, difficulty: "easy" })
      .then((d) => setLiveChallenges(d.challenges || []))
      .catch(() => {});
  }, []);

  // If onboarding was already completed, leave the page.
  useEffect(() => {
    if (isOnboardingComplete(user?.onboarding)) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const persist = useCallback(
    async (patch: Record<string, unknown>, then?: Fn) => {
      setSaving(true);
      try {
        const res: any = await apiClient.auth.updateProfile({
          onboarding: patch,
        });
        if (res?.user?.onboarding) {
          updateUser({ onboarding: res.user.onboarding });
        } else if (res?.onboarding) {
          updateUser({ onboarding: res.onboarding });
        } else {
          updateUser({
            onboarding: {
              ...normalizeOnboarding(user?.onboarding),
              ...patch,
            } as any,
          });
        }
        then?.();
      } catch {
        // Offline/API failure: continue locally so users aren't blocked.
        updateUser({
          onboarding: {
            ...normalizeOnboarding(user?.onboarding),
            ...patch,
          } as any,
        });
        then?.();
      } finally {
        setSaving(false);
      }
    },
    [updateUser, user]
  );

  const go = (next: StepKey) => {
    if (!visitedRef.current.includes(step)) visitedRef.current.push(step);
    setStep(next);
  };

  const handleSkip = () => {
    persist(
      { status: "skipped" },
      () => {
        router.replace("/dashboard");
      }
    );
  };

  const startOnboarding = () => {
    persist({ status: "in_progress" }, () => go("interests"));
  };

  const toggleInterest = (id: string) => {
    setInterests((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, id];
    });
  };

  const finishInterests = () => {
    persist({ interests, status: "in_progress" }, () => go("level"));
  };

  const finishLevel = () => {
    persist({ level, status: "in_progress" }, () => go("goal"));
  };

  const finishGoal = () => {
    persist({ goal, status: "in_progress" }, () => go("personalize"));
  };

  const finishPersonalize = () => {
    persist({ status: "in_progress" }, () => go("dashboard"));
  };

  const openFirstChallenge = () => {
    router.push(firstChallenge.url);
  };

  const finishChallenge = () => {
    setShowReward(true);
    persist(
      { first_challenge_completed: true, status: "in_progress" },
      () => {
        setTimeout(() => go("reward"), 600);
      }
    );
  };

  const complete = () => {
    persist({ status: "completed" }, () => {
      router.replace("/dashboard");
    });
  };

  switch (step) {
    case "welcome":
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-50 via-white to-white px-6">
          <div className="w-full max-w-2xl text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-600 to-indigo-600 text-4xl shadow-lg shadow-primary-200">
              🏆
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
              Welcome, {name}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-600">
              Ascendly is where engineers compete, level up, and master the
              technologies that power the world. Let&rsquo;s build your path.
            </p>
            <div className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                { icon: "🎯", label: "Real challenges" },
                { icon: "🏅", label: "Earn badges" },
                { icon: "📈", label: "Track rank" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <div className="text-2xl">{f.icon}</div>
                  <p className="mt-2 text-sm font-medium text-neutral-700">
                    {f.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center gap-3">
              <Button size="lg" onClick={startOnboarding} disabled={saving}>
                {saving ? "Setting up..." : "Build my path"}
              </Button>
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-neutral-500 hover:text-neutral-700 hover:underline"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      );

    case "interests":
      return (
        <StepShell
          title="What do you want to master?"
          subtitle={`Pick up to ${MAX_INTERESTS}. We'll personalize every challenge to you.`}
          step={1}
          onContinue={finishInterests}
          continueDisabled={interests.length === 0 || saving}
          continueLabel={saving ? "Saving..." : "Continue"}
          onSkip={handleSkip}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INTEREST_OPTIONS.map((option) => {
              const selected = interests.includes(option.id);
              return (
                <OptionCard
                  key={option.id}
                  selected={selected}
                  onClick={() => toggleInterest(option.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden>
                      {option.icon}
                    </span>
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {option.label}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {selected
                          ? "Selected ✓"
                          : `Tap to add (${interests.length}/${MAX_INTERESTS})`}
                      </p>
                    </div>
                  </div>
                </OptionCard>
              );
            })}
          </div>
        </StepShell>
      );

    case "level":
      return (
        <StepShell
          title="What's your level?"
          subtitle="This calibrates difficulty so every challenge is a win you can build on."
          step={2}
          onContinue={finishLevel}
          continueDisabled={!level || saving}
          continueLabel={saving ? "Saving..." : "Continue"}
          onSkip={handleSkip}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LEVEL_OPTIONS.map((option) => (
              <OptionCard
                key={option.id}
                selected={level === option.id}
                onClick={() => setLevel(option.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {option.emoji}
                  </span>
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {option.label}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {option.description}
                    </p>
                  </div>
                </div>
              </OptionCard>
            ))}
          </div>
        </StepShell>
      );

    case "goal":
      return (
        <StepShell
          title="Why are you here?"
          subtitle="We'll shape your roadmap around your goal."
          step={3}
          onContinue={finishGoal}
          continueDisabled={!goal || saving}
          continueLabel={saving ? "Saving..." : "Continue"}
          onSkip={handleSkip}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {GOAL_OPTIONS.map((option) => (
              <OptionCard
                key={option.id}
                selected={goal === option.id}
                onClick={() => setGoal(option.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {option.emoji}
                  </span>
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {option.label}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {option.description}
                    </p>
                  </div>
                </div>
              </OptionCard>
            ))}
          </div>
        </StepShell>
      );

    case "personalize":
      return (
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary-200">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">
              Building your path
            </h2>
            <div className="mx-auto mt-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full w-full animate-[progress-fill_1.8s_ease-in-out_forwards] rounded-full bg-gradient-to-r from-primary-600 to-indigo-500" />
            </div>
            <p className="mt-6 text-sm text-neutral-500">
              Matching challenges, roadmap, and weekly targets…
            </p>
            <button
              type="button"
              onClick={finishPersonalize}
              className="mt-8 text-primary-700 hover:underline"
            >
              Skip animation →
            </button>
          </div>
        </div>
      );

    case "dashboard":
      return (
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-900">
              Your first day, {name}
            </h1>
            <p className="mt-2 text-neutral-600">{goalMotivation(goal)}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Recommended path
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-2xl">
                  🛣️
                </span>
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {pathLabel} Path
                  </p>
                  <p className="text-sm text-neutral-500">Your curated roadmap</p>
                </div>
              </div>
              <Link
                href={`/learning-paths/${pathSlug}`}
                className="mt-5 inline-flex text-sm font-medium text-primary-700 hover:underline"
              >
                View roadmap →
              </Link>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Weekly XP target
              </p>
              <p className="mt-3 text-3xl font-bold text-primary-700">
                {weeklyXp} XP
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {dailyObjectiveLabel(interests)} · every day
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full w-0 rounded-full bg-gradient-to-r from-primary-600 to-indigo-500 transition-all duration-1000" />
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-indigo-50 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-primary-700">
                  Your first challenge
                </p>
                <h2 className="mt-1 text-xl font-bold text-neutral-900">
                  {firstChallenge.title}
                </h2>
                <p className="mt-1 max-w-lg text-sm text-neutral-600">
                  {firstChallenge.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    {firstChallenge.difficulty}
                  </span>
                  <span>⭐ {firstChallenge.stats.avg_rating.toFixed(1)}</span>
                  <span>
                    {new Intl.NumberFormat().format(
                      firstChallenge.stats.attempts
                    )}{" "}
                    attempts
                  </span>
                  <span>
                    {Math.round(
                      firstChallenge.stats.completion_rate * 100
                    )}% completion
                  </span>
                </div>
              </div>
              <Button size="lg" onClick={() => go("first-challenge")}>
                Start now
              </Button>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
          </div>
        </div>
      );

    case "first-challenge":
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-50 to-white px-6">
          <div className="w-full max-w-2xl rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-4xl shadow-lg shadow-amber-200">
              ⚡
            </div>
            <h2 className="mt-6 text-2xl font-bold text-neutral-900">
              Ready for your first win?
            </h2>
            <h3 className="mt-2 text-xl font-semibold text-primary-700">
              {firstChallenge.title}
            </h3>
            <p className="mx-auto mt-3 max-w-md text-neutral-600">
              {firstChallenge.description}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                {firstChallenge.difficulty}
              </span>
              <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                ⭐ {firstChallenge.stats.avg_rating.toFixed(1)} rating
              </span>
              <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                🎯 {Math.round(firstChallenge.stats.completion_rate * 100)}% of
                learners win
              </span>
            </div>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" onClick={openFirstChallenge}>
                Start challenge
              </Button>
              <Button size="lg" variant="outline" onClick={finishChallenge}>
                I already did a challenge
              </Button>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              className="mt-6 text-sm text-neutral-500 hover:text-neutral-700 hover:underline"
            >
              Skip for now
            </button>
          </div>
        </div>
      );

    case "reward":
      return (
        <div className="flex min-h-screen items-center justify-center px-6">
          <Confetti show={showReward} />
          <div className="w-full max-w-lg text-center">
            <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-amber-300 opacity-30" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-5xl shadow-xl shadow-amber-200">
                🏅
              </div>
            </div>
            <h2 className="mt-8 text-3xl font-extrabold text-neutral-900">
              First Blood earned!
            </h2>
            <p className="mt-3 text-lg text-neutral-600">
              Badge unlocked · +100 XP · Level 1 reached
            </p>
            <div className="mx-auto mt-6 max-w-xs rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                First Blood
              </p>
              <p className="mt-1 text-xs text-amber-700/80">
                Complete your first challenge
              </p>
            </div>
            <div className="mt-10 flex justify-center">
              <Button size="lg" onClick={() => go("finish")}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      );

    case "finish":
      return (
        <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-10 text-center">
          <h2 className="text-3xl font-extrabold text-neutral-900">
            You&rsquo;re ready to ascend, {name}
          </h2>
          <p className="mt-3 max-w-lg text-lg text-neutral-600">
            Three ways to keep climbing. Which one calls to you?
          </p>
          <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
            <Link
              href={`/learning-paths/${pathSlug}`}
              className="group rounded-2xl border-2 border-neutral-200 bg-white p-6 text-left transition-all hover:border-primary-400 hover:shadow-lg"
            >
              <span className="text-3xl">🛣️</span>
              <p className="mt-3 font-semibold text-neutral-900">
                My {pathLabel} path
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Follow your curated roadmap
              </p>
              <p className="mt-3 text-sm font-medium text-primary-700 group-hover:underline">
                Open →
              </p>
            </Link>
            <Link
              href="/challenges"
              className="group rounded-2xl border-2 border-neutral-200 bg-white p-6 text-left transition-all hover:border-primary-400 hover:shadow-lg"
            >
              <span className="text-3xl">🎯</span>
              <p className="mt-3 font-semibold text-neutral-900">
                Explore challenges
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Browse the full library
              </p>
              <p className="mt-3 text-sm font-medium text-primary-700 group-hover:underline">
                Open →
              </p>
            </Link>
            <Link
              href="/arena"
              className="group rounded-2xl border-2 border-neutral-200 bg-white p-6 text-left transition-all hover:border-primary-400 hover:shadow-lg"
            >
              <span className="text-3xl">⚔️</span>
              <p className="mt-3 font-semibold text-neutral-900">
                Compete in the Arena
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Race rivals, climb ranks
              </p>
              <p className="mt-3 text-sm font-medium text-primary-700 group-hover:underline">
                Open →
              </p>
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-4">
            <Button size="lg" onClick={complete} disabled={saving}>
              {saving ? "Finishing..." : "Finish setup"}
            </Button>
          </div>
        </div>
      );

    default:
      return null;
  }
}