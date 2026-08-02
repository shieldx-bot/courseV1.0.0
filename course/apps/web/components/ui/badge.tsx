"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BadgeProps {
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "outline" | "accent";
  size?: "sm" | "md" | "lg";
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Badge({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className,
  children,
}: BadgeProps) {
  const baseStyles = "inline-flex items-center gap-1.5 font-medium rounded-full transition-all duration-200 ease-out";

  const variantStyles = {
    primary: "bg-primary-100 text-primary-700 border border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700",
    secondary: "bg-neutral-100 text-neutral-700 border border-neutral-200 dark:bg-neutral-800/50 dark:text-neutral-300 dark:border-neutral-700",
    success: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
    warning: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    danger: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
    info: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
    outline: "bg-transparent text-neutral-600 border border-neutral-300 dark:text-neutral-400 dark:border-neutral-700",
    accent: "bg-accent-100 text-accent-700 border border-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:border-accent-700",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <span className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}>
      {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      <span className="truncate">{children}</span>
      {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </span>
  );
}

interface StatusDotProps {
  status: "active" | "inactive" | "pending" | "success" | "warning" | "error";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatusDot({ status, size = "md", className }: StatusDotProps) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  const statusColors = {
    active: "bg-emerald-500",
    inactive: "bg-neutral-400",
    pending: "bg-amber-400",
    success: "bg-emerald-500",
    warning: "bg-amber-400",
    error: "bg-rose-500",
  };

  const pulseClasses = {
    active: "animate-pulse",
    pending: "",
    success: "",
    warning: "",
    error: "animate-pulse",
    inactive: "",
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div className={cn(sizeClasses[size], statusColors[status], "rounded-full", pulseClasses[status])} />
    </div>
  );
}

interface PillProps {
  children: ReactNode;
  className?: string;
}

export function Pill({ children, className }: PillProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-700 text-sm font-medium transition-all duration-200 hover:bg-neutral-200 dark:bg-neutral-800/50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700/50", className)}>
      {children}
    </span>
  );
}