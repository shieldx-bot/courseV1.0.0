import { cookies } from "next/headers";
import { headers } from "next/headers";
import { AdaptiveQuiz } from "@/components/adaptive/AdaptiveQuiz";

export default async function AdaptiveQuizPage({ params }: { params: { course: string; lesson: string } }) {
  const cookieStore = cookies();
  const token = cookieStore.get("access_token")?.value || "";

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Adaptive Quiz</h1>
      <p className="mt-1 text-sm text-neutral-600">Course: {params.course} • Lesson: {params.lesson}</p>
      <div className="mt-6">
        <AdaptiveQuiz courseId={params.course} lessonId={params.lesson} userId={token} />
      </div>
    </section>
  );
}
