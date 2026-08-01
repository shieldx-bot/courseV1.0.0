import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md",
        "bg-neutral-200 dark:bg-neutral-800",
        "transition-all duration-200 ease-out",
        className
      )}
    />
  );
}

// Specialized skeleton components for common UI patterns
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full rounded" />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 p-6 rounded-2xl border border-neutral-200 bg-neutral-0 dark:border-neutral-800 dark:bg-neutral-900", className)}>
      <Skeleton className="h-8 w-3/4 rounded" />
      <SkeletonText lines={3} />
      <Skeleton className="h-10 w-1/4 rounded-xl" />
    </div>
  );
}

export function SkeletonAvatar({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };
  return <Skeleton className={cn(sizes[size], "rounded-full", className)} />;
}

export function SkeletonButton({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-8 w-20",
    md: "h-10 w-28",
    lg: "h-12 w-36",
  };
  return <Skeleton className={cn(sizes[size], "rounded-lg", className)} />;
}

export function SkeletonTableRow({ columns = 4, className }: { columns?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4", `grid-cols-${columns}`, className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-10 rounded" />
      ))}
    </div>
  );
}

export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 p-4 rounded-xl border border-neutral-200 bg-neutral-0 dark:border-neutral-800 dark:bg-neutral-900", className)}>
      <SkeletonAvatar size="md" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-3 w-1/2 rounded text-slate-500" />
      </div>
      <Skeleton className="h-6 w-16 rounded-lg" />
    </div>
  );
}