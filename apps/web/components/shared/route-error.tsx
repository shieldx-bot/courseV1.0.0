"use client";

import { useEffect } from "react";
import { logErrorToBackend } from "@/lib/error-logger";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  message?: string;
  logError?: boolean;
}

export function RouteError({ error, reset, message = "We couldn't load this page. Please try again.", logError = false }: RouteErrorProps) {
  useEffect(() => {
    if (logError) {
      logErrorToBackend(error, {
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
    }
  }, [error, logError]);

  return (
    <section className="py-20 text-center" role="alert">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Something went wrong</h1>
        <p className="mt-2 text-neutral-600">{message}</p>
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
