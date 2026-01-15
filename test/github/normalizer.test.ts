import { describe, it, expect } from 'vitest';
import { normalizeComments, groupTasksByFile, countAffectedLines } from '../../src/github/normalizer.js';
import { createMockComment, createMockState, sampleBugbotComments, sampleNonActionableComments } from '../fixtures/comments.js';

describe('normalizeComments', () => {
  it('converts PR comments to fix tasks', () => {
    const state = createMockState();
    const tasks = normalizeComments(sampleBugbotComments, state);

    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({
      id: 1,
      commentId: 1,
      filePath: 'src/utils/parser.ts',
      lineStart: 42,
      body: 'Variable `result` is used before being assigned.',
    });
  });

  it('filters out already handled comments', () => {
    const state = createMockState({
      handledComments: {
        '1-abc123': { sha: 'def456', handledAt: '2026-01-15T10:30:00Z' },
      },
    });

    const tasks = normalizeComments(sampleBugbotComments, state);

    expect(tasks).toHaveLength(2);
    expect(tasks.find((t) => t.id === 1)).toBeUndefined();
  });

  it('filters out non-actionable comments', () => {
    const state = createMockState();
    const tasks = normalizeComments(sampleNonActionableComments, state);

    expect(tasks).toHaveLength(0);
  });

  it('filters out outdated comments (no position and no line)', () => {
    const outdatedComment = createMockComment({
      id: 99,
      path: 'src/old.ts',
      position: null,
      line: null,
    });

    const state = createMockState();
    const tasks = normalizeComments([outdatedComment], state);

    expect(tasks).toHaveLength(0);
  });

  it('handles comments without a path as potentially actionable if they contain keywords', () => {
    const generalComment = createMockComment({
      id: 100,
      path: null,
      line: null,
      body: 'Please fix the error handling in this module.',
    });

    const state = createMockState();
    const tasks = normalizeComments([generalComment], state);

    expect(tasks).toHaveLength(1);
  });
});

describe('groupTasksByFile', () => {
  it('groups tasks by file path', () => {
    const state = createMockState();
    const tasks = normalizeComments(sampleBugbotComments, state);
    const grouped = groupTasksByFile(tasks);

    expect(grouped.size).toBe(3);
    expect(grouped.get('src/utils/parser.ts')).toHaveLength(1);
    expect(grouped.get('src/components/Button.tsx')).toHaveLength(1);
  });

  it('handles multiple tasks in the same file', () => {
    const comments = [
      createMockComment({ id: 1, path: 'src/utils.ts', line: 10 }),
      createMockComment({ id: 2, path: 'src/utils.ts', line: 20 }),
      createMockComment({ id: 3, path: 'src/utils.ts', line: 30 }),
    ];

    const state = createMockState();
    const tasks = normalizeComments(comments, state);
    const grouped = groupTasksByFile(tasks);

    expect(grouped.size).toBe(1);
    expect(grouped.get('src/utils.ts')).toHaveLength(3);
  });
});

describe('countAffectedLines', () => {
  it('counts total affected lines', () => {
    const state = createMockState();
    const tasks = normalizeComments(sampleBugbotComments, state);
    const count = countAffectedLines(tasks);

    // Each task affects 1 line (lineStart === lineEnd)
    expect(count).toBe(3);
  });
});
