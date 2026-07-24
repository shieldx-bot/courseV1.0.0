export default function AdminLoading() {
  return (
    <section className="py-12">
      <div>
        <div className="h-8 w-56 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-700">
              <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
