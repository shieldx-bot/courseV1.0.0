import { redirect } from "next/navigation";

export default function AdaptiveQuizLegacyPage({ params }: { params: { course: string } }) {
  redirect(`/learn/${params.course}/mastery`);
}
