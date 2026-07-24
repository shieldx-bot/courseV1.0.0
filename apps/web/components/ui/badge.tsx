import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "accent" | "success" | "warning" | "error";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium",
          {
            "bg-primary-100 text-primary-700": variant === "primary",
            "bg-accent-100 text-accent-600": variant === "accent",
            "bg-[#EAF3DE] text-success": variant === "success",
            "bg-[#FAEEDA] text-warning": variant === "warning",
            "bg-[#FCEBEB] text-error": variant === "error",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
