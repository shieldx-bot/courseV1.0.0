"use client";

import { useState, useCallback, useEffect } from "react";
import { FileCode } from "lucide-react";
import {
  IdeLayout,
  IdeTopbar,
  FileTree,
  EditorTabs,
  CodeEditor,
  AiChatPanel,
} from "@/components/ide";
import { mockPythonProject, mockJavaScriptProject, buildFileTree } from "@/lib/ide-mock-data";
import type { IDEFile, EditorTab, ChatMessage, ProjectLanguage } from "@/types/ide";
import { useToast } from "@/components/ui/toast";
import { executeCodeExternal } from "@/lib/external-ide/execution";
import type { EditorEngineId } from "@/lib/external-ide/types";

const STORAGE_KEY = "ascendly-ide-state";
const LESSONS = [
  { id: "l1", title: "Variables & Data Types", order: 1, completed: true },
  { id: "l2", title: "Control Flow", order: 2, completed: true },
  { id: "l3", title: "Functions", order: 3, completed: false },
  { id: "l4", title: "Lists & Dictionaries", order: 4, completed: false, locked: true },
  { id: "l5", title: "Loops", order: 5, completed: false, locked: true },
  { id: "l6", title: "Final Project", order: 6, completed: false, locked: true },
];

export default function IDEPage() {
  const { toast } = useToast();
  const [projectLanguage, setProjectLanguage] = useState<ProjectLanguage>("python");
  const [project, setProject] = useState(mockPythonProject);
  const [files, setFiles] = useState<IDEFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentCode, setCurrentCode] = useState("");
  const [currentLanguage, setCurrentLanguage] = useState("python");
  const [isExecuting, setIsExecuting] = useState(false);

  // Load persisted state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.projectLanguage) setProjectLanguage(state.projectLanguage);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ projectLanguage })
      );
    } catch {
      // ignore storage errors
    }
  }, [projectLanguage]);

  // Initialize project
  useEffect(() => {
    const tree = buildFileTree(project.files);
    setFiles(tree);

    const initialFile = project.files[0];
    if (initialFile) {
      setSelectedFileId(initialFile.id);
      setCurrentCode(initialFile.content);
      setCurrentLanguage(initialFile.language);
      setTabs([
        {
          id: `tab-${initialFile.id}`,
          fileId: initialFile.id,
          name: initialFile.name,
          language: initialFile.language,
          isDirty: false,
        },
      ]);
      setActiveTabId(`tab-${initialFile.id}`);
    }

    const initialChatMessages: ChatMessage[] = [
      {
        id: "chat-welcome",
        role: "system",
        content: "Hello! I'm your AI coding assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ];
    setChatMessages(initialChatMessages);
  }, [project]);

  const handleProjectSwitch = useCallback((lang: ProjectLanguage) => {
    setProjectLanguage(lang);
    const next = lang === "python" ? mockPythonProject : mockJavaScriptProject;
    setProject(next);
    setTabs([]);
    setActiveTabId(null);
    setSelectedFileId(null);
    setCurrentCode("");
    setCurrentLanguage(next.language);
  }, []);

  const handleSelectFile = useCallback(
    (fileId: string) => {
      const file = project.files.find((f) => f.id === fileId);
      if (!file) return;

      setSelectedFileId(fileId);
      setCurrentCode(file.content);
      setCurrentLanguage(file.language);

      const existingTab = tabs.find((t) => t.fileId === fileId);
      if (existingTab) {
        setActiveTabId(existingTab.id);
      } else {
        const newTab: EditorTab = {
          id: `tab-${fileId}`,
          fileId,
          name: file.name,
          language: file.language,
          isDirty: false,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }
    },
    [project.files, tabs]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const newTabs = prev.filter((t) => t.id !== tabId);
        return newTabs;
      });
    },
    []
  );

  useEffect(() => {
    if (tabs.length === 0) {
      setActiveTabId(null);
      setSelectedFileId(null);
      return;
    }
    if (!activeTabId || !tabs.find((t) => t.id === activeTabId)) {
      const lastTab = tabs[tabs.length - 1];
      setActiveTabId(lastTab.id);
      const file = project.files.find((f) => f.id === lastTab.fileId);
      if (file) {
        setSelectedFileId(file.id);
        setCurrentCode(file.content);
        setCurrentLanguage(file.language);
      }
    }
  }, [tabs, activeTabId, project.files]);

  const handleEditorChange = useCallback(
    (fileId: string, newContent: string) => {
      setCurrentCode(newContent);
      setTabs((prev) =>
        prev.map((t) =>
          t.fileId === fileId ? { ...t, isDirty: true } : t
        )
      );
    },
    []
  );

  const handleSave = useCallback(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: false } : t))
    );

    const file = project.files.find((f) => f.id === tab.fileId);
    if (file) {
      setFiles((prev) =>
        prev.map((f) => (f.id === tab.fileId ? { ...f, content: currentCode } : f))
      );
    }

      toast("File saved successfully", { type: "success" });
  }, [activeTabId, tabs, project.files, currentCode, toast]);

  const handleReset = useCallback(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    const file = project.files.find((f) => f.id === tab.fileId);
    if (file) {
      setCurrentCode(file.content);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: false } : t))
      );
      toast("File reset to original content", { type: "success" });
    }
  }, [activeTabId, tabs, project.files, toast]);

  const [activeEngine, setActiveEngine] = useState<EditorEngineId>("codemirror-cdn");

  const handleRun = useCallback(async () => {
    if (!currentCode.trim()) {
      toast("Nothing to run", { type: "error" });
      return;
    }
    if (isExecuting) return;

    setIsExecuting(true);

    try {
      const result = await executeCodeExternal(currentLanguage, currentCode);
      if (result.success) {
        toast(`Execution completed in ${result.executionTime?.toFixed(2) ?? "?"}ms`, { type: "success" });
      } else {
        toast(result.error || "Execution failed", { type: "error" });
      }
    } finally {
      setIsExecuting(false);
    }
  }, [currentCode, currentLanguage, toast, isExecuting]);

  const handleSubmit = useCallback(() => {
    if (!currentCode.trim()) {
      toast("No code to submit", { type: "error" });
      return;
    }
      toast("Code submitted successfully!", { type: "success" });
  }, [currentCode, toast]);

  const handleChatMessage = useCallback(
    async (message: string) => {
      const userMessage: ChatMessage = {
        id: `chat-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, userMessage]);

      setTimeout(() => {
        const assistantMessage: ChatMessage = {
          id: `chat-${Date.now()}-assistant`,
          role: "assistant",
          content: `I've analyzed your code. Here's what I found:\n\nYour implementation looks good! The function correctly handles the basic cases. Consider adding error handling for edge cases.\n\n\`\`\`${currentLanguage}\ndef add(a, b):\n    return a + b\n\`\`\``,
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
      }, 1500);
    },
    [currentLanguage]
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <IdeLayout
      topbar={
        <IdeTopbar
          courseName={project.name}
          lessonTitle={activeTab?.name ?? "No file open"}
          projectLanguage={projectLanguage}
          onProjectChange={handleProjectSwitch}
          onRun={handleRun}
          onSave={handleSave}
          onReset={handleReset}
          onSubmit={handleSubmit}
          isRunning={isExecuting}
        />
      }
      leftPanel={
        <FileTree
          files={files}
          selectedFileId={selectedFileId}
          onSelectFile={handleSelectFile}
          lessons={LESSONS}
          onSelectLesson={(id) => console.log("Selected lesson:", id)}
          currentLessonId="l3"
        />
      }
      rightPanel={
        <AiChatPanel
          isOpen={true}
          onToggle={() => {}}
          onSendMessage={handleChatMessage}
          currentCode={currentCode}
          currentLanguage={currentLanguage}
        />
      }
    >
      <div className="flex flex-col h-full dark:bg-neutral-900">
        <EditorTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={handleCloseTab}
        />

        <div className="flex-1 overflow-hidden relative">
          {activeTab ? (
            <CodeEditor
              fileId={activeTab.fileId}
              content={currentCode}
              language={currentLanguage}
              onChange={(newContent) => handleEditorChange(activeTab.fileId, newContent)}
              engine={activeEngine}
              files={files}
              onEngineFallback={(failed) => {
                console.warn("Editor engine failed, falling back:", failed);
                toast("Editor engine switched for reliability", { type: "info" });
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center dark:bg-neutral-900">
              <div className="text-center">
                <FileCode className="h-16 w-16 mx-auto mb-4 text-neutral-600 dark:text-neutral-400" />
                <h3 className="text-lg font-medium text-neutral-300 dark:text-neutral-400 mb-2">
                  No file open
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-500">
                  Select a file from the explorer to start editing
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </IdeLayout>
  );
}
