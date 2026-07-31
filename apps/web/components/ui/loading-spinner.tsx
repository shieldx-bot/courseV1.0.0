"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: string;
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  color = "text-rose-500",
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  };

  return (
    <div className={cn("inline-flex items-center justify-center", className)}>
      <svg
        className={cn(sizeClasses[size], color, "animate-spin")}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle
          className="opacity-75"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="30 30"
          strokeDashoffset="0"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message = "Loading...", className }: LoadingOverlayProps) {
  return (
    <div className={cn("fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center", className)}>
      <div className="flex flex-col items-center gap-4 text-center">
        <LoadingSpinner size="xl" color="text-rose-500" />
        <p className="text-slate-300 font-medium animate-pulse">{message}</p>
      </div>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = "bg-rose-500",
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("w-full h-2 bg-slate-800 rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-300 ease-out", color)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}