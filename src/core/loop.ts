import type { Octokit } from "@octokit/rest";
import type { Config, CycleResult, FixTask } from "../types/index.js";
import {
  fetchAllBugbotComments,
  postPRComment,
  replyToReviewComment,
} from "../github/comments.js";
import {
  normalizeComments,
  countAffectedLines,
  groupTasksByFile,
} from "../github/normalizer.js";
import { areAllReviewersComplete } from "../github/checks.js";
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

  // 1. Fetch comments from all reviewers
  logger.step("Fetching reviewer comments...");

  // Collect bot authors from all reviewers + legacy botAuthors config
  const allBotAuthors = [
    ...new Set([
      ...config.github.botAuthors,
      ...config.github.reviewers.flatMap((r) => r.botAuthors),
    ]),
  ];

  const comments = await fetchAllBugbotComments(octokit, {
    owner,
    repo,
    prNumber,
    botAuthors: allBotAuthors,
  });

  logger.info(`Found ${comments.length} total reviewer comment(s)`);

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
    logger.info("No files changed - issues may already be fixed");

    // Reply to comments acknowledging they were checked
    logger.step("Replying to already-fixed comments...");
    let repliedCount;
    const replyPromises = tasks.map(async (task) => {
      try {
        await replyToReviewComment(
          octokit,
          owner,
          repo,
          prNumber,
          task.commentId,
          `Verified - this issue appears to be already addressed in the current code.`
        );
        repliedCount++;
      } catch (error) {
        // Not all comments support replies (e.g., issue comments)
        logger.debug(`Could not reply to comment ${task.commentId}:`, error);
      }
    });
    await Promise.all(replyPromises);
    logger.info(`Successfully replied to ${repliedCount} comments`);

    // Mark as handled so we don't process them again
    stateStore.markHandled(tasks, "already-fixed");

    logger.success(`Acknowledged ${tasks.length} already-fixed comment(s)`);
    return {
      status: "complete",
      reason: "Issues already fixed, replies posted",
      fixedCount: tasks.length,
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

  // 7. Reply in-thread to addressed comments
  logger.step("Replying to addressed comments...");
  const replyPromises = tasks.map(async (task) => {
    try {
      await replyToReviewComment(
        octokit,
        owner,
        repo,
        prNumber,
        task.commentId,
        `Fixed in ${commitSha.slice(0, 7)}`
      );
    } catch (error) {
      // Not all comments support replies (e.g., issue comments)
      logger.debug(`Could not reply to comment ${task.commentId}:`, error);
    }
  });
  await Promise.all(replyPromises);

  // 8. Post trigger comments for reviewers
  for (const reviewer of config.github.reviewers) {
    if (reviewer.triggerComment) {
      logger.step(`Triggering ${reviewer.name}...`);
      await postPRComment(
        octokit,
        owner,
        repo,
        prNumber,
        reviewer.triggerComment
      );
    }
  }

  // 9. Post status comment with details
  const filesChanged = engineResult.filesChanged;
  const statusMessage = [
    `**Bugfixbot Cycle ${cycleNumber} Complete**`,
    ``,
    `- Commit: \`${commitSha.slice(0, 7)}\``,
    `- Comments addressed: ${tasks.length}`,
    `- Files changed: ${filesChanged.length}`,
    ``,
    `Waiting for reviewers...`,
  ].join("\n");

  await postPRComment(octokit, owner, repo, prNumber, statusMessage);

  // 10. Mark tasks as handled
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

  const { backoffMultiplier } = config.guardrails;
  const MAX_POLL_INTERVAL = 300000; // 5 minutes max

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
  let currentPollInterval = pollIntervalMs;

  while (cycleCount < maxCycles) {
    const result = await runCycle(cycleCtx);
    cycleCount++;

    onCycleComplete?.(result, cycleCount);

    if (result.status === "complete") {
      if (waitForComments) {
        // Check if all reviewers are done
        const headSha = await gitManager.getHead();
        const { allComplete, pending } = await areAllReviewersComplete(
          ctx.octokit,
          ctx.owner,
          ctx.repo,
          headSha,
          config.github.reviewers
        );

        if (!allComplete) {
          // Some reviewers still reviewing - keep polling with exponential backoff
          logger.info(
            `Waiting for: ${pending.join(", ")} (${currentPollInterval / 1000}s)`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, currentPollInterval)
          );
          // Apply exponential backoff, capped at MAX_POLL_INTERVAL
          currentPollInterval = Math.min(
            currentPollInterval * backoffMultiplier,
            MAX_POLL_INTERVAL
          );
          // Don't count waiting cycles toward maxCycles
          cycleCount--;
          continue;
        }

        // All reviewers finished with 0 comments - done!
        logger.success("All reviews complete - no issues found!");
        await postPRComment(
          ctx.octokit,
          ctx.owner,
          ctx.repo,
          prNumber,
          `✅ Bugfixbot complete! All review comments have been addressed across ${cycleCount} cycle(s).`
        );
        return result;
      }
      logger.success("All comments resolved!");
      await postPRComment(
        ctx.octokit,
        ctx.owner,
        ctx.repo,
        prNumber,
        `✅ Bugfixbot complete! All review comments have been addressed across ${cycleCount} cycle(s).`
      );
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
      // Reset backoff after successful progress
      currentPollInterval = pollIntervalMs;
    }

    // Wait before next cycle (using current backoff interval)
    if (cycleCount < maxCycles) {
      logger.info(
        `Waiting ${currentPollInterval / 1000}s before next cycle...`
      );
      await new Promise((resolve) => setTimeout(resolve, currentPollInterval));
      // Apply backoff for next wait
      currentPollInterval = Math.min(
        currentPollInterval * backoffMultiplier,
        MAX_POLL_INTERVAL
      );
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
