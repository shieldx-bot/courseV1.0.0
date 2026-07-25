"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { Course } from "@/types";

interface RecommendationsProps {
  title?: string;
  limit?: number;
  variant?: "grid" | "list";
}

export function Recommendations({ title = "Recommended for you", limit = 6, variant = "grid" }: RecommendationsProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiClient.courses.recommendations(limit)
      .then((data) => {
        if (mounted) {
          setCourses(data || []);
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [limit]);

  if (loading) {
    return (
      <section className="py-8">
        <h2 className="text-xl font-semibold text-primary-900 mb-4">{title}</h2>
        <div className={variant === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="aspect-video bg-neutral-200 rounded mb-3" />
              <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-neutral-200 rounded w-1/2" />
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (error || courses.length === 0) {
    return null;
  }

  return (
    <section className="py-8">
      <h2 className="text-xl font-semibold text-primary-900 mb-4">{title}</h2>
      <div className={variant === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
        {courses.map((course) => (
          <Card key={course.id} className="overflow-hidden transition-colors hover:border-accent-500">
            {variant === "grid" && (
              <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-200" />
            )}
            <div className="p-5">
              {variant === "list" && (
                <div className="flex items-start gap-4">
                  <div className="aspect-video w-32 shrink-0 bg-gradient-to-br from-primary-100 to-primary-200 rounded" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-neutral-900 truncate">{course.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{course.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                      <span>{course.lesson_count} lessons</span>
                      <Badge variant="accent" className="text-[10px]">{course.category_name}</Badge>
                    </div>
                    <Button variant="secondary" className="mt-3" size="sm">View course</Button>
                  </div>
                </div>
              )}
              {variant === "grid" && (
                <>
                  <h3 className="font-medium text-neutral-900">{course.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{course.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                    <span>{course.lesson_count} lessons</span>
                    <Badge variant="accent" className="text-[10px]">{course.category_name}</Badge>
                  </div>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}