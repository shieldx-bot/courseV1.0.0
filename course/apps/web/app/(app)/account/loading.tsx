import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <Skeleton className="h-9 w-36" />
        <div className="mt-6 rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
          <Skeleton className="h-5 w-20" />
          <div className="mt-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-1 h-4 w-72" />
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <Skeleton className="mt-6 h-9 w-24" />
      </div>
    </section>
  );
}
