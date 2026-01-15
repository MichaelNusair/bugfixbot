import { Octokit } from "@octokit/rest";
import { execSync } from "node:child_process";
import type { AuthMethod } from "../types/index.js";

export type GitHubClientOptions = {
  auth: AuthMethod;
  token?: string;
};

const getTokenFromGhCli = (): string => {
  try {
    const token = execSync("gh auth token", { encoding: "utf-8" }).trim();
    if (!token) {
      throw new Error("No token returned from gh CLI");
    }
    return token;
  } catch (error) {
    throw new Error(
      "Failed to get token from gh CLI. Ensure gh is installed and authenticated: gh auth login"
    );
  }
};

const getTokenFromEnv = (): string => {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    throw new Error(
      "No GitHub token found in environment. Set GITHUB_TOKEN or GH_TOKEN, or use auth: gh"
    );
  }
  return token;
};

const resolveToken = (options: GitHubClientOptions): string => {
  switch (options.auth) {
    case "gh":
      return getTokenFromGhCli();
    case "token":
      if (!options.token) {
        throw new Error('Auth method "token" requires a token to be provided');
      }
      return options.token;
    case "env":
      return getTokenFromEnv();
    default:
      throw new Error(`Unknown auth method: ${options.auth}`);
  }
};

export const createGitHubClient = (options: GitHubClientOptions): Octokit => {
  const token = resolveToken(options);
  return new Octokit({ auth: token });
};

export const parseRepoString = (
  repo: string
): { owner: string; repo: string } => {
  const parts = repo.split("/");
  if (parts.length !== 2) {
    throw new Error(`Invalid repo format: ${repo}. Expected owner/repo`);
  }
  return { owner: parts[0], repo: parts[1] };
};

export const inferRepoFromGit = (): { owner: string; repo: string } | null => {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      encoding: "utf-8",
    }).trim();

    // Handle SSH format: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(
      /git@github\.com:([^/]+)\/([^.]+)(?:\.git)?$/
    );
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    // Handle HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(
      /github\.com\/([^/]+)\/([^.]+)(?:\.git)?$/
    );
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
};

export const inferPrFromBranch = async (
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<number | null> => {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();

    if (branch === "main" || branch === "master") {
      return null;
    }

    const { data: prs } = await octokit.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: "open",
    });

    if (prs.length > 0) {
      return prs[0].number;
    }

    return null;
  } catch {
    return null;
  }
};
