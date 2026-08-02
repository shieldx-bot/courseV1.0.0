import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label 
            htmlFor={inputId} 
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 transition-colors"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500" aria-hidden="true">
              {leftIcon}
            </div>
          )}
           <input
             ref={ref}
             id={inputId}
             aria-invalid={error ? "true" : "false"}
             aria-describedby={describedBy}
             aria-errormessage={errorId}
             className={cn(
               // Base styles with premium feel
               "h-11 w-full rounded-lg border bg-neutral-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400",
               "transition-all duration-200 ease-out",
               // Border and hover states
               "border-neutral-300 hover:border-neutral-400",
               // Focus state with accent ring
               "focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 focus:shadow-lg focus:shadow-accent-500/10",
               // Disabled state
               "disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed",
               // Icon spacing
               leftIcon ? "pl-10" : "",
               rightIcon ? "pr-10" : "",
               // Error state
               error
                 ? "border-error focus:ring-error focus:border-error focus:shadow-error/20 hover:border-error"
                 : "dark:border-neutral-700 dark:hover:border-neutral-600",
               className
             )}
             {...props}
           />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500" aria-hidden="true">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-sm text-error flex items-center gap-1.5" role="alert">
            <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-sm text-neutral-500 dark:text-neutral-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
