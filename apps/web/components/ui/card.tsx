import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  highlighted?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, highlighted, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border",
          highlighted
            ? "border-2 border-accent-500 shadow-card"
            : "border-neutral-300",
          "bg-white dark:bg-neutral-800 dark:border-neutral-700",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";
