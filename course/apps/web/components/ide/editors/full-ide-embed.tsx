"use client";

import { useMemo, useState } from "react";
import type { IDEFile } from "@/types/ide";
import type { EditorTheme } from "../types";

/**
 * Full cloud IDE embedded as an iframe. The iframe is styled to match our
 * native chrome so viewers perceive it as part of the course workspace.
 *
 * Entry file names shown to the embed are mapped to the generic names
 * expected by the external workspace:
 *   - Python:      main.py
 *   - JavaScript:  index.js
 *   - web demo:    index.html
 */
export function FullIdeEmbed({
  files,
  language,
  entryFileId,
  theme = "vs-dark",
  onLoad,
  onError,
}: {
  files: IDEFile[];
  language: string;
  entryFileId?: string;
  theme?: EditorTheme;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  const entry = useMemo(() => {
    if (entryFileId) {
      const found = files.find((f) => f.id === entryFileId);
      if (found) return found;
    }
    const lang = language.toLowerCase();
    const preferredNames =
      lang === "python" || lang === "py"
        ? ["main.py", "test.py", "main"]
        : lang === "javascript" || lang === "js"
          ? ["index.js", "main.js", "app.js"]
          : ["index.html", "main.html", "index"];
    for (const name of preferredNames) {
      const found = files.find((f) => f.name === name);
      if (found) return found;
    }
    return files.find((f) => !f.isDirectory);
  }, [files, language, entryFileId]);

  const args = useMemo(() => {
    if (!entry) return undefined;
    return { entryFileId: entry.id };
  }, [entry]);

  // Escape the entry content for URL embedding
  const encodedContent = useMemo(() => {
    if (!entry) return "";
    return encodeURIComponent(entry.content);
  }, [entry]);

  const sanitizedTitle = "Course Workspace";

  const src = useMemo(() => {
    const lang = language.toLowerCase();
    if (lang === "python" || lang === "py") {
      // OneCompiler hidden iframe embed (no toolbar, no top bar look)
      const params = `hideNew=true&hideTitle=true&hideBanner=true&hideOutput=false&theme=${theme === "light" ? "light" : "dark"}&hideLanguageSelection=true`;
      const code = encodeURIComponent(entry?.content || "");
      return `https://onecompiler.com/embed/python?${params}#code=${code}`;
    }
    // CodeSandbox define API — launches a brand-new sandbox from our code.
    const definition = {
      template: lang === "html" || lang === "css" || lang === "jsx" || lang === "tsx" ? "parcel" : "node",
      files: files
        .filter((f) => !f.isDirectory)
        .map((f) => ({
          path: f.name,
          content: f.content,
        })),
    };
    return `https://codesandbox.io/api/v1/sandboxes/define?parameters=${encodeURIComponent(
      JSON.stringify(definition)
    )}`;
  }, [files, language, entry, theme]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <iframe
        key={src}
        title={sanitizedTitle}
        src={src}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        allow="clipboard-write; clipboard-read; fullscreen"
        className="h-full w-full border-0 bg-white dark:bg-[#1e1e1e]"
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        onError={() => onError?.()}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <p className="text-sm text-neutral-500">Preparing workspace…</p>
        </div>
      )}
    </div>
  );
}