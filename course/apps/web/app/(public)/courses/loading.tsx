import { Skeleton } from "@/components/ui/skeleton";

export default function CoursesLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-96" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="mt-3 h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}