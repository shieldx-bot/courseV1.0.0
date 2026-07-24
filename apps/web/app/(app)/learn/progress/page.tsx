"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

interface CourseProgress {
  course_id: string;
  course_title: string;
  course_slug: string;
  completed_lessons: number;
  total_lessons: number;
  progress_pct: number;
}

export default function ProgressPage() {
  const [courses, setCourses] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/progress/summary")
      .then(setCourses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">My progress</h1>
        {loading ? (
          <p className="mt-6 text-neutral-600">Loading...</p>
        ) : courses.length === 0 ? (
          <Card className="mt-6 p-6">
            <p className="text-neutral-600">No progress yet. Start a course from your dashboard.</p>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.course_id} className="p-5">
                <h3 className="font-medium text-neutral-900">{c.course_title}</h3>
                <div className="mt-3 h-2 w-full rounded bg-neutral-200">
                  <div
                    className="h-2 rounded bg-accent-500"
                    style={{ width: `${c.progress_pct}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  {c.completed_lessons} of {c.total_lessons} lessons completed ({c.progress_pct}%)
                </p>
                <Link href="/learn" className="mt-3 inline-block text-sm text-primary-700 hover:underline">
                  Continue
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
