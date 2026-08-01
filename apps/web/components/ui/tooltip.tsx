"use client";

import { cn } from "@/lib/utils";
import { ReactNode, useState } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = "top",
  delay = 300,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

          const arrowClasses = {
            top: { bottom: '0', left: '50%', transform: 'translateX(-50%) translateY(50%) rotate(45deg)' },
            bottom: { top: '0', left: '50%', transform: 'translateX(-50%) translateY(-50%) rotate(45deg)' },
            left: { right: '0', top: '50%', transform: 'translateY(-50%) translateX(50%) rotate(45deg)' },
            right: { left: '0', top: '50%', transform: 'translateY(-50%) translateX(-50%) rotate(45deg)' },
          };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && (
        <div
          className={cn(
            "absolute z-50 px-3 py-2 text-sm text-neutral-900 bg-neutral-100 border border-neutral-200 rounded-lg shadow-xl",
            "dark:text-slate-100 dark:bg-slate-900 dark:border-slate-800",
            "transition-opacity duration-200 ease-out opacity-100",
            "whitespace-nowrap max-w-xs",
            positionClasses[position],
            className
          )}
          role="tooltip"
        >
          <div className="absolute w-2 h-2 bg-neutral-100 border border-neutral-200 dark:bg-slate-900 dark:border-slate-800" style={arrowClasses[position]} />
          {content}
        </div>
      )}
    </div>
  );
}

interface InfoTooltipProps {
  content: ReactNode;
  className?: string;
}

export function InfoTooltip({ content, className }: InfoTooltipProps) {
  return (
    <Tooltip
      content={content}
      position="top"
      className={cn("text-xs", className)}
    >
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-700 text-neutral-200 text-xs font-bold cursor-help hover:bg-neutral-600 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
        ?
      </span>
    </Tooltip>
  );
}