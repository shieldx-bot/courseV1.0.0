"use client";

import { createContext, useContext, useState, useCallback, type ReactNode, useEffect, useRef } from "react";
import { X, CheckCircle, AlertCircle, Info, Loader2 } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type?: "info" | "success" | "error" | "warning" | "loading";
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toast: (message: string, options?: Partial<Toast>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const icons = {
  info: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,
  loading: Loader2,
};

const colors = {
  info: "bg-neutral-0 dark:bg-slate-800 border-neutral-200 dark:border-slate-700 text-neutral-800 dark:text-slate-100 shadow-lg shadow-neutral-400/10",
  success: "bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-100",
  error: "bg-rose-50 dark:bg-rose-900/50 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-100",
  warning: "bg-amber-50 dark:bg-amber-900/50 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-100",
  loading: "bg-neutral-0 dark:bg-slate-800 border-neutral-200 dark:border-slate-700 text-neutral-800 dark:text-slate-100 shadow-lg shadow-neutral-400/10",
};

const iconColors = {
  info: "text-slate-400 dark:text-slate-400",
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
  loading: "text-slate-400 animate-spin",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current.clear();
  }, []);

  const toast = useCallback((message: string, options: Partial<Toast> = {}) => {
    const id = crypto.randomUUID();
    const newToast: Toast = {
      id,
      message,
      type: options.type || "info",
      title: options.title,
      duration: options.duration ?? (options.type === "loading" ? 0 : 4000),
      action: options.action,
    };

    setToasts((prev) => [...prev, newToast]);

    const duration = newToast.duration ?? 4000;
    if (duration > 0) {
      const timeout = setTimeout(() => {
        dismiss(id);
      }, duration);
      timeoutRefs.current.set(id, timeout);
    }

    return id;
  }, [dismiss]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss, dismissAll }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = icons[toast.type || "info"];
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

    return (
      <div
        className={`
          relative flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-sm
          animate-toast-enter ${isExiting ? "animate-toast-exit" : ""}
          ${colors[toast.type || "info"]}
          hover:shadow-2xl transition-all duration-200 ease-out
        `}
        role="alert"
        aria-live="assertive"
      >
      <div className={`flex-shrink-0 ${iconColors[toast.type || "info"]}`}>
        <Icon className="h-5 w-5 mt-0.5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="font-semibold text-sm">{toast.title}</p>
        )}
        <p className="text-sm opacity-90 mt-0.5">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-3 text-xs font-medium underline hover:no-underline transition-colors"
            style={{ color: "inherit" }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity p-1 -ml-1 -mt-1"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      {/* Progress bar for timed toasts */}
      {toast.duration && toast.duration > 0 && toast.type !== "loading" && (
        <div className="absolute bottom-0 left-0 h-1 bg-current/30 rounded-bl-xl rounded-br-xl animate-progress-bar" style={{ animationDuration: `${toast.duration}ms` }} />
      )}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// Convenience methods
export const toast = {
  info: (message: string, options?: Partial<Toast>) => ({ type: "info" as const, message, ...options }),
  success: (message: string, options?: Partial<Toast>) => ({ type: "success" as const, message, ...options }),
  error: (message: string, options?: Partial<Toast>) => ({ type: "error" as const, message, ...options }),
  warning: (message: string, options?: Partial<Toast>) => ({ type: "warning" as const, message, ...options }),
  loading: (message: string, options?: Partial<Toast>) => ({ type: "loading" as const, message, duration: 0, ...options }),
};
