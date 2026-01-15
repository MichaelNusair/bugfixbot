import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { State, FixTask } from "../types/index.js";

const STATE_DIR = ".bugfixbot";
const STATE_FILE = "state.json";

const createEmptyState = (prNumber: number): State => ({
  prNumber,
  cycleCount: 0,
  lastPushedSha: null,
  handledComments: {},
  startedAt: new Date().toISOString(),
});

export type StateStore = {
  load: () => State;
  save: (state: State) => void;
  reset: (prNumber: number) => State;
  markHandled: (tasks: FixTask[], commitSha: string) => void;
  isHandled: (commentId: number, commitId: string | null) => boolean;
  incrementCycle: () => number;
  getState: () => State;
};

export const createStateStore = (
  cwd: string = process.cwd(),
  prNumber?: number
): StateStore => {
  const stateDir = join(cwd, STATE_DIR);
  const statePath = join(stateDir, STATE_FILE);

  let state: State;

  const ensureDir = (): void => {
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }

    // Create .gitignore to exclude state from git
    const gitignorePath = join(stateDir, ".gitignore");
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, "*\n");
    }
  };

  const load = (): State => {
    ensureDir();

    if (existsSync(statePath)) {
      try {
        const content = readFileSync(statePath, "utf-8");
        state = JSON.parse(content) as State;
        return state;
      } catch {
        // Corrupted state file, create new
      }
    }

    // Create new state and persist it
    state = createEmptyState(prNumber ?? 0);
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    return state;
  };

  const save = (newState: State): void => {
    ensureDir();
    state = newState;
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  };

  const reset = (newPrNumber: number): State => {
    state = createEmptyState(newPrNumber);
    save(state);
    return state;
  };

  const createCommentKey = (
    commentId: number,
    commitId: string | null
  ): string => {
    return `${commentId}-${commitId ?? "none"}`;
  };

  const markHandled = (tasks: FixTask[], commitSha: string): void => {
    const now = new Date().toISOString();

    for (const task of tasks) {
      const key = createCommentKey(task.commentId, task.commitId);
      state.handledComments[key] = {
        sha: commitSha,
        handledAt: now,
      };
    }

    state.lastPushedSha = commitSha;
    save(state);
  };

  const isHandled = (commentId: number, commitId: string | null): boolean => {
    const key = createCommentKey(commentId, commitId);
    return key in state.handledComments;
  };

  const incrementCycle = (): number => {
    state.cycleCount += 1;
    save(state);
    return state.cycleCount;
  };

  const getState = (): State => {
    return state;
  };

  // Initialize state
  state = load();
  if (prNumber && state.prNumber !== prNumber) {
    state = reset(prNumber);
  }

  return {
    load,
    save,
    reset,
    markHandled,
    isHandled,
    incrementCycle,
    getState,
  };
};

export const stateExists = (cwd: string = process.cwd()): boolean => {
  const statePath = join(cwd, STATE_DIR, STATE_FILE);
  return existsSync(statePath);
};

export const clearState = (cwd: string = process.cwd()): void => {
  const statePath = join(cwd, STATE_DIR, STATE_FILE);
  if (existsSync(statePath)) {
    writeFileSync(statePath, "{}");
  }
};
