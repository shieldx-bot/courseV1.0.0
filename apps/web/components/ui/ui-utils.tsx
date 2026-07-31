"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * UI Utility Components for Enhanced User Experience
 */

interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className }: DividerProps) {
  return (
    <div className={cn("relative flex items-center py-4", className)}>
      <div className="flex-grow border-t border-slate-800" />
      {label && (
        <span className="mx-4 text-sm text-slate-500 bg-slate-900 px-2 py-1 rounded">
          {label}
        </span>
      )}
      <div className="flex-grow border-t border-slate-800" />
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div>
        <h2 className="text-xl font-bold text-slate-100">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({
  icon,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-slate-700 hover:shadow-lg hover:shadow-slate-900/20 transition-all duration-200 ease-out",
        className
      )}
    >
      <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200",
              index < currentStep
                ? "bg-rose-500 text-white"
                : index === currentStep
                ? "bg-slate-700 text-slate-100 border-2 border-rose-500"
                : "bg-slate-800 text-slate-500"
            )}
          >
            {index + 1}
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "flex-grow h-1 transition-all duration-200",
                index < currentStep - 1
                  ? "bg-rose-500"
                  : "bg-slate-700"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface ProgressStepProps {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  className?: string;
}

export function ProgressStep({
  step,
  totalSteps,
  title,
  description,
  className,
}: ProgressStepProps) {
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
              step <= totalSteps
                ? "bg-rose-500 text-white"
                : "bg-slate-800 text-slate-500"
            )}
          >
            {step}
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">{title}</h3>
            {description && (
              <p className="text-sm text-slate-400">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-rose-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface EmptyResultsProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyResults({
  title,
  description,
  icon,
  action,
  className,
}: EmptyResultsProps) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      {icon && (
        <div className="mx-auto mb-4 text-slate-400 text-4xl">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
        {description}
      </p>
      {action && <div className="inline-block">{action}</div>}
    </div>
  );
}

interface ErrorBoundaryProps {
  error: Error;
  resetErrorBoundary: () => void;
  className?: string;
}

export function ErrorBoundary({
  error,
  resetErrorBoundary,
  className,
}: ErrorBoundaryProps) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      <div className="mx-auto mb-4 text-rose-400 text-4xl">⚠️</div>
      <h3 className="text-xl font-bold text-slate-100 mb-2">
        Something went wrong
      </h3>
      <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Loading...", className }: LoadingStateProps) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      <div className="mx-auto mb-4">
        <svg
          className="w-8 h-8 text-rose-500 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
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
      <p className="text-sm text-slate-400 animate-pulse">{message}</p>
    </div>
  );
}