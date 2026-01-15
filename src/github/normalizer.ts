import type { PRComment, FixTask, State } from "../types/index.js";

const createCommentKey = (
  commentId: number,
  commitId: string | null
): string => {
  return `${commentId}-${commitId ?? "none"}`;
};

const isCommentHandled = (comment: PRComment, state: State): boolean => {
  const key = createCommentKey(comment.id, comment.commitId);
  return key in state.handledComments;
};

const isOutdatedComment = (comment: PRComment): boolean => {
  // Comments on outdated diffs have position === null and no line number
  // but still have a path - this means the code has moved
  if (comment.path && comment.position === null && comment.line === null) {
    return true;
  }
  return false;
};

const isActionableComment = (comment: PRComment): boolean => {
  const body = comment.body.toLowerCase();

  // Skip comments that are just acknowledgments or questions
  const nonActionablePatterns = [
    /^(lgtm|looks good|approved|nice|great)/i,
    /^(thanks|thank you)/i,
    /^\?/,
    /^(what|why|how|can you explain)/i,
  ];

  for (const pattern of nonActionablePatterns) {
    if (pattern.test(comment.body.trim())) {
      return false;
    }
  }

  // Must have a path to be actionable (inline comment)
  // or contain specific fix-related keywords
  if (comment.path) {
    return true;
  }

  // For issue-level comments, check for actionable keywords
  const actionableKeywords = [
    "fix",
    "change",
    "update",
    "remove",
    "add",
    "rename",
    "refactor",
    "error",
    "bug",
    "issue",
    "warning",
    "missing",
    "incorrect",
    "should",
    "must",
    "need",
  ];

  return actionableKeywords.some((keyword) => body.includes(keyword));
};

const parseLineRange = (comment: PRComment): { start: number; end: number } => {
  const line = comment.line ?? 1;

  // Try to extract line range from diff hunk
  if (comment.diffHunk) {
    const match = comment.diffHunk.match(
      /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/
    );
    if (match) {
      const startLine = parseInt(match[1], 10);
      const lineCount = match[2] ? parseInt(match[2], 10) : 1;
      // If the comment line is within the hunk, use it
      if (line >= startLine && line < startLine + lineCount) {
        return { start: line, end: line };
      }
    }
  }

  return { start: line, end: line };
};

export const normalizeComments = (
  comments: PRComment[],
  state: State
): FixTask[] => {
  const tasks: FixTask[] = [];

  for (const comment of comments) {
    // Skip comments that already have replies (handled on GitHub)
    if (comment.hasReply) {
      continue;
    }

    // Skip already handled comments (handled in local state)
    if (isCommentHandled(comment, state)) {
      continue;
    }

    // Skip outdated comments
    if (isOutdatedComment(comment)) {
      continue;
    }

    // Skip non-actionable comments
    if (!isActionableComment(comment)) {
      continue;
    }

    const lineRange = parseLineRange(comment);

    tasks.push({
      id: comment.id,
      commentId: comment.id,
      filePath: comment.path ?? "",
      lineStart: lineRange.start,
      lineEnd: lineRange.end,
      side: comment.side ?? "RIGHT",
      body: comment.body,
      diffHunk: comment.diffHunk,
      commitId: comment.commitId,
      createdAt: comment.createdAt,
    });
  }

  return tasks;
};

export const groupTasksByFile = (tasks: FixTask[]): Map<string, FixTask[]> => {
  const grouped = new Map<string, FixTask[]>();

  for (const task of tasks) {
    const existing = grouped.get(task.filePath) ?? [];
    existing.push(task);
    grouped.set(task.filePath, existing);
  }

  return grouped;
};

export const countAffectedLines = (tasks: FixTask[]): number => {
  let total = 0;
  for (const task of tasks) {
    total += task.lineEnd - task.lineStart + 1;
  }
  return total;
};

export { createCommentKey };
