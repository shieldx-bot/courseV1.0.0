"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { IdeTopbar } from "./ide-topbar";
import { Terminal } from "./terminal";

type TerminalSize = "small" | "medium" | "large";

interface IdeLayoutContextValue {
  terminalOpen: boolean;
  terminalSize: TerminalSize;
  rightPanelOpen: boolean;
  leftPanelOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  setTerminalSize: (size: TerminalSize) => void;
  setRightPanelOpen: (open: boolean) => void;
  setLeftPanelOpen: (open: boolean) => void;
}

const IdeLayoutContext = createContext<IdeLayoutContextValue | undefined>(undefined);

export function useIdeLayout() {
  const context = useContext(IdeLayoutContext);
  if (!context) {
    throw new Error("useIdeLayout must be used within an IdeLayout");
  }
  return context;
}

interface IdeLayoutProps {
  children: ReactNode;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  topbar?: ReactNode;
}

export function IdeLayout({ children, leftPanel, rightPanel, topbar }: IdeLayoutProps) {
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalSize, setTerminalSize] = useState<TerminalSize>("medium");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  return (
    <IdeLayoutContext.Provider
      value={{
        terminalOpen,
        terminalSize,
        rightPanelOpen,
        leftPanelOpen,
        setTerminalOpen,
        setTerminalSize,
        setRightPanelOpen,
        setLeftPanelOpen,
      }}
    >
      <div className="flex flex-col h-screen overflow-hidden dark:bg-neutral-900">
        {topbar ?? <IdeTopbar />}
        <div className="flex-1 flex overflow-hidden relative">
          {leftPanel && leftPanelOpen && (
            <aside className="hidden lg:flex w-[240px] flex-col border-r border-neutral-700 bg-neutral-900 dark:bg-neutral-900 shrink-0">
              {leftPanel}
            </aside>
          )}

          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex-1 overflow-hidden">{children}</div>
            {terminalOpen && (
              <Terminal
                isOpen={terminalOpen}
                size={terminalSize}
                onToggle={() => setTerminalOpen((prev) => !prev)}
                onResize={setTerminalSize}
              />
            )}
          </main>

          {rightPanel && rightPanelOpen && (
            <aside className="hidden lg:flex w-[260px] xl:w-[300px] flex-col border-l border-neutral-700 bg-neutral-900 dark:bg-neutral-900 shrink-0">
              {rightPanel}
            </aside>
          )}
        </div>
      </div>
    </IdeLayoutContext.Provider>
  );
}
