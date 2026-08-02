import { cookies } from "next/headers";
import { AdaptiveQuiz } from "@/components/adaptive/AdaptiveQuiz";

export default async function AdaptiveQuizPage({
  params,
  searchParams,
}: {
  params: { course: string; lesson: string };
  searchParams: { mode?: string };
}) {
  const token = cookies().get("access_token")?.value || "";
  const mode = searchParams?.mode;

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{mode === "mastery-check" ? "Mastery Check" : "Adaptive Quiz"}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Course: {params.course} • Lesson: {params.lesson}
      </p>
      <div className="mt-6">
        <AdaptiveQuiz courseId={params.course} lessonId={params.lesson} userId={token} mode={mode} />
      </div>
    </section>
  );
}
