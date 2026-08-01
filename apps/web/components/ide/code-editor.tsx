"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { EditorOrchestrator } from "./editors/editor-orchestrator";
import type { EditorEngineId } from "@/lib/external-ide/types";
import { pickDefaultEngine } from "@/lib/external-ide/providers";

type EditorTheme = "vs-dark" | "light";

interface CodeEditorProps {
  fileId: string;
  content: string;
  language: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  theme?: EditorTheme;
}

const KEYWORD_PATTERNS: Record<string, string[]> = {
  javascript: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "new", "this", "class",
    "extends", "super", "import", "export", "default", "from", "async",
    "await", "try", "catch", "finally", "throw", "typeof", "instanceof",
    "void", "delete", "in", "of", "yield", "true", "false", "null", "undefined",
  ],
  typescript: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "new", "this", "class",
    "extends", "super", "import", "export", "default", "from", "async",
    "await", "try", "catch", "finally", "throw", "typeof", "instanceof",
    "void", "delete", "in", "of", "yield", "true", "false", "null", "undefined",
    "interface", "type", "enum", "implements", "private", "protected",
    "public", "readonly", "abstract", "as", "keyof", "infer", "is", "assert",
    "module", "namespace", "declare", "any", "number", "string", "boolean",
    "symbol", "bigint", "object", "never", "unknown",
  ],
  python: [
    "def", "class", "return", "if", "elif", "else", "for", "while", "break",
    "continue", "import", "from", "as", "try", "except", "finally", "raise",
    "with", "yield", "lambda", "pass", "and", "or", "not", "in", "is",
    "True", "False", "None", "async", "await", "self", "print", "global",
    "nonlocal", "assert", "del",
  ],
  java: [
    "public", "private", "protected", "static", "final", "abstract", "class",
    "interface", "extends", "implements", "return", "if", "else", "for",
    "while", "do", "switch", "case", "break", "continue", "new", "this",
    "import", "package", "try", "catch", "finally", "throw", "throws",
    "void", "int", "long", "double", "float", "boolean", "char", "byte",
    "short", "true", "false", "null", "super", "instanceof", "synchronized",
    "volatile", "transient", "native", "strictfp",
  ],
  "c++": ["int", "long", "short", "char", "float", "double", "void", "bool",
    "class", "struct", "public", "private", "protected", "virtual", "override",
    "return", "if", "else", "for", "while", "do", "switch", "case", "break",
    "continue", "new", "delete", "this", "include", "using", "namespace",
    "template", "typename", "friend", "const", "static", "extern", "inline",
    "volatile", "mutable", "explicit", "true", "false", "nullptr", "throw",
    "try", "catch", "auto", "decltype", "constexpr",
  ],
  c: ["int", "long", "short", "char", "float", "double", "void", "signed",
    "unsigned", "bool", "struct", "union", "enum", "typedef", "return",
    "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
    "goto", "sizeof", "include", "define", "ifdef", "endif", "pragma",
    "const", "static", "extern", "register", "auto", "volatile", "restrict",
    "true", "false", "null", "NULL", "malloc", "free", "printf", "scanf",
  ],
  go: [
    "package", "import", "func", "return", "if", "else", "for", "range",
    "switch", "case", "break", "continue", "go", "defer", "struct", "type",
    "interface", "map", "chan", "var", "const", "fallthrough", "goto",
    "select", "default", "true", "false", "nil", "make", "new", "append",
    "copy", "len", "cap", "delete", "close", "panic", "recover", "print",
    "println", "fmt", "string", "int", "int8", "int16", "int32", "int64",
    "uint", "uint8", "uint16", "uint32", "uint64", "float32", "float64",
  ],
  rust: [
    "fn", "let", "mut", "const", "return", "if", "else", "match", "for",
    "while", "loop", "break", "continue", "struct", "enum", "impl", "trait",
    "pub", "use", "mod", "super", "self", "crate", "where", "type", "as",
    "ref", "move", "async", "await", "dyn", "static", "true", "false",
    "Some", "None", "Ok", "Err", "println", "vec", "Box", "Rc", "Arc",
    "Option", "Result", "String", "str", "i8", "i16", "i32", "i64", "i128",
    "u8", "u16", "u32", "u64", "u128", "f32", "f64", "bool", "char", "usize",
    "isize",
  ],
  ruby: [
    "def", "end", "class", "module", "return", "if", "else", "elsif", "unless",
    "case", "when", "for", "while", "until", "begin", "rescue", "ensure",
    "raise", "do", "break", "next", "redo", "retry", "yield", "require",
    "include", "extend", "attr", "attr_reader", "attr_writer", "attr_accessor",
    "public", "private", "protected", "true", "false", "nil", "self", "super",
    "and", "or", "not", "in", "lambda", "proc", "begin", "end",
  ],
  php: [
    "<?php", "echo", "print", "function", "return", "if", "else", "elseif",
    "while", "for", "foreach", "do", "switch", "case", "break", "continue",
    "class", "interface", "trait", "extends", "implements", "new", "this",
    "self", "parent", "static", "public", "private", "protected", "abstract",
    "final", "const", "static", "global", "var", "try", "catch", "finally",
    "throw", "namespace", "use", "as", "true", "false", "null", "array",
    "string", "int", "float", "bool", "object", "callable", "iterable",
    "echo", "die", "exit", "isset", "unset", "empty", "list", "include",
    "require", "include_once", "require_once",
  ],
  json: [
    "true", "false", "null",
  ],
};

function getLanguageAlias(language: string): string {
  const lang = language.toLowerCase();
  const aliasMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    py: "python",
    rb: "ruby",
    rs: "rust",
    cpp: "c++",
    cc: "c++",
    hpp: "c++",
    h: "c",
    go: "go",
    java: "java",
    php: "php",
    json: "json",
    md: "plaintext",
    markdown: "plaintext",
    txt: "plaintext",
    plaintext: "plaintext",
    css: "css",
    html: "html",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    shell: "bash",
    dockerfile: "dockerfile",
  };
  return aliasMap[lang] || lang;
}

interface TokenSpan {
  text: string;
  className: string;
}

function tokenizeLine(line: string, keywords: string[]): TokenSpan[] {
  if (!keywords.length) {
    return [{ text: escapeHtml(line), className: "" }];
  }

  const keywordSet = new Set(keywords);
  const tokens: TokenSpan[] = [];
  const keywordPattern = new RegExp(
    `\\b(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "g"
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = keywordPattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: escapeHtml(line.slice(lastIndex, match.index)), className: "" });
    }
    tokens.push({ text: escapeHtml(match[1]), className: "text-purple-400 dark:text-purple-300" });
    lastIndex = match.index + match[1].length;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: escapeHtml(line.slice(lastIndex)), className: "" });
  }

  if (tokens.length === 0) {
    return [{ text: escapeHtml(line), className: "" }];
  }

  return tokens;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function CodeEditorFallback({
  content,
  language,
  onChange,
  readOnly,
  theme,
}: {
  content: string;
  language: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  theme?: EditorTheme;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const lineHeight = 24;
  const lineNumbersGutterWidth = 48;
  const [scrollTop, setScrollTop] = useState(0);
  const isDark = theme !== "light";

  const aliasedLanguage = useMemo(() => getLanguageAlias(language), [language]);
  const keywords = useMemo(() => KEYWORD_PATTERNS[aliasedLanguage] || [], [aliasedLanguage]);
  const lineCount = useMemo(() => content.split("\n").length, [content]);

  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });

  const getCurrentWord = useCallback((value: string, cursorPos: number): { word: string; start: number } => {
    const beforeCursor = value.slice(0, cursorPos);
    const match = beforeCursor.match(/[\w.]+$/);
    if (!match) {
      return { word: "", start: cursorPos };
    }
    return { word: match[0], start: cursorPos - match[0].length };
  }, []);

  const showAutocomplete = useCallback((value: string, cursorPos: number) => {
    const { word, start } = getCurrentWord(value, cursorPos);
    if (word.length < 1) {
      setAutocompleteVisible(false);
      return;
    }

    const matches = keywords.filter((kw) => kw.startsWith(word) && kw !== word).slice(0, 8);
    if (matches.length === 0) {
      setAutocompleteVisible(false);
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const lineHeightPx = lineHeight;
    const linesBefore = value.slice(0, cursorPos).split("\n");
    const currentLineIndex = linesBefore.length - 1;
    const currentCol = linesBefore[currentLineIndex].length;
    const top = 48 + currentLineIndex * lineHeightPx - textarea.scrollTop;
    const left = 48 + currentCol * 8.4;

    setAutocompleteSuggestions(matches);
    setAutocompleteIndex(0);
    setAutocompletePosition({ top, left });
    setAutocompleteVisible(true);
  }, [keywords, getCurrentWord]);

  const acceptAutocomplete = useCallback((suggestion: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const { start } = getCurrentWord(value, cursorPos);
    const newValue = value.slice(0, start) + suggestion + value.slice(cursorPos);
    onChange(newValue);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + suggestion.length;
      }
    });

    setAutocompleteVisible(false);
  }, [onChange, getCurrentWord]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      const cursorPos = e.target.selectionStart;
      showAutocomplete(e.target.value, cursorPos);
    },
    [onChange, showAutocomplete]
  );

  const handleScroll = useCallback(() => {
    if (textareaRef.current) {
      setScrollTop(textareaRef.current.scrollTop);
    }
    setAutocompleteVisible(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (autocompleteVisible) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setAutocompleteIndex((prev) => (prev + 1) % autocompleteSuggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setAutocompleteIndex((prev) => (prev - 1 + autocompleteSuggestions.length) % autocompleteSuggestions.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          acceptAutocomplete(autocompleteSuggestions[autocompleteIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setAutocompleteVisible(false);
          return;
        }
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const insertion = e.shiftKey ? "" : "    ";

        if (e.shiftKey && start === end) {
          const lineStart = value.lastIndexOf("\n", start - 1) + 1;
          const currentLine = value.slice(lineStart, start);
          if (currentLine.startsWith("    ")) {
            const newValue = value.slice(0, lineStart) + currentLine.slice(4) + value.slice(start);
            onChange(newValue);
            requestAnimationFrame(() => {
              textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 4);
            });
            return;
          }
        }

        const newValue = value.slice(0, start) + insertion + value.slice(end);
        onChange(newValue);

        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
        });
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const value = textarea.value;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const currentLine = value.slice(lineStart, start);
        const match = currentLine.match(/^(\s*)/);
        const indent = match ? match[1] : "";

        const insertion = "\n" + indent;
        const newValue = value.slice(0, start) + insertion + value.slice(textarea.selectionEnd);
        onChange(newValue);

        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
        });
        return;
      }
    },
    [autocompleteVisible, autocompleteSuggestions, autocompleteIndex, onChange, acceptAutocomplete]
  );

  const handleBlur = useCallback(() => {
    setTimeout(() => setAutocompleteVisible(false), 150);
  }, []);

  const visibleStartLine = Math.max(0, Math.floor(scrollTop / lineHeight) - 2);
  const visibleEndLine = Math.min(lineCount, visibleStartLine + Math.ceil((textareaRef.current?.clientHeight || 600) / lineHeight) + 4);

  const lineNumbers = useMemo(() => {
    const numbers: { line: number; top: number }[] = [];
    for (let i = visibleStartLine + 1; i <= visibleEndLine; i++) {
      numbers.push({ line: i, top: (i - 1) * lineHeight });
    }
    return numbers;
  }, [visibleStartLine, visibleEndLine, lineCount]);

  const minimapHeight = Math.max(10, Math.min(100, (lineCount * lineHeight) * 0.1));
  const minimapScrollRatio = scrollTop / Math.max(1, lineCount * lineHeight - (textareaRef.current?.clientHeight || 600));

  return (
    <div className="relative flex h-full w-full overflow-hidden dark:bg-neutral-900 bg-white">
      <div
        ref={lineNumbersRef}
        className="absolute left-0 top-0 bottom-0 select-none overflow-hidden pointer-events-none"
        style={{ width: lineNumbersGutterWidth }}
      >
        <div
          className="relative"
          style={{ height: lineCount * lineHeight, marginTop: -scrollTop }}
        >
          {lineNumbers.map(({ line, top }) => (
            <div
              key={line}
              className="absolute text-right text-xs leading-6 pr-2 font-mono"
              style={{ top, height: lineHeight }}
            >
              <span className="text-neutral-600 dark:text-neutral-500">
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 relative min-w-0">
        <pre
          className="absolute inset-0 pointer-events-none overflow-hidden p-4 pl-12 font-mono text-sm leading-6 whitespace-pre-wrap break-words dark:text-neutral-100 text-neutral-900"
          aria-hidden="true"
        >
          <code>
            {content.split("\n").map((line, lineIndex) => {
              const tokens = tokenizeLine(line, keywords);
              return (
                <div key={lineIndex} style={{ height: lineHeight }}>
                  {tokens.map((token, tokenIndex) => (
                    <span key={tokenIndex} className={token.className}>
                      {token.text || "\u00A0"}
                    </span>
                  ))}
                </div>
              );
            })}
          </code>
        </pre>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onBlur={handleBlur}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          data-gramm="false"
          className={[
            "absolute inset-0 resize-none outline-none font-mono text-sm leading-6",
            "p-4 pl-12 w-full h-full",
            "bg-transparent caret-white dark:caret-white",
            isDark
              ? "text-transparent dark:text-transparent placeholder:text-neutral-600"
              : "text-transparent placeholder:text-neutral-400",
            readOnly ? "cursor-default" : "cursor-text",
            readOnly ? "select-none" : "select-text",
          ].join(" ")}
          style={{
            color: isDark ? "transparent" : "transparent",
            caretColor: isDark ? "#ffffff" : "#000000",
            WebkitTextFillColor: isDark ? "transparent" : "transparent",
          }}
        />

        {autocompleteVisible && (
          <div
            ref={autocompleteRef}
            className="absolute z-50 w-64 max-h-48 overflow-y-auto rounded-md border border-neutral-700 bg-neutral-800 shadow-xl"
            style={{ top: autocompletePosition.top, left: autocompletePosition.left }}
          >
            {autocompleteSuggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm font-mono transition-colors",
                  index === autocompleteIndex
                    ? "bg-accent-600 text-white"
                    : "text-neutral-200 hover:bg-neutral-700"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptAutocomplete(suggestion);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {isDark && (
        <div
          ref={minimapRef}
          className="hidden sm:flex w-3 shrink-0 border-l border-neutral-800 dark:border-neutral-700 relative cursor-pointer"
          title="Minimap"
        >
          <div className="absolute inset-x-0 bg-neutral-700/40 dark:bg-neutral-700/40 rounded-sm"
            style={{
              height: minimapHeight,
              top: minimapScrollRatio * (100 - minimapHeight),
            }}
          />
        </div>
      )}
    </div>
  );
}

export function CodeEditor({
  fileId,
  content,
  language,
  onChange,
  readOnly = false,
  theme = "vs-dark",
  engine,
  files,
  onEngineFallback,
}: CodeEditorProps & {
  engine?: EditorEngineId;
  files?: React.ComponentProps<typeof EditorOrchestrator>["files"];
  onEngineFallback?: (failed: EditorEngineId) => void;
}) {
  const [activeEngine, setActiveEngine] = useState<EditorEngineId>(
    () => engine || (typeof window !== "undefined" ? pickDefaultEngine() : "codemirror-cdn")
  );

  useEffect(() => {
    if (engine) setActiveEngine(engine);
  }, [engine]);

  return (
    <EditorOrchestrator
      engine={activeEngine}
      files={files || []}
      fileId={fileId}
      content={content}
      language={language}
      onChange={onChange}
      readOnly={readOnly}
      theme={theme}
      onEngineFallback={onEngineFallback}
    />
  );
}
