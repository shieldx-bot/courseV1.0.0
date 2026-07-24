"use client";

export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="py-20 text-center">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Something went wrong</h1>
        <p className="mt-2 text-neutral-600">We couldn&apos;t load this page. Please try again.</p>
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-primary-700 px-4 py-2 text-sm text-white hover:bg-primary-800"
        >
          Try again
        </button>
      </div>
    </section>
  );
}
