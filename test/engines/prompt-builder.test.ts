import { describe, it, expect } from 'vitest';
import { buildPrompt, buildCompactPrompt, estimateTokens } from '../../src/engines/prompt-builder.js';
import type { FixTask } from '../../src/types/index.js';

const createTask = (overrides: Partial<FixTask> = {}): FixTask => ({
  id: 1,
  commentId: 1,
  filePath: 'src/utils.ts',
  lineStart: 42,
  lineEnd: 42,
  side: 'RIGHT',
  body: 'Fix this issue please',
  diffHunk: null,
  commitId: 'abc123',
  createdAt: '2026-01-15T10:00:00Z',
  ...overrides,
});

describe('buildPrompt', () => {
  it('builds a prompt for a single task', () => {
    const tasks = [createTask()];
    const prompt = buildPrompt({ tasks });

    expect(prompt).toContain('Apply the following fixes');
    expect(prompt).toContain('## Fix 1: src/utils.ts:42');
    expect(prompt).toContain('Fix this issue please');
    expect(prompt).toContain('Instructions:');
  });

  it('builds a prompt for multiple tasks', () => {
    const tasks = [
      createTask({ id: 1, filePath: 'src/a.ts', lineStart: 10 }),
      createTask({ id: 2, filePath: 'src/b.ts', lineStart: 20 }),
      createTask({ id: 3, filePath: 'src/c.ts', lineStart: 30 }),
    ];
    const prompt = buildPrompt({ tasks });

    expect(prompt).toContain('## Fix 1: src/a.ts:10');
    expect(prompt).toContain('## Fix 2: src/b.ts:20');
    expect(prompt).toContain('## Fix 3: src/c.ts:30');
  });

  it('includes line range when different', () => {
    const tasks = [createTask({ lineStart: 10, lineEnd: 15 })];
    const prompt = buildPrompt({ tasks });

    expect(prompt).toContain('## Fix 1: src/utils.ts:10-15');
  });

  it('includes diff hunk when present', () => {
    const tasks = [
      createTask({
        diffHunk: '@@ -40,6 +40,8 @@\n function test() {\n   return true;\n }',
      }),
    ];
    const prompt = buildPrompt({ tasks });

    expect(prompt).toContain('Context from diff:');
    expect(prompt).toContain('```diff');
    expect(prompt).toContain('function test()');
  });

  it('uses custom instructions when provided', () => {
    const tasks = [createTask()];
    const prompt = buildPrompt({
      tasks,
      instructions: 'Custom instruction here',
    });

    expect(prompt).toContain('Custom instruction here');
    expect(prompt).not.toContain('Make minimal changes');
  });
});

describe('buildCompactPrompt', () => {
  it('builds a compact prompt', () => {
    const tasks = [
      createTask({ id: 1, filePath: 'src/a.ts', lineStart: 10, body: 'First issue' }),
      createTask({ id: 2, filePath: 'src/b.ts', lineStart: 20, body: 'Second issue' }),
    ];
    const prompt = buildCompactPrompt({ tasks });

    expect(prompt).toContain('1. [src/a.ts:10] First issue');
    expect(prompt).toContain('2. [src/b.ts:20] Second issue');
  });

  it('truncates to first line of body', () => {
    const tasks = [
      createTask({
        body: 'First line\nSecond line\nThird line',
      }),
    ];
    const prompt = buildCompactPrompt({ tasks });

    expect(prompt).toContain('First line');
    expect(prompt).not.toContain('Second line');
  });
});

describe('estimateTokens', () => {
  it('estimates tokens based on character count', () => {
    const shortPrompt = 'Short prompt';
    const longPrompt = 'A'.repeat(400);

    expect(estimateTokens(shortPrompt)).toBe(3); // 12 chars / 4
    expect(estimateTokens(longPrompt)).toBe(100); // 400 chars / 4
  });
});
