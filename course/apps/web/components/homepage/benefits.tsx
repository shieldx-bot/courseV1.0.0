import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

const benefits = [
  "2,000+ courses across 7 career-relevant categories",
  "Structured learning paths, not scattered video dumps",
  "Progress tracking that keeps you moving",
  "New courses added every month",
  "Watch on any device, anytime",
];

export function BenefitsSection() {
  return (
    <section className="py-16 dark:bg-neutral-950">
      <div className="mx-auto max-w-page px-6">
        <h2 className="text-2xl font-semibold text-primary-900 dark:text-white">Stop learning from twelve different tabs.</h2>
        <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-300">
          Free tutorials get you started. They rarely get you finished. Ascendly replaces the
          scattered-YouTube-tab approach with structured courses, real instructors, and a library that
          grows with you — for one price, not one course at a time.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {benefits.map((b) => (
            <Card key={b} className="flex items-start gap-3 p-4 dark:bg-neutral-800 dark:border-neutral-700">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <p className="text-neutral-900 dark:text-neutral-100">{b}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
