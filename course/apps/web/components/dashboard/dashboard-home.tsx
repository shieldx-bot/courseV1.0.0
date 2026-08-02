"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { communityApi } from "@/lib/community-api";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityEvent, Challenge, Skill } from "@/types/community";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardWidgets } from "@/components/dashboard/dashboard-widgets";

export interface ContinueData {
  course_id: string;
  course_title: string;
  course_slug: string;
  lesson_id: string;
  lesson_title: string;
  lesson_index: number;
  lesson_count: number;
}

export interface DashboardData {
  skills: Skill[];
  weak: Skill[];
  recommended: Challenge[];
  mentor: Challenge[];
  bookmarks: Challenge[];
  activity: ActivityEvent[];
  competitions: Challenge[];
  continue: ContinueData | null;
  progress: { course_title: string; progress_pct: number }[];
}

export const emptyDashboard: DashboardData = {
  skills: [], weak: [], recommended: [], mentor: [], bookmarks: [],
  activity: [], competitions: [], continue: null, progress: [],
};

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHome() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [
        skillsRes, recommendedRes, mentorRes, bookmarksRes,
        activityRes, compRes, continueRes, progressRes,
      ] = await Promise.allSettled([
        communityApi.getMySkills(),
        communityApi.getRecommended(3).catch(() => ({ challenges: [] })),
        communityApi.getMentorRecommendations(3).catch(() => ({ recommendations: [] })),
        communityApi.getBookmarked(3).catch(() => ({ challenges: [] })),
        communityApi.getMyActivity(8).catch(() => ({ events: [] })),
        communityApi.listChallenges({ sort: "popular", per_page: 3 }).catch(() => ({ challenges: [] })),
        apiFetch<ContinueData>("/progress/continue").catch(() => null),
        apiFetch<{ course_title: string; progress_pct: number }[]>("/progress/summary").catch(() => []),
      ]);
      setData({
        skills: skillsRes.status === "fulfilled" ? skillsRes.value.skills : [],
        weak: skillsRes.status === "fulfilled" ? skillsRes.value.weak_skills || [] : [],
        recommended: recommendedRes.status === "fulfilled" ? recommendedRes.value.challenges : [],
        mentor: mentorRes.status === "fulfilled" ? mentorRes.value.recommendations : [],
        bookmarks: bookmarksRes.status === "fulfilled" ? bookmarksRes.value.challenges : [],
        activity: activityRes.status === "fulfilled" ? activityRes.value.events : [],
        competitions: compRes.status === "fulfilled" ? compRes.value.challenges : [],
        continue: continueRes.status === "fulfilled" ? (continueRes.value as ContinueData | null) : null,
        progress: progressRes.status === "fulfilled" ? (progressRes.value as any) || [] : [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const firstName = user?.name?.split(" ")[0] || "Challenger";

  if (loading) {
    return (
      <section className="py-10">
        <div className="mx-auto max-w-page px-6">
          <Skeleton className="h-8 w-72" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10">
      <div className="mx-auto max-w-page px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary-700">{greeting()}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">
              {`${firstName}'s Command Center`}
            </h1>
            <p className="mt-2 text-neutral-600">
              One clear next action. One page for the whole arena.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/challenges"><Button>➕ New challenge</Button></Link>
            <Link href="/arena"><Button variant="outline">⚔️ Enter arena</Button></Link>
          </div>
        </div>

        <DashboardStats data={data} />

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <DashboardHero data={data} />
          <DashboardWidgets data={data} />
        </div>
      </div>
    </section>
  );
}