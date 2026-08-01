"use client";

import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  overlayClassName?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
  overlayClassName,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-full",
  };

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", overlayClassName)}>
      {/* Overlay */}
      <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm animate-fade-in dark:bg-neutral-950/80" />

       {/* Modal Content */}
       <div
         ref={modalRef}
         className={cn(
           "relative w-full bg-neutral-0 border border-neutral-200 rounded-xl shadow-2xl p-6 animate-slide-in",
           "transition-all duration-300 ease-out",
           "elevation-4 hover:elevation-5",
           sizeClasses[size],
           className
         )}
       >
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className="text-xl font-bold text-neutral-900 truncate dark:text-neutral-100">{title}</h3>
          )}
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors dark:text-neutral-500 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {description && (
          <p className="text-sm text-neutral-600 mb-6 dark:text-neutral-400">{description}</p>
        )}

        <div className="text-neutral-900 dark:text-neutral-100">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "danger";
  className?: string;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  className,
}: ConfirmationModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      className={className}
    >
      <p className="text-neutral-600 mb-6 dark:text-neutral-300">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          {cancelText}
        </Button>
        <Button
          variant={confirmVariant === "danger" ? "danger" : "primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  type?: "info" | "success" | "warning" | "error";
  className?: string;
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  className,
}: AlertModalProps) {
  const typeStyles = {
    info: {
      icon: "ℹ️",
      color: "text-slate-500 dark:text-slate-400",
      bg: "bg-slate-100 dark:bg-slate-800/50",
    },
    success: {
      icon: "✅",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
    },
    warning: {
      icon: "⚠️",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/30",
    },
    error: {
      icon: "❌",
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-900/30",
    },
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      className={cn("text-center", typeStyles[type].bg, className)}
    >
      <div className="flex flex-col items-center gap-4">
        <div className={cn("text-4xl mb-2", typeStyles[type].color)}>
          {typeStyles[type].icon}
        </div>
        <div className={cn("text-neutral-600 dark:text-neutral-300", type === "error" ? "text-rose-600 dark:text-rose-300" : "")}>
          {message}
        </div>
        <Button
          onClick={onClose}
          variant={type === "error" ? "danger" : "secondary"}
          className="mt-6"
        >
          Close
        </Button>
      </div>
    </Modal>
  );
}