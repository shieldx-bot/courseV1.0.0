import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Course, Category } from "@/types";
import { makeMetadata, SITE_URL } from "@/lib/metadata";
import { JsonLd } from "@/components/json-ld";
import Image from "next/image";
import { BookOpen, User, Clock, Zap } from "lucide-react";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function hasMicroLesson(course: Course): boolean {
  return course.syllabus?.some((lesson) => lesson.duration_seconds > 0 && lesson.duration_seconds <= 600) ?? false;
}

export async function generateMetadata({ params }: { params: { category: string } }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  let category: Category | null = null;
  try {
    const res = await fetch(`${apiBase}/api/v1/categories/${params.category}`, { next: { revalidate: 60 } });
    if (res.ok) category = await res.json();
  } catch {}

  return makeMetadata({
    title: `${category?.name || params.category} Courses — Ascendly`,
    description: `Browse ${category?.name || params.category} courses included with every Ascendly membership.`,
    path: `/courses/${params.category}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { category: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const maxLessonDuration = typeof searchParams.max_lesson_duration === "string"
    ? parseInt(searchParams.max_lesson_duration, 10)
    : 0;

  let category: Category | null = null;
  let courses: Course[] = [];
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const [catRes, courseRes] = await Promise.all([
      fetch(`${apiBase}/api/v1/categories/${params.category}`, { next: { revalidate: 60 } }),
      fetch(`${apiBase}/api/v1/courses?category=${params.category}&max_lesson_duration=${maxLessonDuration}`, { next: { revalidate: 60 } }),
    ]);
    if (catRes.ok) category = await catRes.json();
    if (courseRes.ok) courses = await courseRes.json();
  } catch {
    category = null;
    courses = [];
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: `${SITE_URL}/courses` },
      { "@type": "ListItem", position: 3, name: category?.name || params.category, item: `${SITE_URL}/courses/${params.category}` },
    ],
  };

  const durationOptions = [
    { value: 0, label: "All durations" },
    { value: 600, label: "Under 10 min (Micro-learning)" },
    { value: 1800, label: "Under 30 min" },
    { value: 3600, label: "Under 1 hour" },
  ] as const;

  return (
    <>
      <JsonLd data={breadcrumb} />
      <section className="py-12">
        <div className="mx-auto max-w-page px-6">
          <h1 className="text-3xl font-semibold text-primary-900">{category?.name || params.category} courses</h1>
          <p className="mt-2 text-neutral-600">{courses.length} courses included with every membership.</p>

          <form className="mt-6 flex flex-col gap-3 sm:flex-row" action={`/courses/${params.category}`} method="GET">
            <select
              name="max_lesson_duration"
              defaultValue={String(maxLessonDuration)}
              className="w-full sm:w-56 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {durationOptions.map((opt) => (
                <option key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </form>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link key={course.id} href={`/courses/${course.category_slug}/${course.slug}`}>
                <Card className="h-full p-5 hover:border-accent-500 transition-colors relative">
                  {hasMicroLesson(course) && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white">
                      <Zap className="h-3 w-3" />
                      Micro
                    </span>
                  )}
                  <Badge variant="primary">{course.category_name}</Badge>
                  <h3 className="mt-3 font-medium text-neutral-900">{course.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{course.description}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-neutral-600">
                    <span>{course.lesson_count} lessons</span>
                    {course.total_duration_seconds && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(course.total_duration_seconds)}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}