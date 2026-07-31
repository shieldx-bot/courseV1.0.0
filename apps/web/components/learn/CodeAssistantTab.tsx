"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Copy, Check, Sparkles, Brain, Search, Bug, FileCode, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface CodeAssistantTabProps {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  lessonLanguage?: string;
  lessonContext?: string;
  starterCode?: string;
}

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "sql", label: "SQL" },
] as const;

type Language = typeof LANGUAGES[number]["value"];

type TabType = "generate" | "explain" | "review" | "debug";

const TAB_CONFIG: Record<TabType, { label: string; icon: React.ReactNode; description: string }> = {
  generate: { label: "Generate", icon: <Sparkles className="h-4 w-4" />, description: "Create code from a description" },
  explain: { label: "Explain", icon: <Brain className="h-4 w-4" />, description: "Understand what code does" },
  review: { label: "Review", icon: <Search className="h-4 w-4" />, description: "Get feedback on your code" },
  debug: { label: "Debug", icon: <Bug className="h-4 w-4" />, description: "Fix errors in your code" },
};

export function CodeAssistantTab({
  courseId,
  lessonId,
  lessonTitle,
  lessonLanguage = "python",
  lessonContext,
  starterCode,
}: CodeAssistantTabProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("generate");
  const [language, setLanguage] = useState<Language>((lessonLanguage as Language) || "python");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate tab state
  const [task, setTask] = useState("");
  const [useContext, setUseContext] = useState(true);
  const [useStarter, setUseStarter] = useState(false);

  // Explain tab state
  const [codeToExplain, setCodeToExplain] = useState("");
  const [focusArea, setFocusArea] = useState("");

  // Review tab state
  const [codeToReview, setCodeToReview] = useState("");
  const [reviewTask, setReviewTask] = useState("");

  // Debug tab state
  const [codeToDebug, setCodeToDebug] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [debugTask, setDebugTask] = useState("");

  const resultRef = useRef<HTMLPreElement>(null);

  const copyResult = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleGenerate = async () => {
    if (!task.trim()) {
      toast("Please describe what you want to build", { type: "error" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.codeAssistant.generate({
        task,
        language,
        context: useContext ? lessonContext : undefined,
        starter_code: useStarter ? starterCode : undefined,
      });
      setResult(response.explanation || response.code || "No response");
    } catch (error: any) {
      toast(error.message || "Code generation failed", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!codeToExplain.trim()) {
      toast("Please paste code to explain", { type: "error" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.codeAssistant.explain({
        code: codeToExplain,
        language,
        focus: focusArea || undefined,
      });
      setResult(response.explanation || "No explanation returned");
    } catch (error: any) {
      toast(error.message || "Code explanation failed", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!codeToReview.trim()) {
      toast("Please paste code to review", { type: "error" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.codeAssistant.review({
        code: codeToReview,
        language,
        task: reviewTask || undefined,
      });
      setResult(response.review || "No review returned");
    } catch (error: any) {
      toast(error.message || "Code review failed", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDebug = async () => {
    if (!codeToDebug.trim() || !errorMessage.trim()) {
      toast("Please provide both code and error message", { type: "error" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.codeAssistant.debug({
        code: codeToDebug,
        language,
        error: errorMessage,
        task: debugTask || undefined,
      });
      setResult(response.debug_help || "No debug help returned");
    } catch (error: any) {
      toast(error.message || "Debug help failed", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "generate":
        return (
          <div className="space-y-4">
            <Textarea
              placeholder="Describe what you want to build... e.g., 'Create a function that validates email addresses using regex'"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="min-h-[100px]"
              rows={4}
            />
            <div className="flex flex-wrap items-center gap-4">
              <Select value={language} onValueChange={setLanguage as (value: string) => void}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lessonContext && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useContext}
                    onChange={(e) => setUseContext(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Use lesson context
                </label>
              )}
              {starterCode && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useStarter}
                    onChange={(e) => setUseStarter(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Include starter code
                </label>
              )}
            </div>
            <Button onClick={handleGenerate} disabled={loading || !task.trim()} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Code
            </Button>
          </div>
        );

      case "explain":
        return (
          <div className="space-y-4">
            <Textarea
              placeholder="Paste code to explain..."
              value={codeToExplain}
              onChange={(e) => setCodeToExplain(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
              rows={6}
            />
            <Textarea
              placeholder="Optional: What to focus on? (e.g., 'async/await', 'recursion', 'design patterns')"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              rows={2}
            />
            <Button onClick={handleExplain} disabled={loading || !codeToExplain.trim()} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              Explain Code
            </Button>
          </div>
        );

      case "review":
        return (
          <div className="space-y-4">
            <Textarea
              placeholder="Paste your code for review..."
              value={codeToReview}
              onChange={(e) => setCodeToReview(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
              rows={6}
            />
            <Textarea
              placeholder="Optional: What was this code supposed to do?"
              value={reviewTask}
              onChange={(e) => setReviewTask(e.target.value)}
              rows={2}
            />
            <Button onClick={handleReview} disabled={loading || !codeToReview.trim()} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Review Code
            </Button>
          </div>
        );

      case "debug":
        return (
          <div className="space-y-4">
            <Textarea
              placeholder="Paste the code with the bug..."
              value={codeToDebug}
              onChange={(e) => setCodeToDebug(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
              rows={6}
            />
            <Textarea
              placeholder="Paste the error message or describe the problem..."
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
              rows={3}
            />
            <Textarea
              placeholder="Optional: What was this code supposed to do?"
              value={debugTask}
              onChange={(e) => setDebugTask(e.target.value)}
              rows={2}
            />
            <Button onClick={handleDebug} disabled={loading || !codeToDebug.trim() || !errorMessage.trim()} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bug className="mr-2 h-4 w-4" />}
              Debug Help
            </Button>
          </div>
        );
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCode className="h-5 w-5 text-accent-500" />
            Code Assistant
          </CardTitle>
          <span className="text-xs text-neutral-500">{lessonTitle}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab as (value: string) => void} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mb-4" role="tablist">
            {Object.entries(TAB_CONFIG).map(([key, config]) => (
              <TabsTrigger key={key} value={key as TabType} className="flex items-center justify-center gap-1 text-xs py-2" role="tab">
                {config.icon}
                {config.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="generate" className="flex-1 flex flex-col overflow-hidden" role="tabpanel">
            <ScrollArea className="flex-1 pr-2">
              {renderTabContent()}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="explain" className="flex-1 flex flex-col overflow-hidden" role="tabpanel">
            <ScrollArea className="flex-1 pr-2">
              {renderTabContent()}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="review" className="flex-1 flex flex-col overflow-hidden" role="tabpanel">
            <ScrollArea className="flex-1 pr-2">
              {renderTabContent()}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="debug" className="flex-1 flex flex-col overflow-hidden" role="tabpanel">
            <ScrollArea className="flex-1 pr-2">
              {renderTabContent()}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {result && (
          <div className="mt-4 border-t pt-4 flex-shrink-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <span className="font-medium text-neutral-900">Result</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyResult}
                className="h-8 w-8 p-0"
                aria-label={copied ? "Copied!" : "Copy result"}
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <ScrollArea className="max-h-[300px] rounded-lg bg-neutral-950 p-4">
              <pre ref={resultRef} className="text-sm text-neutral-100 font-mono whitespace-pre-wrap">
                {result}
              </pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}