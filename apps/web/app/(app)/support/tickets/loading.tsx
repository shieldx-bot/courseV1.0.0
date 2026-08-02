import { Skeleton, SkeletonListItem } from "@/components/ui/skeleton";

export default function SupportTicketsLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
        <div className="mt-8 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonListItem key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
