"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/components/dashboard/dashboard-home";

export function DashboardHero({ data }: { data: DashboardData }) {
  const hero = data.continue
    ? { kind: "continue" as const, ...data.continue }
    : { kind: "challenge" as const, challenge: data.recommended[0] || data.mentor[0] };

  return (
    <div className="lg:col-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-indigo-700 text-white shadow-lg">
      <div className="p-6">
        <p className="text-sm font-medium uppercase tracking-wide text-primary-100">
          {hero.kind === "continue" ? "Continue learning" : "Recommended next challenge"}
        </p>
        {hero.kind === "continue" ? (
          <>
            <h2 className="mt-2 text-2xl font-bold">{hero.course_title}</h2>
            <p className="mt-1 text-primary-100">
              {hero.lesson_title} · Lesson {hero.lesson_index + 1} of {hero.lesson_count}
            </p>
            <Link href={`/learn/${hero.course_slug}/${hero.lesson_id}`}>
              <Button className="mt-5 bg-white text-primary-800 hover:bg-primary-50">▶ Continue where you left off</Button>
            </Link>
          </>
        ) : hero.challenge ? (
          <>
            <h2 className="mt-2 text-2xl font-bold">{hero.challenge.title}</h2>
            <p className="mt-1 line-clamp-2 text-primary-100">{hero.challenge.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-2.5 py-1">{hero.challenge.difficulty}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">⭐ {hero.challenge.stats.avg_rating.toFixed(1)}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">
                {Math.round(hero.challenge.stats.completion_rate * 100)}% win rate
              </span>
            </div>
            <Link href={`/challenges/${hero.challenge._id}`}>
              <Button className="mt-5 bg-white text-primary-800 hover:bg-primary-50">Solve this challenge</Button>
            </Link>
          </>
        ) : (
          <>
            <h2 className="mt-2 text-2xl font-bold">Start your journey</h2>
            <p className="mt-1 text-primary-100">Pick a challenge or course to begin.</p>
            <Link href="/challenges">
              <Button className="mt-5 bg-white text-primary-800 hover:bg-primary-50">Browse challenges</Button>
            </Link>
          </>
        )}
      </div>
      <div className="grid gap-4 border-t border-white/10 bg-white/5 p-6 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-primary-100">Recommended for you</p>
          <ul className="mt-3 space-y-3">
            {data.recommended.slice(0, 3).map((c) => (
              <li key={c._id}>
                <Link href={`/challenges/${c._id}`} className="block rounded-xl bg-white/10 p-3 transition-all hover:bg-white/20">
                  <p className="font-medium text-white">{c.title}</p>
                  <p className="mt-0.5 text-xs text-primary-100">
                    {c.difficulty} · ⭐ {c.stats.avg_rating.toFixed(1)} · {new Intl.NumberFormat().format(c.stats.attempts)} attempts
                  </p>
                </Link>
              </li>
            ))}
            {!data.recommended.length && !data.mentor.length && (
              <li className="text-sm text-primary-100">No recommendations yet — solve a challenge to unlock AI suggestions.</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-primary-100">Weakest skills</p>
          <ul className="mt-3 space-y-3">
            {(data.weak.length ? data.weak.slice(0, 3) : data.skills.slice(0, 3)).map((s) => (
              <li key={s.skill_id}>
                <Link href="/skills" className="block rounded-xl bg-white/10 p-3 transition-all hover:bg-white/20">
                  <p className="font-medium text-white">{s.name}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${s.mastery_score}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-primary-100">{s.mastery_score}% mastery</p>
                </Link>
              </li>
            ))}
            {!data.skills.length && <li className="text-sm text-primary-100">No skills tracked yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}