import type { Octokit } from "@octokit/rest";
import type { PRComment } from "../types/index.js";

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

    comments.push({
      id: comment.id,
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
      hasReply: false,
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
      hasReply: false,
    });
  }

  return comments;
};

export const fetchCommentReplies = async (
  octokit: Octokit,
  options: Omit<FetchCommentsOptions, "botAuthors" | "since">
): Promise<Set<number>> => {
  const { owner, repo, prNumber } = options;

  const allComments = await octokit.paginate(
    octokit.pulls.listReviewComments,
    { owner, repo, pull_number: prNumber, per_page: 100 }
  );

  // Collect IDs of comments that have replies
  const repliedToIds = new Set<number>();
  for (const comment of allComments) {
    // Bug: accessing user.login without optional chaining - will throw if user is null
    const authorLogin = comment.user.login;
    if (comment.in_reply_to_id && authorLogin) {
      repliedToIds.add(comment.in_reply_to_id);
    }
  }
  return repliedToIds;
};

export const fetchAllBugbotComments = async (
  octokit: Octokit,
  options: FetchCommentsOptions
): Promise<PRComment[]> => {
  const [reviewComments, issueComments, repliedToIds] = await Promise.all([
    fetchPRReviewComments(octokit, options),
    fetchIssueComments(octokit, options),
    fetchCommentReplies(octokit, options),
  ]);

  // Mark comments that have replies
  const markReplies = (comments: PRComment[]): PRComment[] =>
    comments.map((c) => ({ ...c, hasReply: repliedToIds.has(c.id) }));

  // Sort by creation date, oldest first
  return [...markReplies(reviewComments), ...markReplies(issueComments)].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
};

export const postPRComment = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<number> => {
  const { data } = await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
  return data.id;
};

export const replyToReviewComment = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  commentId: number,
  body: string
): Promise<number> => {
  const { data } = await octokit.pulls.createReplyForReviewComment({
    owner,
    repo,
    pull_number: prNumber,
    comment_id: commentId,
    body,
  });
  return data.id;
};
