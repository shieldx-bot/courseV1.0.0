"use client";

import { useEffect, useRef, useState } from "react";
import { loadCdnResource } from "@/lib/external-ide/cdn-loader";
import type { EditorTheme } from "../types";

// Language → mode mapping for CodeMirror 5
const CM_MODES: Record<string, { mode: string | null; mime: string }> = {
  javascript: { mode: "javascript", mime: "text/javascript" },
  js: { mode: "javascript", mime: "text/javascript" },
  jsx: { mode: "jsx", mime: "text/jsx" },
  typescript: { mode: "javascript", mime: "text/typescript" },
  ts: { mode: "javascript", mime: "text/typescript" },
  tsx: { mode: "jsx", mime: "text/jsx" },
  python: { mode: "python", mime: "text/x-python" },
  py: { mode: "python", mime: "text/x-python" },
  java: { mode: "clike", mime: "text/x-java" },
  c: { mode: "clike", mime: "text/x-csrc" },
  "c++": { mode: "clike", mime: "text/x-c++src" },
  cpp: { mode: "clike", mime: "text/x-c++src" },
  go: { mode: "go", mime: "text/x-go" },
  rust: { mode: "rust", mime: "text/x-rustsrc" },
  ruby: { mode: "ruby", mime: "text/x-ruby" },
  php: { mode: "php", mime: "text/x-php" },
  json: { mode: "javascript", mime: "application/json" },
  css: { mode: "css", mime: "text/css" },
  html: { mode: "htmlmixed", mime: "text/html" },
  xml: { mode: "xml", mime: "application/xml" },
  sql: { mode: "sql", mime: "text/x-sql" },
  yaml: { mode: "yaml", mime: "text/x-yaml" },
  yml: { mode: "yaml", mime: "text/x-yaml" },
  bash: { mode: "shell", mime: "text/x-sh" },
  sh: { mode: "shell", mime: "text/x-sh" },
  dockerfile: { mode: "dockerfile", mime: "text/x-dockerfile" },
  markdown: { mode: "markdown", mime: "text/x-markdown" },
  md: { mode: "markdown", mime: "text/x-markdown" },
  plaintext: { mode: null, mime: "text/plain" },
  txt: { mode: null, mime: "text/plain" },
};

function getModeInfo(language: string): { mode: string | null; mime: string } {
  const alias = language.toLowerCase();
  const key = CM_MODES[alias]
    ? alias
    : Object.keys(CM_MODES).find(
        (k) => CM_MODES[k].mode === alias || CM_MODES[k].mime === alias
      );
  return CM_MODES[key || "plaintext"] || CM_MODES.plaintext;
}

// Map CM mode name → scripts to load from the CDN.
const MODE_SCRIPTS: Record<string, string[]> = {
  javascript: ["mode/javascript/javascript.min.js"],
  jsx: ["mode/jsx/jsx.min.js"],
  clike: ["mode/clike/clike.min.js"],
  python: ["mode/python/python.min.js"],
  go: ["mode/go/go.min.js"],
  rust: ["mode/rust/rust.min.js"],
  ruby: ["mode/ruby/ruby.min.js"],
  php: ["mode/php/php.min.js"],
  css: ["mode/css/css.min.js"],
  htmlmixed: ["mode/xml/xml.min.js", "mode/javascript/javascript.min.js", "mode/css/css.min.js", "mode/htmlmixed/htmlmixed.min.js"],
  xml: ["mode/xml/xml.min.js"],
  sql: ["mode/sql/sql.min.js"],
  yaml: ["mode/yaml/yaml.min.js"],
  shell: ["mode/shell/shell.min.js"],
  dockerfile: ["mode/dockerfile/dockerfile.min.js"],
  markdown: ["mode/markdown/markdown.min.js"],
};

const CM_VERSION = "5.65.16";

function buildScriptUrl(lang: string, addon: string): { primary: string; fallbacks: string[] } {
  return {
    primary: `https://cdnjs.cloudflare.com/ajax/libs/codemirror/${CM_VERSION}/${addon}`,
    fallbacks: [
      `https://cdn.jsdelivr.net/npm/codemirror@${CM_VERSION}/${addon}`,
      `https://unpkg.com/codemirror@${CM_VERSION}/${addon}`,
    ],
  };
}

export function CodeMirrorCdnEditor({
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
      // Core CodeMirror
      const coreLoaded = await loadCdnResource({
        url: buildScriptUrl(language, "lib/codemirror.min.js").primary,
        fallbacks: buildScriptUrl(language, "lib/codemirror.min.js").fallbacks,
        checkGlobal: "CodeMirror",
      });
      if (!coreLoaded || cancelled) {
        if (!cancelled) {
          setStatus("error");
          onError?.();
        }
        return;
      }

      // Base style
      await loadCdnResource({
        url: buildScriptUrl(language, "lib/codemirror.min.css").primary,
        fallbacks: buildScriptUrl(language, "lib/codemirror.min.css").fallbacks,
        style: true,
      });

      // Theme CSS (only pull the external theme we need)
      const themeName = isDark ? "monokai" : "default";
      if (isDark) {
        await loadCdnResource({
          url: buildScriptUrl(language, "theme/monokai.min.css").primary,
          fallbacks: buildScriptUrl(language, "theme/monokai.min.css").fallbacks,
          style: true,
        });
      }

      const modeInfo = getModeInfo(language);
      if (modeInfo.mode) {
        const scripts = MODE_SCRIPTS[modeInfo.mode] || [];
        for (const s of scripts) {
          const info = buildScriptUrl(language, s);
          const ok = await loadCdnResource({
            url: info.primary,
            fallbacks: info.fallbacks,
            checkGlobal: "CodeMirror",
          });
          if (!ok) break;
        }
      }

      // Addons — active line highlight + match brackets
      const addons = [
        "addon/edit/matchbrackets.min.js",
        "addon/search/searchcursor.min.js",
        "addon/selection/active-line.min.js",
        "addon/selection/selection-pointer.min.js",
      ];
      for (const a of addons) {
        const info = buildScriptUrl(language, a);
        await loadCdnResource({
          url: info.primary,
          fallbacks: info.fallbacks,
          checkGlobal: "CodeMirror",
        });
      }

      if (cancelled || !containerRef.current) return;

      const CM = (window as any).CodeMirror;
      if (!CM) {
        setStatus("error");
        onError?.();
        return;
      }

      const editor = CM(containerRef.current, {
        value: contentRef.current,
        mode: modeInfo.mime,
        theme: isDark ? "monokai" : "default",
        lineNumbers: true,
        lineWrapping: true,
        readOnly: readOnly ? "nocursor" : false,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        matchBrackets: true,
        styleActiveLine: isDark,
        scrollbarStyle: "native",
        viewportMargin: Infinity,
        extraKeys: { Tab: "indentMore" },
        lineHeight: 24,
      });

      editorRef.current = editor;
      editor.setSize("100%", "100%");

      // Seamless native dark skin
      if (isDark && containerRef.current) {
        containerRef.current.querySelectorAll(".CodeMirror").forEach((el: Element) => {
          (el as HTMLElement).style.backgroundColor = "#171717";
        });
      }

      if (!readOnly) {
        editor.on("change", () => {
          if (!disposed) {
            onChangeRef.current(editor.getValue());
          }
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
          editorRef.current.toTextArea();
        } catch {
          // ignore
        }
        editorRef.current = null;
      }
    };
  }, [fileId, language, theme]);

  // Sync external content changes (e.g. reset) into the editor
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
      <div
        ref={containerRef}
        className={[
          "h-full w-full overflow-hidden",
          theme !== "light" ? "cm-host-dark" : "cm-host-light",
        ].join(" ")}
      />
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