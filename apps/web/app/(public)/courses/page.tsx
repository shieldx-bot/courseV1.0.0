import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { BookOpen, User, Clock, Zap } from "lucide-react";
import { Course, Category } from "@/types";
import { makeMetadata } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "Course Library — 2,000+ Courses Included | Ascendly",
  description:
    "Browse 2,000+ expert-led courses in business, tech, design, data, AI, and career skills. Included with every Ascendly membership.",
  path: "/courses",
});

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function hasMicroLesson(course: Course): boolean {
  return course.syllabus?.some((lesson) => lesson.duration_seconds > 0 && lesson.duration_seconds <= 600) ?? false;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  const category = typeof searchParams.category === "string" ? searchParams.category : "";
  const maxLessonDuration = typeof searchParams.max_lesson_duration === "string"
    ? parseInt(searchParams.max_lesson_duration, 10)
    : 0;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  let courses: Course[] = [];
  let categories: Category[] = [];

  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (maxLessonDuration > 0) params.set("max_lesson_duration", String(maxLessonDuration));

    const [coursesRes, catsRes] = await Promise.all([
      fetch(`${apiBase}/api/v1/courses?${params.toString()}`, { next: { revalidate: 60 } }),
      fetch(`${apiBase}/api/v1/categories`, { next: { revalidate: 60 } }),
    ]);
    if (coursesRes.ok) courses = await coursesRes.json();
    if (catsRes.ok) categories = await catsRes.json();
  } catch {
    courses = [];
    categories = [];
  }

  const durationOptions = [
    { value: 0, label: "All durations" },
    { value: 600, label: "Under 10 min (Micro-learning)" },
    { value: 1800, label: "Under 30 min" },
    { value: 3600, label: "Under 1 hour" },
  ] as const;

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Course library</h1>
        <p className="mt-2 text-neutral-600">{courses.length} courses included with every membership.</p>

        <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="/courses" method="GET">
          <Input name="search" defaultValue={search} placeholder="Search courses..." className="flex-1" />
          <input type="hidden" name="category" value={category} />
          
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
          
          <Button type="submit">Search</Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/courses"
            className={`rounded-full px-3 py-1 text-sm ${!category ? "bg-primary-700 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/courses?category=${c.slug}${search ? `&search=${encodeURIComponent(search)}` : ""}${maxLessonDuration ? `&max_lesson_duration=${maxLessonDuration}` : ""}`}
              className={`rounded-full px-3 py-1 text-sm ${category === c.slug ? "bg-primary-700 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {search && (
          <p className="mt-4 text-sm text-neutral-600">
            Showing results for &ldquo;{search}&rdquo;{category && ` in ${categories.find((c) => c.slug === category)?.name || category}`}
          </p>
        )}

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} href={`/courses/${course.category_slug}/${course.slug}`}>
              <Card className="h-full overflow-hidden transition-colors hover:border-accent-500">
                <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center relative">
                  {course.image_url ? (
                    <Image src={course.image_url} alt={course.title} loading="lazy" fill className="object-cover" />
                  ) : (
                    <BookOpen className="h-10 w-10 text-primary-400" aria-hidden="true" />
                  )}
                  
                  {hasMicroLesson(course) && (
                    <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white">
                      <Zap className="h-3 w-3" />
                      Micro
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <Badge variant="primary" className="text-xs">
                    {course.category_name}
                  </Badge>
                  <h3 className="mt-3 font-medium text-neutral-900">{course.title}</h3>
                  {course.instructor && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                      <User className="h-3 w-3" aria-hidden="true" /> {course.instructor.name}
                    </p>
                  )}
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
                </div>
              </Card>
            </Link>
          ))}
        </div>
        
        {courses.length === 0 && (
          <div className="mt-12 text-center text-neutral-500">
            <BookOpen className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
            <p>No courses found. Try adjusting your filters.</p>
          </div>
        )}
      </div>
    </section>
  );
}