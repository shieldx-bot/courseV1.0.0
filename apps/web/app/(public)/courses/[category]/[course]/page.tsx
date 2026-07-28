import { Course, Subscription } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cookies } from "next/headers";
import { Lock, Play, BookOpen, User, CheckCircle, Clock, Zap } from "lucide-react";
import Image from "next/image";
import { JsonLd } from "@/components/json-ld";
import { makeMetadata, SITE_URL, API_BASE } from "@/lib/metadata";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function hasMicroLesson(course: Course): boolean {
  return course.syllabus?.some((lesson) => lesson.duration_seconds > 0 && lesson.duration_seconds <= 600) ?? false;
}

export async function generateMetadata({ params }: { params: { course: string } }) {
  const apiBase = API_BASE;
  let course: Course | null = null;
  try {
    const res = await fetch(`${apiBase}/api/v1/courses/${params.course}`, { next: { revalidate: 60 } });
    if (res.ok) course = (await res.json()).data || null;
  } catch {}

  return makeMetadata({
    title: `${course?.title || params.course} — Ascendly Course`,
    description: course?.description || "Learn this skill with Ascendly.",
    path: `/courses/${course?.category_slug || "category"}/${course?.slug || params.course}`,
  });
}

export default async function CourseDetailPage({ params }: { params: { category: string; course: string } }) {
  const apiBase = API_BASE;
  let res;
  try {
    res = await fetch(`${apiBase}/api/v1/courses/${params.course}`, { next: { revalidate: 60 } });
  } catch {
    res = { ok: false } as any;
  }
  if (!res.ok) {
    return (
      <section className="py-20 text-center">
        <h1 className="text-2xl font-semibold">Course not found</h1>
      </section>
    );
  }
  const course: Course = (await res.json()).data;

  let subscription: Subscription | null = null;
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("access_token")?.value;
    if (token) {
      const subRes = await fetch(`${apiBase}/api/v1/subscriptions/me`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 30 },
      });
      if (subRes.ok) subscription = await subRes.json();
    }
  } catch {}

  const isSubscriber = subscription?.status === "active";
  const firstLessonId = course.syllabus[0]?.id;

  const courseSchema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description,
    provider: {
      "@type": "Organization",
      name: "Ascendly",
      sameAs: SITE_URL,
    },
    educationalProgramMode: "online",
    hasCourseInstance: course.syllabus.map((lesson) => ({
      "@type": "CourseInstance",
      courseMode: "online",
      name: lesson.title,
    })),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: `${SITE_URL}/courses` },
      { "@type": "ListItem", position: 3, name: course.category_name, item: `${SITE_URL}/courses/${course.category_slug}` },
      { "@type": "ListItem", position: 4, name: course.title, item: `${SITE_URL}/courses/${course.category_slug}/${course.slug}` },
    ],
  };

  return (
    <>
      <JsonLd data={[courseSchema, breadcrumb]} />
      <section className="py-12">
        <div className="mx-auto max-w-page px-6">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Badge variant="primary">{course.category_name}</Badge>
              <h1 className="mt-3 text-3xl font-semibold text-primary-900">{course.title}</h1>

{course.instructor && (
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
              <User className="h-4 w-4" aria-hidden="true" />
              <span>by <strong>{course.instructor.name}</strong></span>
              {course.instructor.bio && <span className="text-neutral-400">· {course.instructor.bio}</span>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-neutral-600">
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {course.lesson_count} lessons
            </span>
            {course.total_duration_seconds && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(course.total_duration_seconds)}
              </span>
            )}
            {hasMicroLesson(course) && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                <Zap className="h-3 w-3" />
                Has micro-lessons (under 10 min)
              </span>
            )}
          </div>

          <p className="mt-4 text-neutral-600">{course.description}</p>

              <div className="mt-8 aspect-video rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-white overflow-hidden relative">
                {course.image_url ? (
                  <Image src={course.image_url} alt={course.title} loading="lazy" fill className="object-cover" />
                ) : (
                  <div className="text-center">
                    <BookOpen className="mx-auto h-10 w-10 text-primary-400" />
                    <p className="mt-3 font-medium text-primary-700">Preview video coming soon</p>
                  </div>
                )}
              </div>

              {isSubscriber ? (
                <div className="mt-8 flex items-center justify-center gap-4 rounded-lg bg-green-50 p-8 text-center text-green-900">
                  <div>
                    <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
                    <p className="mt-3 font-medium">You have full access to this course.</p>
                    <Link href={`/learn/${course.slug}/${firstLessonId}`}>
                      <Button className="mt-5 bg-green-600 hover:bg-green-700 text-white">
                        <Play className="mr-2 h-4 w-4" /> Continue learning
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-8 flex items-center justify-center gap-4 rounded-lg bg-neutral-900 p-8 text-center text-white">
                  <div>
                    <Lock className="mx-auto h-8 w-8 text-neutral-300" />
                    <p className="mt-3 font-medium">This course is part of your Ascendly membership.</p>
                    <p className="mt-1 text-sm text-neutral-300">
                      Verify your phone number to preview 10% of this course free for 3 days — no card required.
                    </p>
                    <Link href={`/verify-phone?next=/learn/${course.slug}/${firstLessonId}`}>
                      <Button className="mt-5 bg-accent-500 hover:bg-accent-600 text-white">
                        <Play className="mr-2 h-4 w-4" /> Start free preview
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              <div className="mt-10">
                <h2 className="text-xl font-semibold text-primary-900">What you&apos;ll learn</h2>
                <ul className="mt-4 grid gap-2 md:grid-cols-2">
                  {course.outcome.map((o, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-900">
                      <span className="text-accent-600">•</span> {o}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <Card className="p-5">
                <h2 className="font-semibold text-primary-900">Syllabus</h2>
                <ul className="mt-4 space-y-3">
                  {course.syllabus.map((lesson, idx) => (
                    <li key={lesson.id} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">
                        {idx + 1}. {lesson.title}
                      </span>
                      <div className="flex items-center gap-2">
                        {lesson.duration_seconds > 0 && (
                          <span className="flex items-center gap-1 text-xs text-neutral-500">
                            <Clock className="h-3 w-3" />
                            {formatDuration(lesson.duration_seconds)}
                          </span>
                        )}
                        {lesson.duration_seconds > 0 && lesson.duration_seconds <= 600 && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <Zap className="h-2.5 w-2.5 inline mr-0.5" />
                            Micro
                          </span>
                        )}
                        {isSubscriber ? (
                          <Play className="h-4 w-4 text-green-500" />
                        ) : (
                          <Lock className="h-4 w-4 text-neutral-300" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {isSubscriber ? (
                  <Link href={`/learn/${course.slug}/${firstLessonId}`} className="mt-6 block">
                    <Button className="w-full">Go to course</Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/pricing" className="mt-6 block">
                      <Button className="w-full">Unlock full course</Button>
                    </Link>
                    <p className="mt-3 text-center text-xs text-neutral-600">
                      Already a member? <Link href="/login" className="text-primary-700 hover:underline">Log in</Link>
                    </p>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
