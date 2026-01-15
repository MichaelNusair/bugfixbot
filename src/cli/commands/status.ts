import { loadConfig, configExists } from "../../config/index.js";
import {
  createGitHubClient,
  parseRepoString,
  inferRepoFromGit,
  inferPrFromBranch,
} from "../../github/index.js";
import { fetchAllBugbotComments } from "../../github/comments.js";
import { normalizeComments } from "../../github/normalizer.js";
import { stateExists, createStateStore } from "../../core/state.js";
import { logger } from "../../utils/logger.js";

export type StatusOptions = {
  pr?: number;
  repo?: string;
  configPath?: string;
};

export const statusCommand = async (
  cwd: string = process.cwd(),
  options: StatusOptions = {}
): Promise<void> => {
  const { pr: prOption, repo: repoOption, configPath } = options;

  // Check if config exists
  if (!configExists(cwd)) {
    logger.warn('No bugfixbot.yml found. Run "bugfixbot init" first.');
    return;
  }

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
      logger.error("Could not determine repository. Use --repo owner/repo");
      return;
    }
    owner = inferred.owner;
    repo = inferred.repo;
  }

  // Resolve PR number
  let prNumber: number | null = null;

  if (prOption) {
    prNumber = prOption;
  } else if (config.github.pr) {
    prNumber = config.github.pr;
  } else {
    prNumber = await inferPrFromBranch(octokit, owner, repo);
  }

  console.log("");
  console.log("Bugfixbot Status");
  console.log("================");
  console.log("");
  console.log(`Repository: ${owner}/${repo}`);
  console.log(`PR: ${prNumber ? `#${prNumber}` : "(not detected)"}`);
  console.log("");

  // Check state
  if (stateExists(cwd) && prNumber) {
    const stateStore = createStateStore(cwd, prNumber);
    const state = stateStore.getState();

    console.log("Session State:");
    console.log(`  Cycles completed: ${state.cycleCount}`);
    console.log(
      `  Comments handled: ${Object.keys(state.handledComments).length}`
    );
    console.log(
      `  Last pushed SHA: ${state.lastPushedSha?.slice(0, 7) ?? "(none)"}`
    );
    console.log(`  Started at: ${state.startedAt}`);
    console.log("");
  } else {
    console.log("Session State: (no active session)");
    console.log("");
  }

  // Fetch current comments
  if (prNumber) {
    logger.step("Fetching Bugbot comments...");

    const comments = await fetchAllBugbotComments(octokit, {
      owner,
      repo,
      prNumber,
      botAuthors: config.github.botAuthors,
    });

    const stateStore = createStateStore(cwd, prNumber);
    const state = stateStore.getState();
    const actionable = normalizeComments(comments, state);

    console.log("");
    console.log("Comments:");
    console.log(`  Total Bugbot comments: ${comments.length}`);
    console.log(`  Actionable (unhandled): ${actionable.length}`);
    console.log("");

    if (actionable.length > 0) {
      console.log("Pending fixes:");
      for (const task of actionable.slice(0, 10)) {
        const location = task.filePath
          ? `${task.filePath}:${task.lineStart}`
          : "(general)";
        const preview = task.body.split("\n")[0].slice(0, 60);
        console.log(`  - [${location}] ${preview}...`);
      }
      if (actionable.length > 10) {
        console.log(`  ... and ${actionable.length - 10} more`);
      }
      console.log("");
    }

    if (actionable.length === 0 && comments.length > 0) {
      logger.success("All Bugbot comments have been handled!");
    } else if (actionable.length > 0) {
      logger.info(
        `Run "bugfixbot run --pr ${prNumber}" to fix pending comments`
      );
    }
  }
};
