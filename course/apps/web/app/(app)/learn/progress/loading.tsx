import { Skeleton } from "@/components/ui/skeleton";

export default function ProgressLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <Skeleton className="h-9 w-48" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-3 h-2 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
              <Skeleton className="mt-3 h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
