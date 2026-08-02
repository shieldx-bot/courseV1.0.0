import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { makeMetadata } from "@/lib/metadata";
import type { LearningPath } from "@/types";

export const metadata = makeMetadata({
  title: "Learning Paths — Structured Career Roadmaps | Ascendly",
  description:
    "Follow a structured learning path designed by experts. Pick a career goal and get a step-by-step roadmap of courses to get there.",
  path: "/learning-paths",
});

const GOAL_ICONS: Record<string, string> = {
  data_analyst: "📊",
  web_developer: "💻",
  ai_specialist: "🤖",
  designer: "🎨",
  marketer: "📈",
  business_leader: "🏢",
  career_growth: "🚀",
};

const GOAL_LABELS: Record<string, string> = {
  data_analyst: "Data & Analytics",
  web_developer: "Web Development",
  ai_specialist: "AI & Automation",
  designer: "Design & Creative",
  marketer: "Marketing",
  business_leader: "Business & Leadership",
  career_growth: "Career Growth",
};

export default async function LearningPathsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const goal = typeof searchParams.goal === "string" ? searchParams.goal : "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  let paths: LearningPath[] = [];

  try {
    const res = await fetch(
      `${apiBase}/api/v1/learning-paths${goal ? `?goal=${goal}` : ""}`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) {
      const body = await res.json();
      paths = body.data || [];
    }
  } catch {
    paths = [];
  }

  const goals = Object.keys(GOAL_LABELS);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Learning paths</h1>
        <p className="mt-2 text-neutral-600">
          Not sure where to start? Pick a career goal and follow a step-by-step roadmap.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/learning-paths"
            className={`rounded-full px-3 py-1 text-sm ${!goal ? "bg-primary-700 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
          >
            All
          </Link>
          {goals.map((g) => (
            <Link
              key={g}
              href={`/learning-paths?goal=${g}`}
              className={`rounded-full px-3 py-1 text-sm ${goal === g ? "bg-primary-700 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
            >
              {GOAL_ICONS[g]} {GOAL_LABELS[g]}
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((path) => (
            <Link key={path.id} href={`/learning-paths/${path.slug}`}>
              <Card className="h-full overflow-hidden transition-colors hover:border-accent-500">
                <div className="aspect-[3/1] bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                  <span className="text-4xl">{GOAL_ICONS[path.goal] || "📚"}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-neutral-900">{path.title}</h3>
                    <Badge variant="accent" className="shrink-0 text-xs">
                      {path.duration_months}mo
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
                    {path.short_description}
                  </p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-neutral-500">
                    <span>{path.course_count} courses</span>
                    {path.skill_level !== "any" && (
                      <>
                        <span aria-hidden="true">&middot;</span>
                        <span className="capitalize">{path.skill_level}</span>
                      </>
                    )}
                  </div>
                  {path.outcome && path.outcome.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {path.outcome.slice(0, 2).map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-500">
                          <span className="mt-0.5 text-primary-500">&check;</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {paths.length === 0 && (
          <div className="mt-12 text-center text-neutral-500">
            <p>No learning paths found.</p>
          </div>
        )}
      </div>
    </section>
  );
}
