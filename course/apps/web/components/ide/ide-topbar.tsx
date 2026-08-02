"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play,
  Save,
  RotateCcw,
  Send,
  Moon,
  Sun,
  User,
  ChevronDown,
  Menu,
  X,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProjectLanguage } from "@/types/ide";

interface IdeTopbarProps {
  courseName?: string;
  lessonTitle?: string;
  projectLanguage?: ProjectLanguage;
  onProjectChange?: (language: ProjectLanguage) => void;
  onRun?: () => void;
  onSave?: () => void;
  onReset?: () => void;
  onSubmit?: () => void;
  isRunning?: boolean;
}

export function IdeTopbar({
  courseName = "React Fundamentals",
  lessonTitle = "Building Your First Component",
  projectLanguage = "python",
  onProjectChange,
  onRun,
  onSave,
  onReset,
  onSubmit,
  isRunning = false,
}: IdeTopbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const initials = "JD";

  return (
    <Card className="rounded-none border-t-0 border-x-0 dark:bg-neutral-900 dark:border-neutral-700">
      <div className="flex items-center justify-between h-12 px-3 lg:px-4">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
            ) : (
              <Menu className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
            )}
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 font-bold text-lg tracking-tight text-accent-500 hover:text-accent-600 transition-colors shrink-0"
          >
            <span className="text-xl">▲</span>
            <span className="hidden sm:inline">Ascendly</span>
          </Link>

          <div className="hidden md:flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-300">
            <ChevronDown className="h-3.5 w-3.5" />
            <span className="truncate max-w-[120px]">{courseName}</span>
            <ChevronDown className="h-3.5 w-3.5" />
            <span className="truncate max-w-[150px] text-neutral-900 dark:text-neutral-100 font-medium">
              {lessonTitle}
            </span>
          </div>

          {onProjectChange && (
            <div className="hidden lg:flex items-center">
              <div className="flex rounded-md border border-neutral-300 dark:border-neutral-700 overflow-hidden">
                <button
                  onClick={() => onProjectChange("python")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors",
                    projectLanguage === "python"
                      ? "bg-accent-500 text-white"
                      : "bg-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}
                >
                  Python
                </button>
                <button
                  onClick={() => onProjectChange("javascript")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors border-l border-neutral-300 dark:border-neutral-700",
                    projectLanguage === "javascript"
                      ? "bg-accent-500 text-white"
                      : "bg-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}
                >
                  JavaScript
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "text-success hover:text-success hover:bg-success/10 dark:text-success",
              isRunning && "opacity-50 cursor-not-allowed"
            )}
            onClick={onRun}
            disabled={isRunning}
          >
            <Play className={cn("h-4 w-4 mr-1.5", isRunning && "animate-pulse")} />
            {isRunning ? "Running..." : "Run"}
          </Button>
          <Button variant="secondary" size="sm" onClick={onSave}>
            <Save className="h-4 w-4 mr-1.5" />
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="bg-accent-500 hover:bg-accent-600 border-0 text-white"
            onClick={onSubmit}
          >
            <Send className="h-4 w-4 mr-1.5" />
            Submit
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            <Moon className="h-4 w-4 text-neutral-600 dark:text-neutral-300 dark:hidden" />
            <Sun className="h-4 w-4 text-neutral-600 dark:text-neutral-300 hidden dark:block" />
          </button>

          <div className="relative">
            <button
              className="flex items-center gap-1.5 p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            >
              <div className="h-7 w-7 rounded-full bg-accent-500 text-white flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-300 transition-transform",
                  userDropdownOpen && "rotate-180"
                )}
              />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    John Doe
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    john@example.com
                  </p>
                </div>
                <button className="w-full text-left px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  Profile
                </button>
                <button className="w-full text-left px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-200 dark:border-neutral-700 px-3 py-3 space-y-3">
          <div className="md:hidden">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Course
            </p>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {courseName}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mt-2 mb-1">
              Lesson
            </p>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {lessonTitle}
            </p>
          </div>

          {onProjectChange && (
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-neutral-500" />
              <div className="flex rounded-md border border-neutral-300 dark:border-neutral-700 overflow-hidden">
                <button
                  onClick={() => onProjectChange("python")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors",
                    projectLanguage === "python"
                      ? "bg-accent-500 text-white"
                      : "bg-transparent text-neutral-600 dark:text-neutral-300"
                  )}
                >
                  Python
                </button>
                <button
                  onClick={() => onProjectChange("javascript")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors border-l border-neutral-300 dark:border-neutral-700",
                    projectLanguage === "javascript"
                      ? "bg-accent-500 text-white"
                      : "bg-transparent text-neutral-600 dark:text-neutral-300"
                  )}
                >
                  JavaScript
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn("text-success", isRunning && "opacity-50")}
              onClick={onRun}
              disabled={isRunning}
            >
              <Play className="h-4 w-4 mr-1.5" />
              {isRunning ? "Running..." : "Run"}
            </Button>
            <Button variant="secondary" size="sm" onClick={onSave}>
              <Save className="h-4 w-4 mr-1.5" />
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-accent-500 hover:bg-accent-600 border-0 text-white"
              onClick={onSubmit}
            >
              <Send className="h-4 w-4 mr-1.5" />
              Submit
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
