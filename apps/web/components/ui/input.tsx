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
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-300 dark:text-slate-200">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-slate-400" aria-hidden="true">
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
               "h-10 w-full rounded-lg border bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500",
               "transition-all duration-200 ease-out",
               "focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500",
               "focus:shadow-lg focus:shadow-accent-500/10",
               "disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-800",
               "hover:border-slate-600 hover:shadow-slate-800/20",
               "elevation-1 hover:elevation-2 focus:elevation-3",
               leftIcon ? "pl-10" : "",
               rightIcon ? "pr-10" : "",
               error
                 ? "border-error focus:ring-error focus:border-error focus:shadow-error/20"
                 : "border-slate-700",
               className
             )}
             {...props}
           />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500 dark:text-slate-400" aria-hidden="true">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-sm text-rose-400 flex items-center gap-1" role="alert">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-sm text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
