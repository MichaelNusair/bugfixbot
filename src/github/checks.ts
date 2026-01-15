import type { Octokit } from "@octokit/rest";
import { logger } from "../utils/logger.js";
import type { ReviewerConfig } from "../types/index.js";

export type CheckStatus = "pending" | "in_progress" | "completed" | "unknown";

export type BugbotCheckResult = {
  status: CheckStatus;
  conclusion: string | null;
  checkName: string | null;
};

export type ReviewerCheckResult = {
  name: string;
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

const patternsToRegExp = (patterns: string[]): RegExp[] => {
  return patterns.map((p) => new RegExp(p, "i"));
};

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

export const getReviewerCheckStatus = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  reviewer: ReviewerConfig
): Promise<ReviewerCheckResult> => {
  try {
    const { data } = await octokit.checks.listForRef({
      owner,
      repo,
      ref,
      per_page: 100,
    });

    const patterns = patternsToRegExp(reviewer.checkPatterns);

    for (const check of data.check_runs) {
      const isMatch = patterns.some((pattern) => pattern.test(check.name));

      if (isMatch) {
        logger.debug(
          `Found ${reviewer.name} check: ${check.name} - ${check.status}`
        );
        return {
          name: reviewer.name,
          status: check.status as CheckStatus,
          conclusion: check.conclusion,
          checkName: check.name,
        };
      }
    }

    return {
      name: reviewer.name,
      status: "unknown",
      conclusion: null,
      checkName: null,
    };
  } catch (error) {
    logger.debug(`Could not fetch ${reviewer.name} check status:`, error);
    return {
      name: reviewer.name,
      status: "unknown",
      conclusion: null,
      checkName: null,
    };
  }
};

export const areAllReviewersComplete = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  reviewers: ReviewerConfig[]
): Promise<{ allComplete: boolean; pending: string[] }> => {
  const results = await Promise.all(
    reviewers.map((r) => getReviewerCheckStatus(octokit, owner, repo, ref, r))
  );

  const pending = results
    .filter((r) => r.status === "pending" || r.status === "in_progress")
    .map((r) => r.name);

  // If status is "unknown", we consider it complete (check might not exist)
  return { allComplete: pending.length === 0, pending };
};
