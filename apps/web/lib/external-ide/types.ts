"use client";

export type EditorEngineKind = "inline-editor" | "full-ide";

export type EditorEngineId =
  | "codemirror-cdn"
  | "monaco-cdn"
  | "codesandbox-embed"
  | "onecompiler-embed";

export interface EditorEngineInfo {
  id: EditorEngineId;
  label: string;
  kind: EditorEngineKind;
  description: string;
  cdnHosts: string[];
  checkUrl: string;
}

export interface EngineHealth {
  id: EditorEngineId;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
  engine?: string;
}

export const STORAGE_ENGINE_KEY = "ascendly-ide-engine";
export const STORAGE_EXEC_ENGINE_KEY = "ascendly-ide-exec-engine";