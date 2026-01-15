import type { Octokit } from "@octokit/rest";
import type { PRComment, FixTask } from "../types/index.js";
import { logger } from "../utils/logger.js";

export type FetchCommentsOptions = {
  owner: string;
  repo: string;
  prNumber: number;
  botAuthors: string[];
  since?: string;
};

export const fetchPRReviewComments = async (
  octokit: Octokit,
  options: FetchCommentsOptions
): Promise<PRComment[]> => {
  const { owner, repo, prNumber, botAuthors, since } = options;

  const comments: PRComment[] = [];

  // Fetch review comments (inline comments on diff)
  const reviewComments = await octokit.paginate(
    octokit.pulls.listReviewComments,
    {
      owner,
      repo,
      pull_number: prNumber,
      since,
      per_page: 100,
    }
  );

  for (const comment of reviewComments) {
    if (!botAuthors.includes(comment.user?.login ?? "")) {
      continue;
    }

    // Skip replies - only process thread starters
    if (comment.in_reply_to_id) {
      continue;
    }

    comments.push({
      id: comment.id,
      nodeId: comment.node_id,
      userId: comment.user?.id ?? 0,
      userLogin: comment.user?.login ?? "",
      body: comment.body,
      path: comment.path,
      line: comment.line ?? comment.original_line ?? null,
      side: (comment.side as "LEFT" | "RIGHT") ?? null,
      commitId: comment.commit_id,
      diffHunk: comment.diff_hunk ?? null,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      position: comment.position ?? null,
      isResolved: false, // Will be updated via GraphQL check
    });
  }

  return comments;
};

export const fetchIssueComments = async (
  octokit: Octokit,
  options: FetchCommentsOptions
): Promise<PRComment[]> => {
  const { owner, repo, prNumber, botAuthors, since } = options;

  const comments: PRComment[] = [];

  // Fetch issue-style comments (general PR comments)
  const issueComments = await octokit.paginate(octokit.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    since,
    per_page: 100,
  });

  for (const comment of issueComments) {
    if (!botAuthors.includes(comment.user?.login ?? "")) {
      continue;
    }

    comments.push({
      id: comment.id,
      nodeId: comment.node_id,
      userId: comment.user?.id ?? 0,
      userLogin: comment.user?.login ?? "",
      body: comment.body ?? "",
      path: null,
      line: null,
      side: null,
      commitId: null,
      diffHunk: null,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      position: null,
      isResolved: false, // Issue comments don't have resolution
    });
  }

  return comments;
};

export const fetchAllBugbotComments = async (
  octokit: Octokit,
  options: FetchCommentsOptions
): Promise<PRComment[]> => {
  const { owner, repo, prNumber } = options;

  const [reviewComments, issueComments, resolvedIds] = await Promise.all([
    fetchPRReviewComments(octokit, options),
    fetchIssueComments(octokit, options),
    fetchResolvedCommentIds(octokit, owner, repo, prNumber),
  ]);

  // Mark resolved comments and filter them out
  const allComments = [...reviewComments, ...issueComments];
  let resolvedCount = 0;

  for (const comment of allComments) {
    if (resolvedIds.has(comment.id)) {
      comment.isResolved = true;
      resolvedCount++;
    }
  }

  if (resolvedCount > 0) {
    logger.info(`Skipping ${resolvedCount} already-resolved comment(s)`);
  }

  // Filter out resolved comments and sort by creation date, oldest first
  return allComments
    .filter((c) => !c.isResolved)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
};

// GraphQL query to get the thread ID for a comment
const GET_THREAD_ID_QUERY = `
  query GetThreadId($nodeId: ID!) {
    node(id: $nodeId) {
      ... on PullRequestReviewComment {
        pullRequestReviewThread {
          id
          isResolved
        }
      }
    }
  }
`;

// GraphQL query to get resolution status for multiple comments
const GET_THREAD_STATUSES_QUERY = `
  query GetThreadStatuses($owner: String!, $repo: String!, $prNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 1) {
              nodes {
                id
                databaseId
              }
            }
          }
        }
      }
    }
  }
`;

// GraphQL mutation to resolve a review thread
const RESOLVE_THREAD_MUTATION = `
  mutation ResolveThread($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
      }
    }
  }
`;

type ThreadInfo = {
  id: string;
  isResolved: boolean;
};

type ThreadStatusResponse = {
  repository: {
    pullRequest: {
      reviewThreads: {
        nodes: Array<{
          id: string;
          isResolved: boolean;
          comments: {
            nodes: Array<{
              id: string;
              databaseId: number;
            }>;
          };
        }>;
      };
    };
  };
};

export const fetchResolvedCommentIds = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<Set<number>> => {
  const resolvedIds = new Set<number>();

  try {
    const response = await octokit.graphql<ThreadStatusResponse>(
      GET_THREAD_STATUSES_QUERY,
      { owner, repo, prNumber }
    );

    const threads = response.repository.pullRequest.reviewThreads.nodes;

    for (const thread of threads) {
      if (thread.isResolved && thread.comments.nodes.length > 0) {
        // The first comment in a thread is the thread starter
        const firstComment = thread.comments.nodes[0];
        resolvedIds.add(firstComment.databaseId);
      }
    }

    if (resolvedIds.size > 0) {
      logger.debug(`Found ${resolvedIds.size} resolved comment thread(s)`);
    }
  } catch (error) {
    logger.warn("Failed to fetch resolved comment IDs via GraphQL:", error);
  }

  return resolvedIds;
};

const getThreadIdForComment = async (
  octokit: Octokit,
  commentNodeId: string
): Promise<ThreadInfo | null> => {
  try {
    const response = await octokit.graphql<{
      node: {
        pullRequestReviewThread?: ThreadInfo;
      } | null;
    }>(GET_THREAD_ID_QUERY, { nodeId: commentNodeId });

    return response.node?.pullRequestReviewThread ?? null;
  } catch (error) {
    logger.debug(
      `Failed to get thread ID for comment ${commentNodeId}:`,
      error
    );
    return null;
  }
};

export const resolveReviewThreads = async (
  octokit: Octokit,
  tasks: FixTask[]
): Promise<{ resolved: number; failed: number }> => {
  let resolved = 0;
  let failed = 0;

  for (const task of tasks) {
    // Skip issue comments (no path means it's not a review comment)
    if (!task.filePath) {
      continue;
    }

    try {
      // Get the thread ID for this comment
      const threadInfo = await getThreadIdForComment(octokit, task.nodeId);

      if (!threadInfo) {
        logger.debug(`No thread found for comment ${task.commentId}`);
        continue;
      }

      if (threadInfo.isResolved) {
        logger.debug(`Thread for comment ${task.commentId} already resolved`);
        resolved++;
        continue;
      }

      // Resolve the thread
      await octokit.graphql(RESOLVE_THREAD_MUTATION, {
        threadId: threadInfo.id,
      });

      logger.debug(`Resolved thread for comment ${task.commentId}`);
      resolved++;
    } catch (error) {
      logger.debug(
        `Failed to resolve thread for comment ${task.commentId}:`,
        error
      );
      failed++;
    }
  }

  return { resolved, failed };
};
