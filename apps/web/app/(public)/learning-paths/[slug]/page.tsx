import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { makeMetadata } from "@/lib/metadata";
import type { LearningPath } from "@/types";
import { EnrollButton } from "@/components/learning-paths/EnrollButton";

export const metadata = makeMetadata({
  title: "Learning Path Details | Ascendly",
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

async function getPath(slug: string): Promise<LearningPath | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${apiBase}/api/v1/learning-paths/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data;
  } catch {
    return null;
  }
}

function LearningPathContent({ path }: { path: LearningPath }) {
  const isEnrolled = !!path.progress;

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <div className="mb-2">
          <Link
            href="/learning-paths"
            className="text-sm text-accent-500 hover:text-accent-600"
          >
            &larr; All learning paths
          </Link>
        </div>

        <div className="flex items-start gap-4">
          <span className="text-5xl">{GOAL_ICONS[path.goal] || "📚"}</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-primary-900">{path.title}</h1>
              <Badge variant="accent">{path.duration_months} months</Badge>
              {path.skill_level !== "any" && (
                <Badge variant="primary" className="capitalize">{path.skill_level}</Badge>
              )}
            </div>
            <p className="mt-3 text-lg text-neutral-600">{path.description}</p>
          </div>
        </div>

        {path.related_careers && path.related_careers.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-700">Perfect for:</span>
            {path.related_careers.map((career) => (
              <Badge key={career}>{career}</Badge>
            ))}
          </div>
        )}

        {path.progress && (
          <div className="mt-6 rounded-lg bg-accent-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-accent-700">
                Your progress: {path.progress.completed_courses} / {path.progress.total_courses} courses
              </span>
              <span className="text-sm font-semibold text-accent-700">
                {path.progress.percent}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-accent-200">
              <div
                className="h-full rounded-full bg-accent-500 transition-all"
                style={{ width: `${path.progress.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-xl font-semibold text-primary-900">Courses in this path</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Complete all {path.courses?.length || 0} courses in order to achieve your goal.
          </p>

          <div className="mt-6 space-y-4">
            {path.courses?.map((course, index) => (
              <Link key={course.id} href={`/courses/${course.category_slug}/${course.slug}`}>
                <Card className="flex items-start gap-4 p-4 transition-colors hover:border-accent-500">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-neutral-900">{course.title}</h3>
                    {course.instructor_name && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        by {course.instructor_name}
                      </p>
                    )}
                    <p className="mt-1 line-clamp-1 text-sm text-neutral-600">
                      {course.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-neutral-500">{course.lesson_count} lessons</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {path.outcome && path.outcome.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold text-primary-900">What you&apos;ll achieve</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {path.outcome.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="mt-0.5 text-accent-500">&check;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10">
          {isEnrolled ? (
            <Link href={path.courses && path.courses.length > 0 ? `/courses/${path.courses[0].slug}` : "/courses"}>
              <Button size="lg">Continue learning</Button>
            </Link>
          ) : (
            <EnrollButton pathId={path.id} pathSlug={path.slug} />
          )}
        </div>
      </div>
    </section>
  );
}

export default async function LearningPathDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const path = await getPath(params.slug);
  if (!path) notFound();

  return <LearningPathContent path={path} />;
}
