// Core exports
export { runCycle, runLoop, runSingleCycle, type LoopContext, type CycleContext, type WatchOptions } from './core/index.js';
export { runVerification, formatVerificationSummary, type VerificationRunResult } from './core/verification.js';
export { createGitManager, commitAndPush, type GitManager, type GitManagerOptions } from './core/git.js';
export { createStateStore, stateExists, clearState, type StateStore } from './core/state.js';

// Config exports
export { loadConfig, validateConfig, configExists, getConfigPath, type LoadConfigOptions } from './config/index.js';
export { ConfigSchema, type ParsedConfig } from './config/schema.js';
export { DEFAULT_CONFIG, DEFAULT_BOT_AUTHORS, DEFAULT_COMMIT_TEMPLATE } from './config/defaults.js';

// GitHub exports
export {
  createGitHubClient,
  parseRepoString,
  inferRepoFromGit,
  inferPrFromBranch,
  type GitHubClientOptions,
} from './github/client.js';
export {
  fetchPRReviewComments,
  fetchIssueComments,
  fetchAllBugbotComments,
  type FetchCommentsOptions,
} from './github/comments.js';
export { normalizeComments, groupTasksByFile, countAffectedLines } from './github/normalizer.js';

// Engine exports
export { createEngine, createCursorCliEngine, createCursorCommandEngine } from './engines/index.js';
export { buildPrompt, buildCompactPrompt, estimateTokens } from './engines/prompt-builder.js';
export type { FixEngine, PromptContext } from './engines/types.js';

// Type exports
export type {
  AuthMethod,
  FixEngine as FixEngineType,
  CycleStatus,
  FixTask,
  HandledComment,
  State,
  CycleResult,
  VerificationResult,
  EngineResult,
  GitHubConfig,
  FixConfig,
  VerificationConfig,
  GuardrailsConfig,
  GitConfig,
  Config,
  PRComment,
} from './types/index.js';

// CLI exports (for programmatic usage)
export { cli, run } from './cli/index.js';
