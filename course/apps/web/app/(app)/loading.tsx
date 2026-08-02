export default function AppLoading() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <div className="h-8 w-56 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
              <div className="h-5 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-3 h-2 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
