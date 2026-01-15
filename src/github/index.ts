export {
  createGitHubClient,
  parseRepoString,
  inferRepoFromGit,
  inferPrFromBranch,
  type GitHubClientOptions,
} from "./client.js";

export {
  fetchPRReviewComments,
  fetchIssueComments,
  fetchAllBugbotComments,
  postPRComment,
  replyToReviewComment,
  type FetchCommentsOptions,
} from "./comments.js";

export {
  normalizeComments,
  groupTasksByFile,
  countAffectedLines,
  createCommentKey,
} from "./normalizer.js";

export {
  getBugbotCheckStatus,
  isBugbotStillReviewing,
  getReviewerCheckStatus,
  areAllReviewersComplete,
  type CheckStatus,
  type BugbotCheckResult,
  type ReviewerCheckResult,
} from "./checks.js";
