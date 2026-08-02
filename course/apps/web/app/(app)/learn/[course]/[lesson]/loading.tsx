import { Skeleton } from "@/components/ui/skeleton";

export default function LessonLoading() {
  return (
    <section className="py-6">
      <div className="mx-auto max-w-page px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-48" />
            <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
            <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-3 h-[100px] w-full" />
              <Skeleton className="mt-3 h-9 w-28" />
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
            <Skeleton className="h-5 w-3/4" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
