export type AuthMethod = "gh" | "token" | "env";

export type FixEngine = "cursor-cli" | "cursor-command";

export type CycleStatus = "complete" | "pushed" | "failed" | "stopped";

export type FixTask = {
  id: number;
  commentId: number;
  nodeId: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  side: "LEFT" | "RIGHT";
  body: string;
  diffHunk: string | null;
  commitId: string | null;
  createdAt: string;
};

export type HandledComment = {
  sha: string;
  handledAt: string;
};

export type State = {
  prNumber: number;
  cycleCount: number;
  lastPushedSha: string | null;
  handledComments: Record<string, HandledComment>;
  startedAt: string;
};

export type CycleResult = {
  status: CycleStatus;
  reason?: string;
  commitSha?: string;
  fixedCount?: number;
  error?: Error;
};

export type VerificationResult = {
  passed: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type EngineResult = {
  success: boolean;
  filesChanged: string[];
  error?: string;
};

export type GitHubConfig = {
  repo?: string;
  pr?: number;
  auth: AuthMethod;
  token?: string;
  botAuthors: string[];
};

export type FixConfig = {
  engine: FixEngine;
  command?: string;
  instructions?: string;
};

export type VerificationConfig = {
  commands: string[];
  timeout: number;
  stopOnFailure: boolean;
};

export type GuardrailsConfig = {
  maxCycles: number;
  maxFilesPerCycle: number;
  maxLinesPerCycle: number;
  requireApprovalAbove: number;
  pollIntervalMs: number;
  backoffMultiplier: number;
};

export type GitConfig = {
  commitTemplate: string;
  autoRebase: boolean;
  pushForce: boolean;
};

export type Config = {
  github: GitHubConfig;
  fix: FixConfig;
  verification: VerificationConfig;
  guardrails: GuardrailsConfig;
  git: GitConfig;
};

export type PRComment = {
  id: number;
  nodeId: string;
  userId: number;
  userLogin: string;
  body: string;
  path: string | null;
  line: number | null;
  side: "LEFT" | "RIGHT" | null;
  commitId: string | null;
  diffHunk: string | null;
  createdAt: string;
  updatedAt: string;
  position: number | null;
  isResolved: boolean;
};
