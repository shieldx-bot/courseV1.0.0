"use client";

import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

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
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm animate-fade-in" />

       {/* Modal Content */}
       <div
         ref={modalRef}
         className={cn(
           "relative w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 animate-slide-in",
           "transition-all duration-300 ease-out",
           "elevation-4 hover:elevation-5",
           sizeClasses[size],
           className
         )}
       >
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className="text-xl font-bold text-slate-100 truncate">{title}</h3>
          )}
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {description && (
          <p className="text-sm text-slate-400 mb-6">{description}</p>
        )}

        <div className="modal-content">{children}</div>
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
      <p className="text-slate-300 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cn(
            "px-4 py-2 text-white rounded-lg transition-colors",
            confirmVariant === "primary"
              ? "bg-rose-600 hover:bg-rose-500"
              : "bg-red-600 hover:bg-red-500"
          )}
        >
          {confirmText}
        </button>
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
      color: "text-slate-400",
      bg: "bg-slate-800",
    },
    success: {
      icon: "✅",
      color: "text-emerald-400",
      bg: "bg-emerald-900/50",
    },
    warning: {
      icon: "⚠️",
      color: "text-amber-400",
      bg: "bg-amber-900/50",
    },
    error: {
      icon: "❌",
      color: "text-rose-400",
      bg: "bg-rose-900/50",
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
        <div className={cn("text-slate-300", type === "error" ? "text-rose-300" : "")}>
          {message}
        </div>
        <button
          onClick={onClose}
          className={cn(
            "mt-6 px-6 py-2 rounded-lg font-medium transition-colors",
            type === "error"
              ? "bg-rose-600 hover:bg-rose-500 text-white"
              : "bg-slate-700 hover:bg-slate-600 text-slate-100"
          )}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}