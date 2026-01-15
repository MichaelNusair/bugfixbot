import type { Config, ReviewerConfig } from "../types/index.js";

export const DEFAULT_BOT_AUTHORS = ["cursor-bot", "bugbot", "cursor[bot]"];

export const DEFAULT_COMMIT_TEMPLATE =
  "chore(bugbot): fix review findings [cycle {cycle}]";

export const DEFAULT_REVIEWERS: ReviewerConfig[] = [
  {
    name: "Cursor Bugbot",
    checkPatterns: ["bugbot", "cursor.*review", "cursor.*bot"],
    botAuthors: ["cursor-bot", "bugbot", "cursor[bot]"],
  },
  {
    name: "Codex",
    checkPatterns: ["codex"],
    triggerComment: "@codex review",
    botAuthors: ["codex", "codex[bot]"],
  },
];

export const DEFAULT_CONFIG: Config = {
  github: {
    auth: "env",
    botAuthors: DEFAULT_BOT_AUTHORS,
    reviewers: DEFAULT_REVIEWERS,
  },
  fix: {
    engine: "cursor-cli",
  },
  verification: {
    commands: [],
    timeout: 300000,
    stopOnFailure: true,
  },
  guardrails: {
    maxCycles: 5,
    maxFilesPerCycle: 10,
    maxLinesPerCycle: 500,
    requireApprovalAbove: 10,
    pollIntervalMs: 30000,
    backoffMultiplier: 1.5,
  },
  git: {
    commitTemplate: DEFAULT_COMMIT_TEMPLATE,
    autoRebase: false,
    pushForce: false,
  },
};
