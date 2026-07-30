"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TerminalLine } from "@/types/ide";
import {
  Terminal as TerminalIcon,
  Plus,
  SplitSquareVertical,
  X,
  ChevronDown,
  ChevronUp,
  Play,
} from "lucide-react";

interface TerminalProps {
  isOpen: boolean;
  size: "small" | "medium" | "large";
  onToggle: () => void;
  onResize: (size: "small" | "medium" | "large") => void;
  onRunCommand?: (command: string) => void;
}

const SHELLS = ["bash", "zsh", "fish", "PowerShell", "cmd", "node"];

const SIZE_HEIGHTS: Record<string, number> = {
  small: 128,
  medium: 200,
  large: 400,
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createInitialLines(): TerminalLine[] {
  return [
    {
      id: generateId(),
      type: "system",
      content: "Welcome to Ascendly IDE Terminal",
      timestamp: new Date(),
    },
    {
      id: generateId(),
      type: "system",
      content: "Python 3.11.0",
      timestamp: new Date(),
    },
    {
      id: generateId(),
      type: "output",
      content: "Type help to see available commands.",
      timestamp: new Date(),
    },
  ];
}

export function Terminal({
  isOpen,
  size,
  onToggle,
  onResize,
  onRunCommand,
}: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>(createInitialLines);
  const [inputValue, setInputValue] = useState("");
  const [shell, setShell] = useState("bash");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, size]);

  const executeCommand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      const commandLine: TerminalLine = {
        id: generateId(),
        type: "command",
        content: `$ ${trimmed}`,
        timestamp: new Date(),
      };

      setLines((prev) => [...prev, commandLine]);
      setCommandHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);
      setInputValue("");

      if (onRunCommand) {
        onRunCommand(trimmed);
      }

      const lower = trimmed.toLowerCase();

      if (lower === "clear") {
        setLines([]);
        return;
      }

      if (lower === "help") {
        setLines((prev) => [
          ...prev,
          {
            id: generateId(),
            type: "output",
            content: "Available commands: help, clear, echo, whoami, date, ls",
            timestamp: new Date(),
          },
        ]);
        return;
      }

      if (lower.startsWith("echo ")) {
        setLines((prev) => [
          ...prev,
          {
            id: generateId(),
            type: "output",
            content: trimmed.slice(5).replace(/^["']|["']$/g, ""),
            timestamp: new Date(),
          },
        ]);
        return;
      }

      if (lower === "whoami") {
        setLines((prev) => [
          ...prev,
          {
            id: generateId(),
            type: "output",
            content: "ascendly-user",
            timestamp: new Date(),
          },
        ]);
        return;
      }

      if (lower === "date") {
        setLines((prev) => [
          ...prev,
          {
            id: generateId(),
            type: "output",
            content: new Date().toString(),
            timestamp: new Date(),
          },
        ]);
        return;
      }

      if (lower === "ls") {
        setLines((prev) => [
          ...prev,
          {
            id: generateId(),
            type: "output",
            content: "src/  package.json  tsconfig.json  README.md",
            timestamp: new Date(),
          },
        ]);
        return;
      }

      setLines((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "error",
          content: `command not found: ${trimmed.split(" ")[0]}`,
          timestamp: new Date(),
        },
      ]);
    },
    [onRunCommand]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeCommand(inputValue);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex === -1) return;
        const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
        if (newIndex === commandHistory.length - 1) {
          setHistoryIndex(-1);
          setInputValue("");
        }
      }
    },
    [executeCommand, inputValue, commandHistory, historyIndex]
  );

  const handleDragStart = useCallback(
    (clientY: number) => {
      if (!containerRef.current) return;
      setIsDragging(true);
      setDragStartY(clientY);
      setDragStartHeight(containerRef.current.clientHeight);
    },
    []
  );

  const handleDragMove = useCallback(
    (clientY: number) => {
      if (!isDragging) return;
      const delta = dragStartY - clientY;
      const newHeight = Math.max(80, dragStartHeight + delta);
      const sizes: string[] = ["small", "medium", "large"];
      const closest = sizes.reduce((a, b) =>
        Math.abs(SIZE_HEIGHTS[b] - newHeight) <
        Math.abs(SIZE_HEIGHTS[a] - newHeight)
          ? b
          : a
      );
      onResize(closest);
    },
    [isDragging, dragStartY, dragStartHeight, onResize]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY);
    };
    const handleMouseUp = () => {
      handleDragEnd();
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleNewTerminal = useCallback(() => {
    setLines(createInitialLines());
    setInputValue("");
    setCommandHistory([]);
    setHistoryIndex(-1);
  }, []);

  const handleKillTerminal = useCallback(() => {
    setLines([
      {
        id: generateId(),
        type: "system",
        content: "Terminal killed. Click New Terminal to restart.",
        timestamp: new Date(),
      },
    ]);
    setInputValue("");
    setCommandHistory([]);
    setHistoryIndex(-1);
  }, []);

  const handleSplitTerminal = useCallback(() => {
    setLines((prev) => [
      ...prev,
      {
        id: generateId(),
        type: "system",
        content: "Split terminal pane created (mock).",
        timestamp: new Date(),
      },
    ]);
  }, []);

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "command":
        return "text-green-400 dark:text-green-400";
      case "error":
        return "text-red-400 dark:text-red-400";
      case "system":
        return "text-yellow-400 dark:text-yellow-400";
      case "output":
      default:
        return "text-neutral-300 dark:text-neutral-300";
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full border-t border-neutral-700 dark:border-neutral-700 bg-neutral-900 dark:bg-black font-mono text-sm"
      style={{ height: SIZE_HEIGHTS[size] }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-800 dark:bg-neutral-800 rounded-t-md select-none shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 cursor-pointer transition-colors" title="Close" onClick={onToggle} />
            <span className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 cursor-pointer transition-colors" title="Minimize" />
            <span className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 cursor-pointer transition-colors" title="Maximize" />
          </div>
          <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-400 flex items-center gap-1">
            <TerminalIcon size={12} />
            Terminal
          </span>
        </div>

        <div className="flex items-center gap-1">
          <select
            value={shell}
            onChange={(e) => setShell(e.target.value)}
            className="h-7 text-xs bg-neutral-700 dark:bg-neutral-700 text-neutral-200 dark:text-neutral-200 border border-neutral-600 dark:border-neutral-600 rounded px-1.5 outline-none focus:ring-1 focus:ring-neutral-500 cursor-pointer"
          >
            {SHELLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleNewTerminal}
            className="p-1 rounded hover:bg-neutral-700 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="New Terminal"
          >
            <Plus size={14} />
          </button>

          <button
            type="button"
            onClick={handleSplitTerminal}
            className="p-1 rounded hover:bg-neutral-700 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Split Terminal"
          >
            <SplitSquareVertical size={14} />
          </button>

          <button
            type="button"
            onClick={handleKillTerminal}
            className="p-1 rounded hover:bg-neutral-700 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-400 transition-colors"
            title="Kill Terminal"
          >
            <X size={14} />
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded hover:bg-neutral-700 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
            title={size === "small" ? "Expand" : "Collapse"}
          >
            {size === "small" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 text-green-400 dark:text-green-400"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-words ${getLineColor(line.type)}`}
          >
            {line.content}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-t border-neutral-800 dark:border-neutral-800">
        <span className="text-green-400 dark:text-green-400 select-none">
          {shell === "powershell" || shell === "cmd" ? ">" : "$"}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="flex-1 bg-transparent outline-none text-neutral-100 dark:text-neutral-100 text-sm caret-white"
          placeholder="Type a command..."
        />
        {inputValue.trim() && (
          <button
            type="button"
            onClick={() => executeCommand(inputValue)}
            className="p-1 rounded hover:bg-neutral-800 dark:hover:bg-neutral-800 text-neutral-400 hover:text-green-400 transition-colors"
            title="Run"
          >
            <Play size={14} />
          </button>
        )}
      </div>

      <div
        className={`flex items-center justify-center cursor-ns-resize shrink-0 ${
          isDragging ? "bg-neutral-700/50 dark:bg-neutral-700/50" : "hover:bg-neutral-800 dark:hover:bg-neutral-800"
        } transition-colors`}
        style={{ height: 6 }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleDragStart(e.clientY);
        }}
      >
        <div className="w-10 h-1 rounded-full bg-neutral-600 dark:bg-neutral-600" />
      </div>
    </div>
  );
}
