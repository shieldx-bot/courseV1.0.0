"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "success";
  };
  className?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  className 
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      {icon && (
        <div className="mx-auto mb-4 text-slate-400 dark:text-slate-600 transition-all duration-200 hover:scale-110 hover:text-slate-300">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-slate-100 dark:text-slate-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-8">
          <Button 
            variant={action.variant || "primary"} 
            onClick={action.onClick}
            size="lg"
            className="transition-all duration-200 hover:shadow-xl hover:shadow-rose-500/20"
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
