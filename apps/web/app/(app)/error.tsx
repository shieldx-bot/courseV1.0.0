"use client";

import { useRouter } from "next/navigation";
import { logErrorToBackend } from "@/lib/error-logger";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Log the error to our backend error logging system
  // Using setTimeout to avoid blocking the UI render
  setTimeout(() => {
    logErrorToBackend(error, {
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, 0);

  return (
    <section className="py-20 text-center">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Something went wrong</h1>
        <p className="mt-2 text-neutral-600">We couldn't load this page. Please try again.</p>
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
