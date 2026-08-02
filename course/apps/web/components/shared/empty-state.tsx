import { SearchX } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export function EmptyState({ title = "Nothing here yet", message = "Check back later or try a different search." }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <SearchX className="mx-auto h-10 w-10 text-neutral-400" aria-hidden="true" />
      <h3 className="mt-4 font-medium text-neutral-900 dark:text-neutral-100">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
    </div>
  );
}
