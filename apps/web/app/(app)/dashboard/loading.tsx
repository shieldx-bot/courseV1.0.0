import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-28 w-full rounded-lg" />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}