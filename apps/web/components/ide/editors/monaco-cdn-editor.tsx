"use client";

import { useEffect, useRef, useState } from "react";
import { loadCdnResource } from "@/lib/external-ide/cdn-loader";
import type { EditorTheme } from "../types";

const MONACO_VERSION = "0.52.2";

function vsUrl(asset: string): { primary: string; fallbacks: string[] } {
  return {
    primary: `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs/${asset}`,
    fallbacks: [
      `https://unpkg.com/monaco-editor@${MONACO_VERSION}/min/vs/${asset}`,
      `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${MONACO_VERSION}/min/vs/${asset}`,
    ],
  };
}

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  jsx: "javascript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  h: "c",
  md: "markdown",
  yml: "yaml",
  sh: "shell",
  plaintext: "plaintext",
};

export function MonacoCdnEditor({
  fileId,
  content,
  language,
  onChange,
  readOnly = false,
  theme = "vs-dark",
  onError,
}: {
  fileId: string;
  content: string;
  language: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  theme?: EditorTheme;
  onError?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const contentRef = useRef(content);
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  contentRef.current = content;
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    let disposed = false;
    const isDark = theme !== "light";

    async function init() {
      const loaderOk = await loadCdnResource({
        url: vsUrl("loader.js").primary,
        fallbacks: vsUrl("loader.js").fallbacks,
        checkGlobal: "MonacoEnvironment",
      });

      const win = window as any;
      const requireFn = win.require;

      if (!loaderOk || !requireFn || cancelled || !containerRef.current) {
        if (!cancelled) {
          setStatus("error");
          onError?.();
        }
        return;
      }

      // Point Monaco at the CDN base so it can fetch workers/features.
      requireFn.config({
        paths: { vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs` },
      });

      // Bootstrap the amd worker loader
      await loadCdnResource({
        url: vsUrl("base/worker/workerMain.js").primary,
        fallbacks: vsUrl("base/worker/workerMain.js").fallbacks,
      });

      const monaco = await new Promise<any>((resolve, reject) => {
        requireFn(["vs/editor/editor.main"], (mod: any) => resolve(mod), reject);
      });

      if (cancelled || !containerRef.current) return;

      const aliased = LANG_ALIASES[language.toLowerCase()] || language.toLowerCase();

      const editor = monaco.editor.create(containerRef.current, {
        value: contentRef.current,
        language: aliased,
        theme: isDark ? "vs-dark" : "light",
        readOnly,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        fontLigatures: true,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: "on",
        wrappingStrategy: "advanced",
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        smoothScrolling: true,
        padding: { top: 8, bottom: 8 },
        minimap: { enabled: false },
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        overviewRulerLanes: 0,
        scrollbar: {
          vertical: "auto",
          horizontal: "auto",
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      });

      editorRef.current = editor;

      if (!readOnly) {
        editor.onDidChangeModelContent(() => {
          if (!disposed) onChangeRef.current(editor.getValue());
        });
      }

      if (!cancelled) setStatus("ready");
    }

    init();

    return () => {
      cancelled = true;
      disposed = true;
      if (editorRef.current) {
        try {
          editorRef.current.dispose();
        } catch {
          // ignore
        }
        editorRef.current = null;
      }
    };
  }, [fileId, language, theme]);

  // Sync external content changes (e.g. reset)
  useEffect(() => {
    if (status !== "ready" || !editorRef.current) return;
    const ed = editorRef.current;
    const current = ed.getValue();
    if (current !== content) {
      ed.setValue(content);
    }
  }, [content, status]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-accent-500" />
          <p className="mt-3 text-xs text-neutral-500">Initializing editor…</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 text-center px-6">
          <p className="text-sm text-red-400">Editor failed to load from CDN.</p>
          <p className="mt-1 text-xs text-neutral-500">
            Attempting automatic fallback to another editor…
          </p>
        </div>
      )}
    </div>
  );
}