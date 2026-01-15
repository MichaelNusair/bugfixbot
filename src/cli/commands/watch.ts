import { loadConfig } from "../../config/index.js";
import {
  createGitHubClient,
  parseRepoString,
  inferRepoFromGit,
  inferPrFromBranch,
} from "../../github/index.js";
import { runLoop, type LoopContext } from "../../core/loop.js";
import { logger } from "../../utils/logger.js";
import type { CycleResult } from "../../types/index.js";

export type WatchCommandOptions = {
  pr?: number;
  repo?: string;
  configPath?: string;
  maxCycles?: number;
  pollInterval?: number;
  wait?: boolean;
};

export const watchCommand = async (
  cwd: string = process.cwd(),
  options: WatchCommandOptions = {}
): Promise<CycleResult> => {
  const {
    pr: prOption,
    repo: repoOption,
    configPath,
    maxCycles,
    pollInterval,
    wait = true,
  } = options;

  // Load config
  const config = loadConfig({ configPath, cwd });

  // Resolve GitHub auth
  const octokit = createGitHubClient({
    auth: config.github.auth,
    token: config.github.token,
  });

  // Resolve repo
  let owner: string;
  let repo: string;

  if (repoOption) {
    const parsed = parseRepoString(repoOption);
    owner = parsed.owner;
    repo = parsed.repo;
  } else if (config.github.repo) {
    const parsed = parseRepoString(config.github.repo);
    owner = parsed.owner;
    repo = parsed.repo;
  } else {
    const inferred = inferRepoFromGit();
    if (!inferred) {
      logger.error(
        "Could not determine repository. Use --repo owner/repo or set github.repo in config"
      );
      return { status: "failed", reason: "Could not determine repository" };
    }
    owner = inferred.owner;
    repo = inferred.repo;
    logger.info(`Detected repo: ${owner}/${repo}`);
  }

  // Resolve PR number
  let prNumber: number;

  if (prOption) {
    prNumber = prOption;
  } else if (config.github.pr) {
    prNumber = config.github.pr;
  } else {
    const inferred = await inferPrFromBranch(octokit, owner, repo);
    if (!inferred) {
      logger.error(
        "Could not determine PR number. Use --pr <number> or set github.pr in config"
      );
      return { status: "failed", reason: "Could not determine PR number" };
    }
    prNumber = inferred;
    logger.info(`Detected PR: #${prNumber}`);
  }

  logger.info(`Starting watch mode for ${owner}/${repo}#${prNumber}`);
  logger.info(`Max cycles: ${maxCycles ?? config.guardrails.maxCycles}`);
  logger.info(
    `Poll interval: ${
      (pollInterval ?? config.guardrails.pollIntervalMs) / 1000
    }s`
  );
  if (!wait) {
    logger.info("No-wait mode: will exit when no comments found");
  }
  logger.info("");

  const ctx: LoopContext = {
    octokit,
    config,
    owner,
    repo,
    prNumber,
    cwd,
  };

  const result = await runLoop(ctx, {
    maxCycles: maxCycles ?? config.guardrails.maxCycles,
    pollIntervalMs: pollInterval ?? config.guardrails.pollIntervalMs,
    waitForComments: wait,
    onCycleComplete: (cycleResult, cycleNumber) => {
      logger.info(
        `--- Cycle ${cycleNumber} complete: ${cycleResult.status} ---`
      );
    },
  });

  // Print final result
  logger.info("");
  switch (result.status) {
    case "complete":
      logger.success("Watch complete - all Bugbot comments resolved!");
      break;
    case "stopped":
      logger.warn(`Watch stopped: ${result.reason}`);
      break;
    case "failed":
      logger.error(`Watch failed: ${result.reason}`);
      break;
    default:
      logger.info(`Watch ended with status: ${result.status}`);
  }

  return result;
};
