import { Check, Smartphone, Users, Download, Wifi, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { makeMetadata } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "Ascendly Membership — Unlimited Access to 2,000+ Courses",
  description:
    "One membership unlocks 2,000+ expert-led courses, structured learning paths, and progress tracking across devices.",
  path: "/membership",
});

const features = [
  { icon: Check, text: "Unlimited access to 2,000+ courses" },
  { icon: Check, text: "New courses added monthly" },
  { icon: Check, text: "Structured learning paths" },
  { icon: Check, text: "Progress tracking across devices" },
  { icon: Smartphone, text: "Offline viewing (mobile app coming soon)", highlight: true },
  { icon: Users, text: "Member-only community (coming soon)", highlight: true },
];

const comingSoon = [
  {
    icon: Smartphone,
    title: "Mobile app",
    description: "Learn on the go with our upcoming mobile app. Download courses for offline viewing and pick up where you left off across devices.",
    status: "In development",
  },
  {
    icon: Users,
    title: "Member community",
    description: "Connect with fellow learners, share insights, ask questions, and network with professionals in your field. Moderated by Ascendly mentors.",
    status: "Coming Q3 2026",
  },
  {
    icon: Download,
    title: "Course downloads",
    description: "Download video lessons and course materials to your device for offline study. Perfect for commutes and travel.",
    status: "In development",
  },
  {
    icon: Wifi,
    title: "Offline mode",
    description: "Full offline access to your learning progress, notes, and course content without an internet connection.",
    status: "In development",
  },
];

export default function MembershipPage() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Membership</h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Ascendly is built for people with a job, not people with free time. One membership replaces
          scattered tutorials with a structured, premium library.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.text} className={`flex items-start gap-3 p-5 ${f.highlight ? "border-accent-300 bg-accent-50/50" : ""}`}>
              <f.icon className={`h-5 w-5 shrink-0 ${f.highlight ? "text-accent-500" : "text-success"}`} />
              <div>
                <p className="text-neutral-900">{f.text}</p>
                {f.highlight && <Badge variant="accent" className="mt-1 text-[10px]">Coming soon</Badge>}
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-semibold text-primary-900">What&apos;s coming next</h2>
          <p className="mt-2 text-neutral-600">We&apos;re building a richer learning experience. Here&apos;s what&apos;s on the roadmap.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {comingSoon.map((item) => (
              <Card key={item.title} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-accent-100 p-3">
                    <item.icon className="h-6 w-6 text-accent-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-neutral-900">{item.title}</h3>
                      <Badge variant="accent" className="text-[10px]">{item.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-neutral-600">{item.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Link href="/pricing" className="mt-10 inline-block">
          <Button size="lg">See pricing</Button>
        </Link>
      </div>
    </section>
  );
}
