import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { BookOpen, User } from "lucide-react";
import { Course, Category } from "@/types";
import { makeMetadata } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "Course Library — 2,000+ Courses Included | Ascendly",
  description:
    "Browse 2,000+ expert-led courses in business, tech, design, data, AI, and career skills. Included with every Ascendly membership.",
  path: "/courses",
});

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  const category = typeof searchParams.category === "string" ? searchParams.category : "";

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  let courses: Course[] = [];
  let categories: Category[] = [];

  try {
    const [coursesRes, catsRes] = await Promise.all([
      fetch(`${apiBase}/api/v1/courses?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`, {
        next: { revalidate: 60 },
      }),
      fetch(`${apiBase}/api/v1/categories`, { next: { revalidate: 60 } }),
    ]);
    if (coursesRes.ok) courses = await coursesRes.json();
    if (catsRes.ok) categories = await catsRes.json();
  } catch {
    courses = [];
    categories = [];
  }

  const query = new URLSearchParams();
  if (search) query.set("search", search);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Course library</h1>
        <p className="mt-2 text-neutral-600">{courses.length} courses included with every membership.</p>

        <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="/courses" method="GET">
          <Input name="search" defaultValue={search} placeholder="Search courses..." className="flex-1" />
          <input type="hidden" name="category" value={category} />
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
              href={`/courses?category=${c.slug}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
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
                  <p className="mt-4 text-xs text-neutral-600">{course.lesson_count} lessons</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
