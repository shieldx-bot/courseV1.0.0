"use client";

import { useState, useCallback } from "react";
import type { EditorEngineId } from "@/lib/external-ide/types";
import { EDITOR_ENGINE_ORDER } from "@/lib/external-ide/providers";
import type { IDEFile } from "@/types/ide";
import type { EditorTheme } from "../types";
import { CodeMirrorCdnEditor } from "./codemirror-cdn-editor";
import { MonacoCdnEditor } from "./monaco-cdn-editor";
import { FullIdeEmbed } from "./full-ide-embed";

export function EditorOrchestrator({
  engine,
  files,
  fileId,
  content,
  language,
  onChange,
  readOnly = false,
  theme = "vs-dark",
  onEngineFallback,
}: {
  engine: EditorEngineId;
  files: IDEFile[];
  fileId?: string;
  content: string;
  language: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  theme?: EditorTheme;
  onEngineFallback?: (failed: EditorEngineId) => void;
}) {
  const [failedEngines, setFailedEngines] = useState<Set<EditorEngineId>>(new Set());

  const markFailed = useCallback(
    (failed: EditorEngineId) => {
      setFailedEngines((prev) => new Set(prev).add(failed));
      onEngineFallback?.(failed);
    },
    [onEngineFallback]
  );

  const activeEngine =
    EDITOR_ENGINE_ORDER.find((id) => !failedEngines.has(id)) || "codemirror-cdn";

  const filesForEmbed =
    files && files.length > 0
      ? files
      : [
          {
            id: fileId || "main",
            name: language.toLowerCase() === "python" ? "main.py" : "index.js",
            path: language.toLowerCase() === "python" ? "main.py" : "index.js",
            content,
            language,
          } as IDEFile,
        ];

  switch (activeEngine) {
    case "monaco-cdn":
      return (
        <MonacoCdnEditor
          key={`monaco-${fileId}`}
          fileId={fileId || "main"}
          content={content}
          language={language}
          onChange={onChange}
          readOnly={readOnly}
          theme={theme}
          onError={() => markFailed("monaco-cdn")}
        />
      );
    case "codesandbox-embed":
    case "onecompiler-embed":
      return (
        <FullIdeEmbed
          key={`full-${activeEngine}-${fileId}`}
          files={filesForEmbed}
          language={language}
          entryFileId={fileId}
          theme={theme}
          onError={() => markFailed(activeEngine)}
        />
      );
    case "codemirror-cdn":
    default:
      return (
        <CodeMirrorCdnEditor
          key={`cm-${fileId}`}
          fileId={fileId || "main"}
          content={content}
          language={language}
          onChange={onChange}
          readOnly={readOnly}
          theme={theme}
          onError={() => markFailed("codemirror-cdn")}
        />
      );
  }
}