import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LearningPath } from "@/types";

const GOAL_ICONS: Record<string, string> = {
  data_analyst: "📊",
  web_developer: "💻",
  ai_specialist: "🤖",
  designer: "🎨",
  marketer: "📈",
  business_leader: "🏢",
  career_growth: "🚀",
};

async function getPaths(): Promise<LearningPath[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${apiBase}/api/v1/learning-paths?limit=6`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.data || [];
  } catch {
    return [];
  }
}

export async function LearningPathsSection() {
  const paths = await getPaths();
  if (paths.length === 0) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-page px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-primary-900">
              Follow a learning path
            </h2>
            <p className="mt-2 text-neutral-600">
              Not sure where to start? Pick a career goal and follow a step-by-step roadmap.
            </p>
          </div>
          <Link
            href="/learning-paths"
            className="hidden text-sm font-medium text-accent-500 hover:text-accent-600 sm:block"
          >
            View all paths &rarr;
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {paths.slice(0, 6).map((path) => (
            <Link key={path.id} href={`/learning-paths/${path.slug}`}>
              <Card className="h-full overflow-hidden transition-colors hover:border-accent-500">
                <div className="aspect-[3/1] bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                  <span className="text-3xl">{GOAL_ICONS[path.goal] || "📚"}</span>
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
                  <p className="mt-3 text-xs text-neutral-500">
                    {path.course_count} courses &middot; {path.skill_level !== "any" ? path.skill_level : "all levels"}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/learning-paths"
            className="text-sm font-medium text-accent-500 hover:text-accent-600"
          >
            View all paths &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
