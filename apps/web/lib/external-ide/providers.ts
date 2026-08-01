"use client";

import type { EditorEngineId, EditorEngineInfo, EngineHealth } from "./types";

export const EDITOR_ENGINES: Record<EditorEngineId, EditorEngineInfo> = {
  "codemirror-cdn": {
    id: "codemirror-cdn",
    label: "Editor Engine A",
    kind: "inline-editor",
    description: "In-browser editor from external CDN (fast, seamless)",
    cdnHosts: ["https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://unpkg.com"],
    checkUrl: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js",
  },
  "monaco-cdn": {
    id: "monaco-cdn",
    label: "Editor Engine B",
    kind: "inline-editor",
    description: "VS Code editor from external CDN (seamless)",
    cdnHosts: ["https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
    checkUrl: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js",
  },
  "codesandbox-embed": {
    id: "codesandbox-embed",
    label: "Project Sandbox",
    kind: "full-ide",
    description: "Full cloud workspace (disguised embed)",
    cdnHosts: ["https://codesandbox.io", "https://csb.app"],
    checkUrl: "https://codesandbox.io",
  },
  "onecompiler-embed": {
    id: "onecompiler-embed",
    label: "Project Studio",
    kind: "full-ide",
    description: "Full cloud workspace (disguised embed)",
    cdnHosts: ["https://onecompiler.com", "https://compilers.dev"],
    checkUrl: "https://onecompiler.com",
  },
};

export const EDITOR_ENGINE_ORDER: EditorEngineId[] = [
  "codemirror-cdn",
  "monaco-cdn",
  "codesandbox-embed",
  "onecompiler-embed",
];

export const EXECUTION_ENGINES = [
  { id: "piston", label: "Execution Cloud A", url: "https://emkc.org/api/v2/piston" },
  { id: "wandbox", label: "Execution Cloud B", url: "https://wandbox.org" },
  { id: "judge0", label: "Execution Cloud C", url: "https://judge0-ce.p.rapidapi.com" },
];

export type ExecProviderId = (typeof EXECUTION_ENGINES)[number]["id"];

const CACHE = new Map<string, { ok: boolean; at: number }>();
const CACHE_TTL = 60_000;

async function checkWithTimeout(url: string, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    await fetch(url, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    try {
      await fetch(url, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      return true;
    } catch {
      return false;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function checkEngineHealth(id: EditorEngineId): Promise<EngineHealth> {
  const engine = EDITOR_ENGINES[id];
  if (!engine) {
    return { id, ok: false, error: "Unknown engine" };
  }

  const cached = CACHE.get(id);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return { id, ok: cached.ok };
  }

  const hostResults = await Promise.allSettled(
    engine.cdnHosts.slice(0, 2).map(async (host) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const start = performance.now();
      try {
        await fetch(host, { mode: "no-cors", cache: "no-store", signal: controller.signal });
        return { ok: true, latencyMs: performance.now() - start };
      } catch {
        return { ok: false };
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const successes = hostResults.filter(
    (r): r is PromiseFulfilledResult<{ ok: boolean; latencyMs: number }> =>
      r.status === "fulfilled" && r.value.ok
  );

  const ok = successes.length > 0;

  // Always allow the engine to attempt load — health check only reorders priorities.
  const result: EngineHealth = {
    id,
    ok: true,
    latencyMs: successes[0]?.value.latencyMs ?? 0,
  };

  CACHE.set(id, { ok, at: Date.now() });
  return result;
}

export async function checkAllEngines(): Promise<EngineHealth[]> {
  const results = await Promise.all(
    EDITOR_ENGINE_ORDER.map((id) => checkEngineHealth(id))
  );
  return results.sort((a, b) => {
    const aIdx = EDITOR_ENGINE_ORDER.indexOf(a.id);
    const bIdx = EDITOR_ENGINE_ORDER.indexOf(b.id);
    return aIdx - bIdx;
  });
}

// Keep every engine in the pool regardless of transient health issues.
export function pickDefaultEngine(): EditorEngineId {
  if (typeof window === "undefined") return "codemirror-cdn";
  try {
    const stored = localStorage.getItem("ascendly-ide-engine-persisted");
    if (stored && stored in EDITOR_ENGINES) return stored as EditorEngineId;
  } catch {
    // ignore
  }
  return "codemirror-cdn";
}