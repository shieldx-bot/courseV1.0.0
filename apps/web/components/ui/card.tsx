"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className,
  hoverEffect = false,
  clickable = false,
  onClick,
}: CardProps) {
    const baseClasses = "bg-white border border-neutral-200 rounded-xl shadow-sm transition-all duration-200 ease-out elevation-1 hover:elevation-2 dark:bg-slate-900 dark:border-slate-800";

  const hoverClasses = hoverEffect
    ? "hover:shadow-xl hover:shadow-slate-900/20 hover:translate-y-[-2px] hover:border-slate-700"
    : "";

  const clickableClasses = clickable
    ? "cursor-pointer active:translate-y-px active:shadow-lg"
    : "";

  return (
    <div
      className={cn(baseClasses, hoverClasses, clickableClasses, className)}
      onClick={clickable ? onClick : undefined}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn("px-6 pt-6 pb-4 border-b border-neutral-200 dark:border-slate-800", className)}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn("text-lg font-bold text-neutral-900 truncate dark:text-slate-100", className)}>
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p className={cn("text-sm text-neutral-600 mt-1 dark:text-slate-400", className)}>
      {children}
    </p>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn("p-6 space-y-4", className)}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn("px-6 py-4 border-t border-neutral-200 dark:border-slate-800", className)}>
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  className,
}: StatCardProps) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-rose-400",
    neutral: "text-slate-400",
  };

  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  return (
    <Card className={cn("p-6 hoverEffect", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-600 font-medium dark:text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-neutral-900 mt-1 font-mono dark:text-slate-100">
            {value}
          </p>
        </div>
        {icon && (
          <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center dark:bg-slate-800">
            {icon}
          </div>
        )}
      </div>
      {trend && trendValue && (
        <div className="flex items-center gap-2 mt-4">
          <span className={cn("text-sm font-medium", trendColors[trend])}>
            {trendIcons[trend]} {trendValue}
          </span>
        </div>
      )}
    </Card>
  );
}