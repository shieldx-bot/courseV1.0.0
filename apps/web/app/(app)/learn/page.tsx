"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { Course } from "@/types";
import { OnboardingModal } from "@/components/shared/onboarding-modal";

interface ContinueData {
  course_id: string;
  course_title: string;
  course_slug: string;
  lesson_id: string;
  lesson_title: string;
  lesson_index: number;
  lesson_count: number;
  last_position_seconds: number;
}

export default function LearnDashboard() {
  const [continueData, setContinueData] = useState<ContinueData | null>(null);
  const [recommended, setRecommended] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/progress/continue")
      .then(setContinueData)
      .catch(() => {});

    apiFetch("/courses")
      .then((courses: Course[]) => setRecommended(courses.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Learning dashboard</h1>

        {loading ? (
          <p className="mt-6 text-neutral-600">Loading...</p>
        ) : continueData ? (
          <Card className="mt-6 p-6">
            <p className="text-sm text-neutral-600">Pick up where you left off:</p>
            <h2 className="mt-1 text-xl font-medium text-neutral-900">{continueData.course_title}</h2>
            <p className="text-sm text-neutral-600">
              {continueData.lesson_title} — Lesson {continueData.lesson_index + 1} of {continueData.lesson_count}
            </p>
            <Link href={`/learn/${continueData.course_slug}/${continueData.lesson_id}`}>
              <Button className="mt-4">Continue learning</Button>
            </Link>
          </Card>
        ) : (
          <Card className="mt-6 p-6">
            <p className="text-neutral-600">No courses in progress yet. Start one below.</p>
          </Card>
        )}

        <h2 className="mt-10 text-xl font-semibold text-primary-900">Recommended for you</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {recommended.map((c) => (
            <Card key={c.id} className="p-5">
              <p className="font-medium text-neutral-900">{c.title}</p>
              <p className="text-xs text-neutral-600">{c.category_name}</p>
              <Link href={`/learn/${c.slug}/${c.syllabus[0]?.id || ""}`}>
                <Button variant="secondary" className="mt-3 w-full">Start</Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
      <OnboardingModal />
    </section>
  );
}
