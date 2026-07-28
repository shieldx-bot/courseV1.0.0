import { cookies } from "next/headers";
import { CoursePlayerClient } from "./course-player-client";
import type { Course, Progress, Subscription } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default async function CoursePlayerPage({ params }: { params: { course: string; lesson: string } }) {
  let course: Course | null = null;
  let progress: Progress[] = [];
  let subscription: Subscription | null = null;

  const cookieStore = cookies();
  const token = cookieStore.get("access_token")?.value;

  try {
    const res = await fetch(`${API_BASE}/api/v1/courses/${params.course}`, {
      next: { revalidate: 30 },
    });
    if (res.ok) course = (await res.json()).data || null;
  } catch {}

  if (token) {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [progressRes, subRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/progress`, { headers }),
        fetch(`${API_BASE}/api/v1/subscriptions/me`, { headers }),
      ]);
      if (progressRes.ok) {
        const progressJson = await progressRes.json();
        progress = Array.isArray(progressJson?.data) ? progressJson.data : [];
      }
      if (subRes.ok) {
        const subJson = await subRes.json();
        subscription = subJson?.data || null;
      }
    } catch {}
  }

  if (!course) {
    return (
      <section className="py-20 text-center">
        <p className="text-2xl font-semibold">Course not found</p>
      </section>
    );
  }

  return (
    <CoursePlayerClient
      course={course}
      progress={progress}
      subscription={subscription}
      params={params}
    />
  );
}