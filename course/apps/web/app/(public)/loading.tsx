export default function PublicLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <div className="h-8 w-64 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
              <div className="h-4 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-2 h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-4 h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
