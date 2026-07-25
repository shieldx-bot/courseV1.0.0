import { cn } from "@/lib/utils";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { makeMetadata } from "@/lib/metadata";
import type { LearningPath } from "@/types";

export const metadata = makeMetadata({
  title: "My Learning Paths | Ascendly",
  description: "Track your progress on enrolled learning paths.",
  path: "/my-learning-paths",
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

async function getMyPaths(): Promise<LearningPath[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${apiBase}/api/v1/learning-paths/my`, {
      credentials: "include",
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.data || [];
  } catch {
    return [];
  }
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-accent-200", className)}>
      <div
        className="h-full rounded-full bg-accent-500 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default async function MyLearningPathsPage() {
  const paths = await getMyPaths();

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-primary-900">My learning paths</h1>
            <p className="mt-2 text-neutral-600">
              Track your progress and continue where you left off.
            </p>
          </div>
          <Link href="/learning-paths">
            <Button variant="secondary">Browse all paths</Button>
          </Link>
        </div>

        {paths.length === 0 ? (
          <div className="mt-12 text-center">
            <Card className="max-w-md mx-auto p-8">
              <div className="text-5xl mb-4">🗺️</div>
              <h2 className="text-xl font-semibold text-primary-900">No learning paths yet</h2>
              <p className="mt-2 text-neutral-600">
                Start a structured learning journey by enrolling in a learning path.
              </p>
              <Link href="/learning-paths" className="mt-6 inline-block">
                <Button size="lg">Explore learning paths</Button>
              </Link>
            </Card>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((path) => (
              <Card key={path.id} className="overflow-hidden flex flex-col">
                <Link href={`/learning-paths/${path.slug}`} className="block">
                  <div className="aspect-[3/1] bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                    <span className="text-4xl">{GOAL_ICONS[path.goal] || "📚"}</span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-neutral-900">{path.title}</h3>
                      <Badge variant="accent" className="shrink-0 text-xs">
                        {path.duration_months}mo
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
                      {path.short_description}
                    </p>
                    <div className="mt-3 text-xs text-neutral-500">
                      {path.course_count} courses &middot; {path.total_lessons || "?"} lessons
                    </div>

                    {path.progress && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-accent-700">
                            {path.progress.completed_courses} / {path.progress.total_courses} courses completed
                          </span>
                          <span className="font-semibold text-accent-700">{path.progress.percent}%</span>
                        </div>
                        <ProgressBar value={path.progress.percent} className="mt-2 h-2" />
                        <p className="mt-1 text-xs text-neutral-500">
                          Enrolled {new Date(path.progress.enrolled_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-5 border-t">
                  {path.progress ? (
                    <Link
                      href={path.courses && path.courses.length > 0 ? `/courses/${path.courses[0].category_slug}/${path.courses[0].slug}` : "/courses"}
                      className="w-full"
                    >
                      <Button className="w-full">Continue learning</Button>
                    </Link>
                  ) : (
                    <Link href={`/learning-paths/${path.slug}`} className="w-full">
                      <Button variant="secondary" className="w-full">
                        View path
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}