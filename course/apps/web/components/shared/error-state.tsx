import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
}

export function ErrorState({ title = "Something went wrong", message = "We couldn’t load this page. Please try again later." }: ErrorStateProps) {
  return (
    <div className="py-16 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-error" aria-hidden="true" />
      <h3 className="mt-4 font-medium text-neutral-900 dark:text-neutral-100">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
    </div>
  );
}
