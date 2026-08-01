"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { communityApi } from "@/lib/community-api";
import type { CreatorProfile, Skill, ActivityEvent, Challenge } from "@/types/community";
import { ProfileHeader } from "./profile-header";
import {
  SkillIdentity,
  ContributionCalendar,
  ProfileAnalytics,
  CreatorShowcase,
  ActivityTimeline,
} from "./profile-sections";

interface ProfileViewProps {
  mode: "self" | "public";
  userId?: string;
}

export function ProfileView({ mode, userId }: ProfileViewProps) {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setProfile(null);
      setSkills([]);
      setEvents([]);
      setChallenges([]);
      try {
        if (mode === "self") {
          const prof = await communityApi.getMyCreatorProfile();
          const [skillRes, actRes, chalRes] = await Promise.all([
            communityApi.getMySkills(),
            communityApi.getMyActivity(60),
            communityApi.getMyChallenges(20),
          ]);
          if (cancelled) return;
          setProfile(prof);
          setSkills(skillRes.skills || []);
          setEvents(actRes.events || []);
          setChallenges(chalRes.challenges || []);
        } else if (userId) {
          const prof = await communityApi.getCreatorProfile(userId);
          if (cancelled) return;
          setProfile(prof);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load profile");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mode, userId]);

  const toggleFollow = useCallback(async () => {
    if (!profile || mode !== "public") return;
    setBusy(true);
    setNotice(null);
    try {
      if (following) {
        await communityApi.unfollowCreator(profile.user_id);
      } else {
        await communityApi.followCreator(profile.user_id);
      }
      setFollowing((f) => !f);
    } catch (e: any) {
      setNotice(e?.message || "Could not update follow status");
    } finally {
      setBusy(false);
    }
  }, [profile, mode, following]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="text-4xl">🔍</div>
        <h1 className="mt-4 text-xl font-bold text-neutral-900">Profile not available</h1>
        <p className="mt-2 text-sm text-neutral-500">{error}. The member may have removed their public profile, or the link is invalid.</p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
          Back to home
        </Link>
      </div>
    );
  }

  if (!profile) {
    return <ProfileSkeleton />;
  }

  const isSelf = mode === "self";
  const shareUrl = isSelf && profile.user_id ? `/profile/${profile.user_id}` : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      {shareUrl && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-50 px-4 py-3 ring-1 ring-primary-100">
          <p className="text-sm text-primary-900">
            This is your public identity — share it with your network.
          </p>
          <Link href={shareUrl} className="text-sm font-bold text-primary-700 underline-offset-2 hover:underline">
            View public profile →
          </Link>
        </div>
      )}

      <ProfileHeader
        profile={profile}
        isSelf={isSelf}
        onFollow={toggleFollow}
        onUnfollow={toggleFollow}
        following={following}
        busy={busy}
      />

      {notice && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isSelf ? (
          <>
            <SkillIdentity skills={skills} />
            <ContributionCalendar events={events} />
            <ProfileAnalytics challenges={challenges} skills={skills} />
            <CreatorShowcase profile={profile} challenges={challenges} showEmpty />
            <ActivityTimeline events={events} />
          </>
        ) : (
          <>
            <CreatorShowcase profile={profile} challenges={[]} showEmpty />
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
              <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">🔒 Private sections</h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                This member keeps their <strong>skill graph</strong>, <strong>contribution calendar</strong> and{" "}
                <strong>detailed analytics</strong> private.
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Follow them or compete together in the arena to unlock richer insights about how they learn.
              </p>
              <Link href="/challenges" className="mt-4 inline-flex rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800">
                Battle a challenge →
              </Link>
            </div>
            <ActivityTimeline events={events} />
          </>
        )}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/60">
        <div className="h-28 bg-gradient-to-r from-neutral-200 to-neutral-100 sm:h-36" />
        <div className="px-4 pb-6 sm:px-6">
          <div className="-mt-10 flex items-end justify-between">
            <div className="h-20 w-20 rounded-2xl bg-neutral-200 ring-4 ring-white sm:h-24 sm:w-24" />
            <div className="flex gap-2 pb-1">
              <div className="h-9 w-24 rounded-xl bg-neutral-200" />
              <div className="h-9 w-20 rounded-xl bg-neutral-200" />
            </div>
          </div>
          <div className="mt-4 h-4 w-48 rounded bg-neutral-200" />
          <div className="mt-2 h-3 w-72 rounded bg-neutral-100" />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-neutral-100 p-3">
                <div className="h-4 w-12 rounded bg-neutral-200" />
                <div className="mt-2 h-2 w-10 rounded bg-neutral-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-64 rounded-2xl bg-neutral-100 shadow-sm ring-1 ring-neutral-200/60" />
        ))}
      </div>
    </div>
  );
}