export default function AuthLoading() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-sm px-6">
        <div className="h-8 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-6 space-y-4">
          <div className="h-10 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-10 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-10 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        </div>
      </div>
    </section>
  );
}
