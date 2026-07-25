import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { Course } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

export async function RecommendationsSection() {
  let courses: Course[] = [];

  try {
    const res = await apiFetch("/courses/recommendations?limit=6", { next: { revalidate: 60 } });
    courses = res || [];
  } catch {
    courses = [];
  }

  if (courses.length === 0) return null;

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <h2 className="text-2xl font-semibold text-primary-900">For you</h2>
        <p className="mt-1 text-neutral-600">Based on your learning activity</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden transition-colors hover:border-accent-500 h-full flex flex-col">
              <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-200" />
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-medium text-neutral-900">{course.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{course.description}</p>
                <div className="mt-auto pt-4 flex items-center gap-3 text-xs text-neutral-500">
                  <span>{course.lesson_count} lessons</span>
                  <Badge variant="accent" className="text-[10px]">{course.category_name}</Badge>
                </div>
                <a
                  href={`/courses/${course.category_slug}/${course.slug}`}
                  className="mt-4 text-center"
                >
                  <Button variant="secondary" className="w-full">View course</Button>
                </a>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RecommendationsSectionSkeleton() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-5 animate-pulse">
              <Skeleton className="aspect-video w-full mb-4" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2 mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="mt-4 h-10 w-full" />
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}