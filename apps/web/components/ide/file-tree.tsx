"use client";

import { useState, useCallback } from "react";
import {
  File,
  FileCode,
  FolderOpen,
  Folder,
  FileText,
  Image,
  FileJson,
  ChevronRight,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IDEFile } from "@/types/ide";

interface FileTreeProps {
  files: IDEFile[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
  lessons?: {
    id: string;
    title: string;
    order: number;
    completed?: boolean;
    locked?: boolean;
  }[];
  onSelectLesson?: (lessonId: string) => void;
  currentLessonId?: string;
}

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

  if (["js", "jsx", "ts", "tsx", "py", "java", "cpp", "c", "go", "rs", "rb", "php"].includes(extension) || lang === "javascript" || lang === "typescript" || lang === "python" || lang === "java" || lang === "cpp" || lang === "c" || lang === "go" || lang === "rust" || lang === "ruby" || lang === "php") {
    return FileCode;
  }

  return File;
}

function FileTreeNode({
  file,
  depth,
  selectedFileId,
  onSelectFile,
  expandedFolders,
  toggleFolder,
}: {
  file: IDEFile;
  depth: number;
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
}) {
  const isFolder = file.isDirectory ?? !!file.children?.length;
  const isExpanded = expandedFolders.has(file.id);
  const isSelected = selectedFileId === file.id;
  const Icon = isFolder ? (isExpanded ? FolderOpen : Folder) : getFileIcon(file.name, file.language);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isFolder) {
        toggleFolder(file.id);
      } else {
        onSelectFile(file.id);
      }
    },
    [isFolder, file.id, toggleFolder, onSelectFile]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isFolder) {
        onSelectFile(file.id);
      }
    },
    [isFolder, file.id, onSelectFile]
  );

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1 px-3 py-1 cursor-pointer select-none",
          "hover:dark:bg-neutral-800 transition-colors",
          isSelected && "dark:bg-accent-100/20 dark:text-accent-500"
        )}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {isFolder && (
          <span className="w-4 h-4 flex items-center justify-center shrink-0 text-neutral-500 dark:text-neutral-400">
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")}
            />
          </span>
        )}
        {!isFolder && <span className="w-4 h-4 shrink-0" />}
        <Icon className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
        <span className="text-sm font-mono truncate dark:text-neutral-300">{file.name}</span>
      </div>
      {isFolder && isExpanded && file.children && (
        <div>
          {file.children.map((child) => (
            <FileTreeNode
              key={child.id}
              file={child}
              depth={depth + 1}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function FileTree({
  files,
  selectedFileId,
  onSelectFile,
  lessons,
  onSelectLesson,
  currentLessonId,
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full dark:bg-neutral-900 dark:border-neutral-700 border-r">
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {files.map((file) => (
          <FileTreeNode
            key={file.id}
            file={file}
            depth={0}
            selectedFileId={selectedFileId}
            onSelectFile={onSelectFile}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
          />
        ))}
      </div>

      {lessons && lessons.length > 0 && (
        <div className="border-t border-neutral-700">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Lessons
          </div>
          <div className="overflow-y-auto max-h-60">
            {lessons.map((lesson) => {
              const isCurrent = currentLessonId === lesson.id;
              return (
                <button
                  key={lesson.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                    "hover:dark:bg-neutral-800",
                    isCurrent && "dark:bg-accent-100/20 dark:text-accent-500"
                  )}
                  onClick={() => onSelectLesson?.(lesson.id)}
                >
                  {lesson.completed && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500 dark:text-green-400" />
                  )}
                  {!lesson.completed && lesson.locked && (
                    <Lock className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
                  )}
                  {!lesson.completed && !lesson.locked && (
                    <span className="w-4 h-4 flex items-center justify-center shrink-0 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                      {lesson.order}
                    </span>
                  )}
                  <span className="truncate dark:text-neutral-300">{lesson.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
