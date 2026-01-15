import type { PRComment, State } from "../../src/types/index.js";

export const createMockComment = (
  overrides: Partial<PRComment> = {}
): PRComment => ({
  id: 1,
  userId: 100,
  userLogin: "bugbot",
  body: "Fix this issue",
  path: "src/utils.ts",
  line: 42,
  side: "RIGHT",
  commitId: "abc123",
  diffHunk: "@@ -40,6 +40,8 @@ function example() {\n   return value;\n }",
  createdAt: "2026-01-15T10:00:00Z",
  updatedAt: "2026-01-15T10:00:00Z",
  position: 5,
  ...overrides,
});

export const createMockState = (overrides: Partial<State> = {}): State => ({
  prNumber: 123,
  cycleCount: 0,
  lastPushedSha: null,
  handledComments: {},
  startedAt: "2026-01-15T09:00:00Z",
  ...overrides,
});

export const sampleBugbotComments: PRComment[] = [
  createMockComment({
    id: 1,
    body: "Variable `result` is used before being assigned.",
    path: "src/utils/parser.ts",
    line: 42,
  }),
  createMockComment({
    id: 2,
    body: "Missing aria-label for accessibility.",
    path: "src/components/Button.tsx",
    line: 15,
  }),
  createMockComment({
    id: 3,
    body: "Consider using const instead of let for immutable variable.",
    path: "src/core/engine.ts",
    line: 88,
  }),
];

export const sampleNonActionableComments: PRComment[] = [
  createMockComment({
    id: 10,
    body: "LGTM!",
    path: "src/index.ts",
    line: 1,
  }),
  createMockComment({
    id: 11,
    body: "Thanks for the fix!",
    path: null,
    line: null,
  }),
  createMockComment({
    id: 12,
    body: "Why did you choose this approach?",
    path: "src/utils.ts",
    line: 20,
  }),
];
