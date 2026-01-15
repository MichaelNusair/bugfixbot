import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createStateStore, stateExists, clearState } from '../../src/core/state.js';
import type { FixTask } from '../../src/types/index.js';

const TEST_DIR = join(process.cwd(), 'test', '.test-state');

describe('StateStore', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('creates a new state when none exists', () => {
    const store = createStateStore(TEST_DIR, 123);
    const state = store.getState();

    expect(state.prNumber).toBe(123);
    expect(state.cycleCount).toBe(0);
    expect(state.lastPushedSha).toBeNull();
    expect(state.handledComments).toEqual({});
  });

  it('persists state to disk', () => {
    const store = createStateStore(TEST_DIR, 123);
    store.incrementCycle();

    const store2 = createStateStore(TEST_DIR, 123);
    expect(store2.getState().cycleCount).toBe(1);
  });

  it('resets state when PR number changes', () => {
    const store1 = createStateStore(TEST_DIR, 123);
    store1.incrementCycle();
    store1.incrementCycle();

    const store2 = createStateStore(TEST_DIR, 456);
    expect(store2.getState().prNumber).toBe(456);
    expect(store2.getState().cycleCount).toBe(0);
  });

  it('marks tasks as handled', () => {
    const store = createStateStore(TEST_DIR, 123);

    const tasks: FixTask[] = [
      {
        id: 1,
        commentId: 1,
        filePath: 'src/test.ts',
        lineStart: 10,
        lineEnd: 10,
        side: 'RIGHT',
        body: 'Fix this',
        diffHunk: null,
        commitId: 'abc123',
        createdAt: '2026-01-15T10:00:00Z',
      },
    ];

    store.markHandled(tasks, 'commit123');

    expect(store.isHandled(1, 'abc123')).toBe(true);
    expect(store.isHandled(1, 'other')).toBe(false);
    expect(store.isHandled(2, 'abc123')).toBe(false);
  });

  it('increments cycle count', () => {
    const store = createStateStore(TEST_DIR, 123);

    expect(store.incrementCycle()).toBe(1);
    expect(store.incrementCycle()).toBe(2);
    expect(store.incrementCycle()).toBe(3);
    expect(store.getState().cycleCount).toBe(3);
  });

  it('updates lastPushedSha when marking handled', () => {
    const store = createStateStore(TEST_DIR, 123);

    const tasks: FixTask[] = [
      {
        id: 1,
        commentId: 1,
        filePath: 'src/test.ts',
        lineStart: 10,
        lineEnd: 10,
        side: 'RIGHT',
        body: 'Fix this',
        diffHunk: null,
        commitId: 'abc123',
        createdAt: '2026-01-15T10:00:00Z',
      },
    ];

    store.markHandled(tasks, 'newcommit456');
    expect(store.getState().lastPushedSha).toBe('newcommit456');
  });
});

describe('stateExists', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('returns false when no state exists', () => {
    expect(stateExists(TEST_DIR)).toBe(false);
  });

  it('returns true after state is created', () => {
    createStateStore(TEST_DIR, 123);
    expect(stateExists(TEST_DIR)).toBe(true);
  });
});

describe('clearState', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('clears existing state', () => {
    const store = createStateStore(TEST_DIR, 123);
    store.incrementCycle();
    store.incrementCycle();

    clearState(TEST_DIR);

    const store2 = createStateStore(TEST_DIR, 123);
    expect(store2.getState().cycleCount).toBe(0);
  });
});
