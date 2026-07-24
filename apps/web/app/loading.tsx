export default function RootLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-10 w-3/4 max-w-xl animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="mx-auto h-6 w-1/2 max-w-md animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
              <div className="h-4 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}