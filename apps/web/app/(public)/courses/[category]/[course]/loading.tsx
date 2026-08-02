import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CourseDetailLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <div className="mt-6 flex gap-3">
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>
          <div className="w-full lg:w-80">
            <Skeleton className="aspect-video w-full rounded-xl" />
          </div>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-5 w-40" />
            <SkeletonText lines={4} />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
