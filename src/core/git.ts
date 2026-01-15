import { simpleGit, type SimpleGit } from "simple-git";
import { logger } from "../utils/logger.js";
import type { GitConfig } from "../types/index.js";

export type GitManagerOptions = {
  cwd?: string;
};

export type GitManager = {
  ensureCleanState: () => Promise<boolean>;
  ensureUpToDate: (autoRebase?: boolean) => Promise<boolean>;
  hasChanges: () => Promise<boolean>;
  stageAll: () => Promise<void>;
  commit: (message: string) => Promise<string>;
  push: (force?: boolean) => Promise<void>;
  getHead: () => Promise<string>;
  getBranch: () => Promise<string>;
  getRemote: () => Promise<string | null>;
  getDiff: () => Promise<string>;
  getDiffStats: () => Promise<{
    filesChanged: number;
    insertions: number;
    deletions: number;
  }>;
};

const formatCommitMessage = (template: string, cycle: number): string => {
  return template.replace(/\{cycle\}/g, String(cycle));
};

export const createGitManager = (
  options: GitManagerOptions = {}
): GitManager => {
  const { cwd = process.cwd() } = options;
  const git: SimpleGit = simpleGit(cwd);

  return {
    async ensureCleanState(): Promise<boolean> {
      const status = await git.status();

      if (
        status.modified.length > 0 ||
        status.staged.length > 0 ||
        status.not_added.length > 0
      ) {
        logger.error("Working tree is not clean");
        logger.debug("Modified:", status.modified);
        logger.debug("Staged:", status.staged);
        logger.debug("Untracked:", status.not_added);
        return false;
      }

      return true;
    },

    async ensureUpToDate(autoRebase = false): Promise<boolean> {
      try {
        await git.fetch();
        const status = await git.status();

        if (status.behind > 0) {
          logger.warn(`Branch is ${status.behind} commit(s) behind remote`);

          if (autoRebase) {
            logger.step("Auto-rebasing...");
            await git.rebase(["origin/" + status.current]);
            logger.success("Rebase complete");
          } else {
            logger.error("Please pull or rebase before running bugfixbot");
            return false;
          }
        }

        return true;
      } catch (error) {
        logger.warn("Could not check remote status:", error);
        return true; // Continue anyway if fetch fails
      }
    },

    async hasChanges(): Promise<boolean> {
      const status = await git.status();
      return status.modified.length > 0 || status.staged.length > 0;
    },

    async stageAll(): Promise<void> {
      await git.add("-A");
    },

    async commit(message: string): Promise<string> {
      const result = await git.commit(message);
      return result.commit;
    },

    async push(force = false): Promise<void> {
      const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
      const args = force ? ["--force-with-lease"] : [];
      await git.push("origin", branch.trim(), args);
    },

    async getHead(): Promise<string> {
      const result = await git.revparse(["HEAD"]);
      return result.trim();
    },

    async getBranch(): Promise<string> {
      const result = await git.revparse(["--abbrev-ref", "HEAD"]);
      return result.trim();
    },

    async getRemote(): Promise<string | null> {
      try {
        const result = await git.remote(["get-url", "origin"]);
        return result?.trim() ?? null;
      } catch {
        return null;
      }
    },

    async getDiff(): Promise<string> {
      return git.diff();
    },

    async getDiffStats(): Promise<{
      filesChanged: number;
      insertions: number;
      deletions: number;
    }> {
      const summary = await git.diffSummary();
      return {
        filesChanged: summary.files.length,
        insertions: summary.insertions,
        deletions: summary.deletions,
      };
    },
  };
};

export const commitAndPush = async (
  gitManager: GitManager,
  config: GitConfig,
  cycleNumber: number
): Promise<string> => {
  const message = formatCommitMessage(config.commitTemplate, cycleNumber);

  logger.step("Staging changes...");
  await gitManager.stageAll();

  logger.step(`Committing: ${message}`);
  const commitSha = await gitManager.commit(message);

  logger.step("Pushing to remote...");
  await gitManager.push(config.pushForce);

  logger.success(`Pushed commit ${commitSha.slice(0, 7)}`);

  return commitSha;
};
