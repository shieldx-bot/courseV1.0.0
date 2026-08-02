"use client";

import { useState } from "react";
import type { CreatorProfile } from "@/types/community";

/* ---------- Helpers ---------- */

const RANK_GRADIENTS: Record<string, string> = {
  bronze: "from-orange-700/90 to-orange-500/80",
  silver: "from-slate-600/90 to-slate-400/80",
  gold: "from-amber-600/90 to-amber-400/80",
  platinum: "from-cyan-700/90 to-cyan-400/80",
  diamond: "from-sky-700/90 to-sky-400/80",
  master: "from-fuchsia-700/90 to-fuchsia-400/80",
  grandmaster: "from-rose-700/90 to-rose-400/80",
};

const RANK_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
  master: "Master",
  grandmaster: "Grandmaster",
};

function rankKey(rank?: string): string {
  return (rank || "bronze").toLowerCase();
}

function formatNumber(n: number): string {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/* ---------- Socials ---------- */

const SOCIAL_ICONS: Record<string, { label: string; href?: (u: string) => string }> = {
  twitter: { label: "𝕏", href: (u) => `https://twitter.com/${u.replace(/^@/, "")}` },
  github: { label: "⌥", href: (u) => `https://github.com/${u.replace(/^@/, "")}` },
  linkedin: { label: "in", href: (u) => `https://linkedin.com/in/${u.replace(/^@/, "")}` },
  youtube: { label: "▶", href: (u) => `https://youtube.com/@${u.replace(/^@/, "")}` },
};

function SocialLinks({ profile }: { profile: CreatorProfile }) {
  const social = profile.social || {};
  return (
    <div className="flex flex-wrap items-center gap-2">
      {profile.website && (
        <a
          href={/^https?:\/\//.test(profile.website) ? profile.website : `https://${profile.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
        >
          🌐 {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      )}
      {Object.entries(social).map(([key, value]) => {
        const cfg = SOCIAL_ICONS[key];
        if (!cfg || !value) return null;
        const href = cfg.href ? cfg.href(value) : `#${key}`;
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${key} profile`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-600 transition-colors hover:bg-primary-50 hover:text-primary-700"
          >
            {cfg.label}
          </a>
        );
      })}
    </div>
  );
}

/* ---------- Component ---------- */

interface ProfileHeaderProps {
  profile: CreatorProfile;
  isSelf: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  following: boolean;
  busy: boolean;
}

export function ProfileHeader({ profile, isSelf, onFollow, onUnfollow, following, busy }: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);

  const displayName = profile.display_name || profile.user_name || "Anon";
  const initial = (displayName || "A").charAt(0).toUpperCase();
  const avatar = profile.avatar_url;
  const rk = rankKey(profile.rank);
  const gradient = RANK_GRADIENTS[rk] || RANK_GRADIENTS.bronze;
  const rankLabel = RANK_LABELS[rk] || profile.rank || "Bronze";
  const followers = profile.followers_count ?? 0;
  const followingCount = profile.following_count ?? 0;
  const verified = profile.verified ?? profile.is_verified ?? false;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/60">
      {/* Cover */}
      <div className={`relative h-28 bg-gradient-to-r ${gradient} sm:h-36`} aria-hidden="true">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_50%,white_0,transparent_45%),radial-gradient(circle_at_80%_20%,white_0,transparent_40%)]" />
        <div className="absolute bottom-3 left-4 flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Level {profile.level || "Rookie"}
        </div>
      </div>

      <div className="px-4 pb-6 sm:px-6">
        {/* Avatar + actions */}
        <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white text-3xl font-bold text-primary-700 shadow-md ring-4 ring-white sm:h-24 sm:w-24">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">{displayName}</h1>
                {verified && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                    title="Verified member"
                  >
                    ✓ Verified
                  </span>
                )}
                {profile.title && <span className="hidden text-sm text-neutral-400 sm:inline">· {profile.title}</span>}
              </div>
              <p className="mt-0.5 text-sm text-neutral-500">@{profile.user_name || "member"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pb-1">
            {!isSelf && (
              <button
                onClick={following ? onUnfollow : onFollow}
                disabled={busy}
                className={`rounded-xl px-5 py-2 text-sm font-semibold transition-colors ${
                  following
                    ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    : "bg-primary-600 text-white hover:bg-primary-700"
                } disabled:opacity-50`}
              >
                {busy ? "…" : following ? "Following ✓" : "Follow"}
              </button>
            )}
            <button
              onClick={copyLink}
              className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
            >
              {copied ? "Copied ✓" : "Share"}
            </button>
          </div>
        </div>

        {/* Bio + social */}
        {profile.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-600">{profile.bio}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
          {profile.location && <span>📍 {profile.location}</span>}
          {profile.languages && profile.languages.length > 0 && (
            <span>💬 {profile.languages.join(", ")}</span>
          )}
          <span>🗓 Joined {timeAgo(profile.joined_at || profile.created_at)}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-neutral-900">{formatNumber(followers)}</span>
            <span className="text-neutral-400">followers</span>
            <span className="mx-1 text-neutral-300">·</span>
            <span className="font-semibold text-neutral-900">{formatNumber(followingCount)}</span>
            <span className="text-neutral-400">following</span>
          </div>
        </div>
        <div className="mt-3">
          <SocialLinks profile={profile} />
        </div>

        {/* Stat strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-5 sm:grid-cols-4 lg:grid-cols-6">
          <StatCard label="Rank" value={rankLabel} accent="text-primary-700" />
          <StatCard label="Rating" value={profile.rating !== undefined ? formatNumber(profile.rating) : profile.competitive_rating !== undefined ? formatNumber(profile.competitive_rating) : "—"} accent="text-amber-600" />
          <StatCard label="XP" value={profile.total_xp !== undefined ? formatNumber(profile.total_xp) : profile.xp !== undefined ? formatNumber(profile.xp) : "—"} accent="text-cyan-600" />
          <StatCard label="Reputation" value={profile.reputation !== undefined ? formatNumber(profile.reputation) : "—"} accent="text-emerald-600" />
          <StatCard label="Streak" value={profile.current_streak ? `${profile.current_streak} 🔥` : "0"} accent="text-rose-500" />
          <StatCard label="Best streak" value={profile.longest_streak ? `${profile.longest_streak}d` : "—"} accent="text-neutral-700" />
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2.5 text-center">
      <p className={`text-base font-bold ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
    </div>
  );
}