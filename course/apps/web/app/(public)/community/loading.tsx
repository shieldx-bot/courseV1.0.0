import { Skeleton, SkeletonCard, SkeletonAvatar } from "@/components/ui/skeleton";

export default function CommunityLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <SkeletonAvatar size="lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <SkeletonCard />
          </div>
        </div>
      </div>
    </section>
  );
}