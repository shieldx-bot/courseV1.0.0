"use client";

import { useCallback } from "react";
import { X, FileCode, File, FileText, FileJson, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorTab } from "@/types/ide";

function getFileIcon(name: string, language: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  const lang = language.toLowerCase();

  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension)) {
    return Image;
  }

  if (["json", "jsonc"].includes(extension) || lang === "json") {
    return FileJson;
  }

  if (["md", "txt"].includes(extension) || lang === "markdown" || lang === "plaintext") {
    return FileText;
  }

  if (
    ["js", "jsx", "ts", "tsx", "py", "java", "cpp", "c", "go", "rs", "rb", "php"].includes(
      extension
    ) ||
    ["javascript", "typescript", "python", "java", "cpp", "c", "go", "rust", "ruby", "php"].includes(
      lang
    )
  ) {
    return FileCode;
  }

  return File;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

export function EditorTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}: EditorTabsProps) {
  const handleTabClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 0) {
        onSelectTab(tabId);
      }
    },
    [onSelectTab]
  );

  const handleCloseClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      onCloseTab(tabId);
    },
    [onCloseTab]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        e.preventDefault();
        onCloseTab(tabId);
      }
    },
    [onCloseTab]
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-end overflow-x-auto dark:bg-neutral-800 dark:border-b border-neutral-700"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const Icon = getFileIcon(tab.name, tab.language);

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            tabIndex={0}
            onClick={(e) => handleTabClick(e, tab.id)}
            onMouseUp={(e) => handleMouseUp(e, tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectTab(tab.id);
              }
            }}
            className={cn(
              "group relative flex items-center gap-2 h-9 min-w-0 max-w-[200px] px-3 text-sm cursor-pointer select-none",
              "border-b-2 transition-colors duration-100",
              isActive
                ? "border-accent-500 dark:bg-neutral-900 dark:text-neutral-100"
                : "border-transparent dark:text-neutral-400 hover:dark:bg-neutral-700"
            )}
          >
            {tab.isDirty ? (
              <span className="shrink-0 rounded-full bg-accent-500 w-1.5 h-1.5" />
            ) : (
              <Icon className="h-4 w-4 shrink-0" />
            )}

            <span className="truncate whitespace-nowrap">{tab.name}</span>

            <button
              type="button"
              aria-label={`Close ${tab.name}`}
              onClick={(e) => handleCloseClick(e, tab.id)}
              onMouseUp={(e) => e.stopPropagation()}
              className={cn(
                "ml-auto shrink-0 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100",
                "hover:dark:bg-neutral-600 text-neutral-500 dark:text-neutral-400 dark:hover:text-neutral-100 transition-opacity",
                tab.isDirty && "opacity-100"
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
