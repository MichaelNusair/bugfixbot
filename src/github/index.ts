export {
  createGitHubClient,
  parseRepoString,
  inferRepoFromGit,
  inferPrFromBranch,
  type GitHubClientOptions,
} from './client.js';

export {
  fetchPRReviewComments,
  fetchIssueComments,
  fetchAllBugbotComments,
  type FetchCommentsOptions,
} from './comments.js';

export {
  normalizeComments,
  groupTasksByFile,
  countAffectedLines,
  createCommentKey,
} from './normalizer.js';
