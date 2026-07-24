import { Skeleton } from "@/components/ui/skeleton";

export default function LearnLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-6 h-32 w-full rounded-lg" />
        <Skeleton className="mt-10 h-7 w-56" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/3" />
              <Skeleton className="mt-3 h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
