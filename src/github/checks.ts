import type { Octokit } from "@octokit/rest";
import { logger } from "../utils/logger.js";

export type CheckStatus = "pending" | "in_progress" | "completed" | "unknown";

export type BugbotCheckResult = {
  status: CheckStatus;
  conclusion: string | null;
  checkName: string | null;
};

const BUGBOT_CHECK_PATTERNS = [
  /bugbot/i,
  /cursor.*review/i,
  /cursor.*bot/i,
  /code.*review.*bot/i,
];

export const getBugbotCheckStatus = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<BugbotCheckResult> => {
  try {
    const { data } = await octokit.checks.listForRef({
      owner,
      repo,
      ref,
      per_page: 100,
    });

    // Find Bugbot-related check runs
    for (const check of data.check_runs) {
      const isMatch = BUGBOT_CHECK_PATTERNS.some((pattern) =>
        pattern.test(check.name)
      );

      if (isMatch) {
        logger.debug(`Found Bugbot check: ${check.name} - ${check.status}`);
        return {
          status: check.status as CheckStatus,
          conclusion: check.conclusion,
          checkName: check.name,
        };
      }
    }

    // No Bugbot check found - might not be configured
    return {
      status: "unknown",
      conclusion: null,
      checkName: null,
    };
  } catch (error) {
    logger.debug("Could not fetch check status:", error);
    return {
      status: "unknown",
      conclusion: null,
      checkName: null,
    };
  }
};

export const isBugbotStillReviewing = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<boolean> => {
  const result = await getBugbotCheckStatus(octokit, owner, repo, ref);

  // If we can't find Bugbot check, assume it might still be reviewing
  if (result.status === "unknown") {
    return true;
  }

  // Still reviewing if pending or in_progress
  return result.status === "pending" || result.status === "in_progress";
};
