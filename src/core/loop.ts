import type { Octokit } from "@octokit/rest";
import type { Config, CycleResult, FixTask } from "../types/index.js";
import { fetchAllBugbotComments } from "../github/comments.js";
import {
  normalizeComments,
  countAffectedLines,
  groupTasksByFile,
} from "../github/normalizer.js";
import { isBugbotStillReviewing } from "../github/checks.js";
import { createEngine } from "../engines/index.js";
import { runVerification } from "./verification.js";
import { createGitManager, commitAndPush } from "./git.js";
import { createStateStore, type StateStore } from "./state.js";
import { logger } from "../utils/logger.js";

export type LoopContext = {
  octokit: Octokit;
  config: Config;
  owner: string;
  repo: string;
  prNumber: number;
  cwd: string;
};

export type CycleContext = LoopContext & {
  stateStore: StateStore;
};

const checkGuardrails = (
  tasks: FixTask[],
  config: Config
): { passed: boolean; reason?: string } => {
  const { guardrails } = config;

  const groupedByFile = groupTasksByFile(tasks);
  const filesCount = groupedByFile.size;
  const linesCount = countAffectedLines(tasks);

  if (filesCount > guardrails.maxFilesPerCycle) {
    return {
      passed: false,
      reason: `Changes affect ${filesCount} files, exceeds max of ${guardrails.maxFilesPerCycle}`,
    };
  }

  if (linesCount > guardrails.maxLinesPerCycle) {
    return {
      passed: false,
      reason: `Changes affect ${linesCount} lines, exceeds max of ${guardrails.maxLinesPerCycle}`,
    };
  }

  return { passed: true };
};

export const runCycle = async (ctx: CycleContext): Promise<CycleResult> => {
  const { octokit, config, owner, repo, prNumber, cwd, stateStore } = ctx;

  const state = stateStore.getState();
  const cycleNumber = stateStore.incrementCycle();

  logger.info(`Starting cycle ${cycleNumber} for PR #${prNumber}`);

  // 1. Fetch Bugbot comments
  logger.step("Fetching Bugbot comments...");
  const comments = await fetchAllBugbotComments(octokit, {
    owner,
    repo,
    prNumber,
    botAuthors: config.github.botAuthors,
  });

  logger.info(`Found ${comments.length} total Bugbot comment(s)`);

  // 2. Normalize to actionable fix tasks
  const tasks = normalizeComments(comments, state);

  if (tasks.length === 0) {
    logger.success("No actionable comments remaining - all done!");
    return { status: "complete", reason: "No actionable comments" };
  }

  logger.info(`${tasks.length} actionable comment(s) to fix`);

  // 3. Check guardrails
  const guardrailCheck = checkGuardrails(tasks, config);
  if (!guardrailCheck.passed) {
    logger.warn(`Guardrail triggered: ${guardrailCheck.reason}`);
    return {
      status: "stopped",
      reason: guardrailCheck.reason,
    };
  }

  // 4. Apply fixes using configured engine
  const engine = createEngine(config.fix.engine, cwd);
  logger.step(`Applying fixes with ${engine.name}...`);

  const engineResult = await engine.applyFixes(tasks, config.fix);

  if (!engineResult.success) {
    logger.error("Engine failed to apply fixes");
    return {
      status: "failed",
      reason: engineResult.error ?? "Engine failed",
    };
  }

  if (engineResult.filesChanged.length === 0) {
    logger.warn("No files changed after applying fixes");
    return {
      status: "stopped",
      reason: "No changes generated",
    };
  }

  // 5. Run verification
  logger.step("Running verification...");
  const verifyResult = await runVerification(config.verification, cwd);

  if (!verifyResult.passed) {
    logger.error(`Verification failed: ${verifyResult.failedCommand}`);
    return {
      status: "failed",
      reason: `Verification failed: ${verifyResult.failedCommand}`,
    };
  }

  // 6. Commit and push
  const gitManager = createGitManager({ cwd });
  const commitSha = await commitAndPush(gitManager, config.git, cycleNumber);

  // 7. Mark tasks as handled
  stateStore.markHandled(tasks, commitSha);

  logger.success(
    `Cycle ${cycleNumber} complete - pushed ${commitSha.slice(0, 7)}`
  );

  return {
    status: "pushed",
    commitSha,
    fixedCount: tasks.length,
  };
};

export type WatchOptions = {
  maxCycles?: number;
  pollIntervalMs?: number;
  waitForComments?: boolean;
  onCycleComplete?: (result: CycleResult, cycleNumber: number) => void;
};

export const runLoop = async (
  ctx: LoopContext,
  options: WatchOptions = {}
): Promise<CycleResult> => {
  const { config, prNumber, cwd } = ctx;
  const {
    maxCycles = config.guardrails.maxCycles,
    pollIntervalMs = config.guardrails.pollIntervalMs,
    waitForComments = false,
    onCycleComplete,
  } = options;

  const stateStore = createStateStore(cwd, prNumber);
  const cycleCtx: CycleContext = { ...ctx, stateStore };

  // Pre-flight checks
  const gitManager = createGitManager({ cwd });

  logger.step("Pre-flight checks...");

  const isClean = await gitManager.ensureCleanState();
  if (!isClean) {
    return {
      status: "failed",
      reason: "Working tree is not clean",
    };
  }

  const isUpToDate = await gitManager.ensureUpToDate(config.git.autoRebase);
  if (!isUpToDate) {
    return {
      status: "failed",
      reason: "Branch is behind remote",
    };
  }

  logger.success("Pre-flight checks passed");

  let consecutiveEmptyCycles = 0;
  let cycleCount = 0;

  while (cycleCount < maxCycles) {
    const result = await runCycle(cycleCtx);
    cycleCount++;

    onCycleComplete?.(result, cycleCount);

    if (result.status === "complete") {
      if (waitForComments) {
        // Check if Bugbot is still reviewing
        const headSha = await gitManager.getHead();
        const stillReviewing = await isBugbotStillReviewing(
          ctx.octokit,
          ctx.owner,
          ctx.repo,
          headSha
        );

        if (stillReviewing) {
          // Bugbot still reviewing - keep polling
          logger.info(
            `Bugbot still reviewing, waiting... (${pollIntervalMs / 1000}s)`
          );
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          // Don't count waiting cycles toward maxCycles
          cycleCount--;
          continue;
        }

        // Bugbot finished reviewing with 0 comments - done!
        logger.success("Bugbot review complete - no issues found!");
        return result;
      }
      logger.success("All comments resolved!");
      return result;
    }

    if (result.status === "failed" || result.status === "stopped") {
      return result;
    }

    // Check for no-progress loops
    if (result.fixedCount === 0) {
      consecutiveEmptyCycles++;
      if (consecutiveEmptyCycles >= 2) {
        logger.warn("No progress made in 2 consecutive cycles, stopping");
        return {
          status: "stopped",
          reason: "No progress detected",
        };
      }
    } else {
      consecutiveEmptyCycles = 0;
    }

    // Wait before next cycle
    if (cycleCount < maxCycles) {
      logger.info(`Waiting ${pollIntervalMs / 1000}s before next cycle...`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  logger.warn(`Reached max cycles (${maxCycles})`);
  return {
    status: "stopped",
    reason: `Reached max cycles: ${maxCycles}`,
  };
};

export const runSingleCycle = async (
  ctx: LoopContext
): Promise<CycleResult> => {
  const { prNumber, cwd } = ctx;
  const stateStore = createStateStore(cwd, prNumber);
  const cycleCtx: CycleContext = { ...ctx, stateStore };

  // Pre-flight checks
  const gitManager = createGitManager({ cwd });

  const isClean = await gitManager.ensureCleanState();
  if (!isClean) {
    return {
      status: "failed",
      reason: "Working tree is not clean",
    };
  }

  return runCycle(cycleCtx);
};
