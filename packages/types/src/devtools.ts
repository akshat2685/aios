export interface CodeAnalysis {
  filePath: string;
  language: string;
  symbols: Array<{
    name: string;
    type: 'function' | 'class' | 'variable' | 'interface';
    line: number;
    column: number;
    signature?: string;
    docstring?: string;
  }>;
  dependencies: string[];
}

export interface GitAnalysis {
  currentBranch: string;
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    date: number;
  };
  changedFiles: string[];
  diff: string;
}

export interface TerminalSession {
  sessionId: string;
  startTime: number;
  commands: Array<{
    command: string;
    output: string;
    exitCode: number;
    timestamp: number;
  }>;
}