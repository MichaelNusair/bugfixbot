import type { FixTask, EngineResult, FixConfig } from "../types/index.js";

export type FixEngine = {
  name: string;
  applyFixes: (tasks: FixTask[], config: FixConfig) => Promise<EngineResult>;
};

export type PromptContext = {
  tasks: FixTask[];
  instructions?: string;
  maxTokens?: number;
  rulesContext?: string;
};
