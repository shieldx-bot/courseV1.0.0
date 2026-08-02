export interface IDEFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isReadOnly?: boolean;
  isDirectory?: boolean;
  children?: IDEFile[];
}

export interface IDEProject {
  id: string;
  name: string;
  files: IDEFile[];
  language: string;
}

export interface EditorTab {
  id: string;
  fileId: string;
  name: string;
  language: string;
  isDirty: boolean;
}

export interface TerminalLine {
  id: string;
  type: "command" | "output" | "error" | "system";
  content: string;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export type TerminalSize = "collapsed" | "small" | "medium" | "large";

export type ProjectLanguage = "python" | "javascript";
