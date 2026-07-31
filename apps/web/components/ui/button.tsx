"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef, useRef, useEffect, useState } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "success" | "checkout";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, leftIcon, rightIcon, children, disabled, onClick, ...props }, ref) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [isPressed, setIsPressed] = useState(false);
    
    // Sync refs
    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') ref(buttonRef.current);
        else if ('current' in ref) ref.current = buttonRef.current;
      }
    }, [ref]);

    const handleMouseDown = () => setIsPressed(true);
    const handleMouseUp = () => setIsPressed(false);
    const handleMouseLeave = () => setIsPressed(false);
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') setIsPressed(true);
    };
    const handleKeyUp = () => setIsPressed(false);

    const baseStyles = "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none hover:shadow-lg hover:shadow-slate-900/20 active:translate-y-px elevation-1 hover:elevation-2 active:elevation-1";

    const variantStyles = {
      primary: "bg-primary-700 text-white hover:bg-primary-500 active:bg-primary-900 shadow-lg shadow-primary-700/25 hover:shadow-primary-700/40 active:scale-[0.98]",
      secondary: "bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 active:scale-[0.98]",
      ghost: "bg-transparent text-slate-300 hover:bg-slate-800/50 active:scale-[0.98]",
      outline: "bg-transparent text-slate-300 border-2 border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 active:scale-[0.98]",
      danger: "bg-error text-white hover:bg-red-600 shadow-lg shadow-error/25 hover:shadow-error/40 active:scale-[0.98]",
      success: "bg-success text-white hover:bg-emerald-600 shadow-lg shadow-success/25 hover:shadow-success/40 active:scale-[0.98]",
      checkout: "bg-accent-500 text-white hover:bg-accent-600 shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40 active:scale-[0.98]",
    };

    const sizeStyles = {
      sm: "h-9 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
    };

    const pressScale = isPressed && !loading && !disabled ? "scale-[0.97]" : "";

    return (
      <button
        ref={buttonRef}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], pressScale, className)}
        disabled={disabled || loading}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        {...props}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 30" strokeDashoffset="0" strokeLinecap="round" />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>}
            <span className="truncate">{children}</span>
            {rightIcon && <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>}
          </>
        )}
        {/* Ripple effect */}
        {!loading && !disabled && (
          <span className="absolute inset-0 bg-white/20 animate-ripple pointer-events-none" aria-hidden="true" />
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
