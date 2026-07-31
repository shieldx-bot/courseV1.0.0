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
    primary: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    secondary: "bg-slate-700/20 text-slate-300 border border-slate-700/30",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20",
    info: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    outline: "bg-transparent text-slate-300 border border-slate-700",
    accent: "bg-accent-500/10 text-accent-400 border border-accent-500/20",
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
    active: "bg-emerald-400",
    inactive: "bg-slate-500",
    pending: "bg-amber-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    error: "bg-rose-400",
  };

  const pulseClasses = {
    active: "animate-pulse",
    pending: "animate-thinking",
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
    <span className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/30 text-slate-300 text-sm font-medium transition-all duration-200 hover:bg-slate-700/30", className)}>
      {children}
    </span>
  );
}