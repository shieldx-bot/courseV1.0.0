import { Skeleton, SkeletonCard, SkeletonAvatar } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <SkeletonAvatar size="xl" />
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </section>
  );
}