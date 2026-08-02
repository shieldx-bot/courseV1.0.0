import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page max-w-2xl px-6">
        <Skeleton className="h-9 w-48" />
        <div className="mt-6 rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
          <div className="flex items-center justify-between border-b border-neutral-300 pb-4 dark:border-neutral-600">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-4 w-28" />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
          <div className="mt-6">
            <Skeleton className="h-4 w-20" />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="mt-6 h-10 w-full" />
          <Skeleton className="mx-auto mt-3 h-3 w-64" />
        </div>
      </div>
    </section>
  );
}
