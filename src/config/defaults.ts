import type { Config } from "../types/index.js";

export const DEFAULT_BOT_AUTHORS = ["cursor-bot", "bugbot", "cursor[bot]"];

export const DEFAULT_COMMIT_TEMPLATE =
  "chore(bugbot): fix review findings [cycle {cycle}]";

export const DEFAULT_CONFIG: Config = {
  github: {
    auth: "env",
    botAuthors: DEFAULT_BOT_AUTHORS,
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
