import { Review } from "@/types";
import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

async function getReviews() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/reviews`, {
      next: { revalidate: 60 },
    });
    if (res.ok) return (await res.json()).data as Review[] || [];
  } catch {}
  return [];
}

export async function TestimonialsSection() {
  const reviews = await getReviews();

  if (reviews.length === 0) {
    return <EmptyState title="No reviews yet" message="Member stories will appear here soon." />;
  }

  return (
    <section className="bg-neutral-100 py-16 dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6">
        <h2 className="text-2xl font-semibold text-primary-900 dark:text-white">Real transformations from real members</h2>
        <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
          See how professionals like you are building skills that change how they work.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {reviews.slice(0, 3).map((r) => (
            <Card key={r.id} className="p-6 dark:bg-neutral-800 dark:border-neutral-700">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < (r.rating || 0) ? "fill-accent-500 text-accent-500" : "text-neutral-300"}`}
                  />
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-accent-100 bg-accent-100/50 p-3 text-sm dark:border-accent-500/20 dark:bg-accent-500/5">
                <p className="text-neutral-900 dark:text-neutral-100 leading-relaxed">
                  &ldquo;{r.outcome}&rdquo;
                </p>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700 dark:bg-primary-500/20 dark:text-primary-100">
                  {r.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{r.name}</p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">{r.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
