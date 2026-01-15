import { loadConfig } from "../../config/index.js";
import {
  createGitHubClient,
  parseRepoString,
  inferRepoFromGit,
  inferPrFromBranch,
} from "../../github/index.js";
import { runSingleCycle, type LoopContext } from "../../core/loop.js";
import { logger } from "../../utils/logger.js";
import type { CycleResult } from "../../types/index.js";

export type RunOptions = {
  pr?: number;
  repo?: string;
  configPath?: string;
};

export const runCommand = async (
  cwd: string = process.cwd(),
  options: RunOptions = {}
): Promise<CycleResult> => {
  const { pr: prOption, repo: repoOption, configPath } = options;

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

  logger.info(`Running single cycle for ${owner}/${repo}#${prNumber}`);

  const ctx: LoopContext = {
    octokit,
    config,
    owner,
    repo,
    prNumber,
    cwd,
  };

  const result = await runSingleCycle(ctx);

  // Print result summary
  switch (result.status) {
    case "complete":
      logger.success("All Bugbot comments resolved!");
      break;
    case "pushed":
      logger.success(
        `Fixed ${
          result.fixedCount
        } comment(s), pushed commit ${result.commitSha?.slice(0, 7)}`
      );
      break;
    case "stopped":
      logger.warn(`Stopped: ${result.reason}`);
      break;
    case "failed":
      logger.error(`Failed: ${result.reason}`);
      break;
  }

  return result;
};
