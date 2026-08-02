import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function BlogLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
