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
  const page = typeof searchParams.page === "string" ? Math.max(1, parseInt(searchParams.page, 10) || 1) : 1;
  const maxLessonDuration = typeof searchParams.max_lesson_duration === "string"
    ? parseInt(searchParams.max_lesson_duration, 10)
    : 0;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  let courses: Course[] = [];
  let categories: Category[] = [];
  let totalPages = 1;
  let totalItems = 0;

  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (maxLessonDuration > 0) params.set("max_lesson_duration", String(maxLessonDuration));
    params.set("page", String(page));
    params.set("per_page", "10");

    const [coursesRes, catsRes] = await Promise.all([
      fetch(`${apiBase}/api/v1/courses?${params.toString()}`, { next: { revalidate: 60 } }),
      fetch(`${apiBase}/api/v1/categories`, { next: { revalidate: 60 } }),
    ]);
    if (coursesRes.ok) {
      const coursesJson = await coursesRes.json();
      courses = Array.isArray(coursesJson?.data) ? coursesJson.data : [];
      const meta = coursesJson?.meta || {};
      totalPages = meta.total_pages ?? 1;
      totalItems = meta.total ?? courses.length;
    }
    if (catsRes.ok) {
      const catsJson = await catsRes.json();
      categories = Array.isArray(catsJson?.data) ? catsJson.data : [];
    }
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

  const buildHref = (targetPage: number) => {
    const href = new URL("/courses", "http://localhost:3000");
    if (search) href.searchParams.set("search", search);
    if (category) href.searchParams.set("category", category);
    if (maxLessonDuration > 0) href.searchParams.set("max_lesson_duration", String(maxLessonDuration));
    if (targetPage > 1) href.searchParams.set("page", String(targetPage));
    return href.pathname + href.search;
  };

  const pageNumbers = (() => {
    const pages: (number | "...")[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  })();

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
         <h1 className="display-sm text-primary-900">Course library</h1>
         <p className="mt-2 body-md text-neutral-600">
           {totalItems > 0 ? `${totalItems} course${totalItems !== 1 ? "s" : ""} available` : "Browse our course library"}
         </p>

        <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="/courses" method="GET">
          <Input name="search" defaultValue={search} placeholder="Search courses..." className="flex-1" />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="page" value="1" />
          
          <select
            name="max_lesson_duration"
            defaultValue={String(maxLessonDuration)}
            className="w-full sm:w-56 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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

        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Course pagination">
            <Link
              href={buildHref(page - 1)}
              className={`rounded-md border border-neutral-300 px-3 py-2 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : "bg-white hover:bg-neutral-50"}`}
            >
              Previous
            </Link>
            <div className="flex items-center gap-1">
              {pageNumbers.map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-sm text-neutral-500">...</span>
                ) : (
                  <Link
                    key={p}
                    href={buildHref(Number(p))}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-sm ${
                      page === Number(p) ? "bg-primary-700 text-white" : "bg-white border border-neutral-300 hover:bg-neutral-50"
                    }`}
                    aria-current={page === Number(p) ? "page" : undefined}
                  >
                    {p}
                  </Link>
                ),
              )}
            </div>
            <Link
              href={buildHref(page + 1)}
              className={`rounded-md border border-neutral-300 px-3 py-2 text-sm ${page >= totalPages ? "pointer-events-none opacity-50" : "bg-white hover:bg-neutral-50"}`}
            >
              Next
            </Link>
          </nav>
        )}
      </div>
    </section>
  );
}