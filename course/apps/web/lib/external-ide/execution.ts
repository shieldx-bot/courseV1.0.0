"use client";

import type { ExecutionResult } from "./types";
import type { ExecProviderId } from "./providers";

const PISTON_LANG: Record<string, string> = {
  python: "python", py: "python",
  javascript: "javascript", js: "javascript",
  typescript: "typescript", ts: "typescript",
  java: "java", c: "c", "c++": "c++", cpp: "c++",
  go: "go", rust: "rust", ruby: "ruby", php: "php",
  bash: "bash", sh: "bash",
};

const PISTON_VERSION: Record<string, string> = {
  python: "3.10.0", javascript: "18.15.0", typescript: "5.0.3",
  java: "15.0.2", c: "10.2.0", "c++": "10.2.0", go: "1.16.2",
  rust: "1.68.2", ruby: "3.0.1", php: "8.2.3", bash: "5.2.0",
};

const WANDBOX: Record<string, string> = {
  python: "cpython-3.12.0",
  javascript: "nodejs-head-2.0.0",
  ruby: "ruby-3.3.3",
};

const JUDGE0: Record<string, number> = {
  python: 71, javascript: 63, typescript: 74, java: 62, c: 50,
  "c++": 54, go: 60, rust: 73, ruby: 72, php: 68, bash: 46,
};

async function runPiston(language: string, source: string): Promise<ExecutionResult> {
  const start = performance.now();
  const res = await fetch("https://emkc.org/api/v2/piston/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: PISTON_LANG[language] || language,
      version: PISTON_VERSION[language] || "*",
      files: [{ content: source }],
      stdin: "",
    }),
  });
  if (!res.ok) throw new Error(`Piston HTTP ${res.status}`);
  const data = await res.json();
  return {
    success: data.run?.code === 0,
    output: data.run?.stdout || undefined,
    error: data.run?.stderr || data.run?.signal || undefined,
    executionTime: performance.now() - start,
    engine: "piston",
  };
}

async function runWandbox(language: string, source: string): Promise<ExecutionResult> {
  const start = performance.now();
  const compiler = WANDBOX[language];
  if (!compiler) throw new Error("Wandbox does not support this language");
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compiler, code: source, stdin: "" }),
  });
  if (!res.ok) throw new Error(`Wandbox HTTP ${res.status}`);
  const data = await res.json();
  return {
    success: !data.program_error && !data.compiler_error,
    output: data.program_output || undefined,
    error: data.program_error || data.compiler_error || undefined,
    executionTime: performance.now() - start,
    engine: "wandbox",
  };
}

async function runJudge0(language: string, source: string): Promise<ExecutionResult> {
  const start = performance.now();
  const langId = JUDGE0[language];
  if (!langId) throw new Error("Judge0 does not support this language");
  const submit = await fetch(
    "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
      body: JSON.stringify({
        source_code: source,
        language_id: langId,
        stdin: "",
        cpu_time_limit: 5,
        memory_limit: 256000,
      }),
    }
  );
  if (!submit.ok) throw new Error(`Judge0 HTTP ${submit.status}`);
  const data = await submit.json();
  return {
    success: data.status?.id === 3,
    output: data.stdout || undefined,
    error: data.stderr || data.compile_output || data.status?.description || undefined,
    executionTime: performance.now() - start,
    engine: "judge0",
  };
}

const RUNNERS: Record<ExecProviderId, (l: string, s: string) => Promise<ExecutionResult>> = {
  piston: runPiston,
  wandbox: runWandbox,
  judge0: runJudge0,
};

export async function executeCodeExternal(language: string, source: string): Promise<ExecutionResult> {
  let preferred: ExecProviderId = "piston";
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("ascendly-ide-exec-engine");
      if (stored === "piston" || stored === "wandbox" || stored === "judge0") preferred = stored;
    } catch {
      // ignore
    }
  }
  const order: ExecProviderId[] = [preferred, ...(["piston", "wandbox", "judge0"] as ExecProviderId[]).filter((e) => e !== preferred)];
  const errors: string[] = [];
  for (const engine of order) {
    try {
      return await RUNNERS[engine](language, source);
    } catch (err) {
      errors.push(`${engine}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  return { success: false, error: `All execution providers failed. [${errors.join(" | ")}]`, engine: "none" };
}