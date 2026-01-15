import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import { buildPrompt } from "./prompt-builder.js";
import type { FixEngine } from "./types.js";
import type { FixTask, EngineResult, FixConfig } from "../types/index.js";

const CURSOR_COMMANDS_DIR = ".cursor/commands";

const detectChangedFiles = async (cwd: string): Promise<string[]> => {
  const result = await exec("git", ["diff", "--name-only"], { cwd });
  if (result.exitCode !== 0) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

const loadCommandTemplate = (
  cwd: string,
  commandName: string
): string | null => {
  const possiblePaths = [
    join(cwd, CURSOR_COMMANDS_DIR, `${commandName}.md`),
    join(cwd, CURSOR_COMMANDS_DIR, commandName),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return readFileSync(path, "utf-8");
    }
  }

  return null;
};

const interpolateTemplate = (
  template: string,
  context: { prompt: string; tasks: FixTask[] }
): string => {
  return template
    .replace(/\{\{prompt\}\}/g, context.prompt)
    .replace(/\{\{taskCount\}\}/g, String(context.tasks.length))
    .replace(
      /\{\{files\}\}/g,
      [...new Set(context.tasks.map((t) => t.filePath))].join(", ")
    );
};

export const createCursorCommandEngine = (
  cwd: string = process.cwd()
): FixEngine => {
  return {
    name: "cursor-command",

    async applyFixes(
      tasks: FixTask[],
      config: FixConfig
    ): Promise<EngineResult> {
      if (tasks.length === 0) {
        return { success: true, filesChanged: [] };
      }

      const commandName = config.command ?? "bugbot_fix";
      const template = loadCommandTemplate(cwd, commandName);

      if (!template) {
        logger.error(`Cursor command not found: ${commandName}`);
        logger.info(
          `Expected location: ${join(
            cwd,
            CURSOR_COMMANDS_DIR,
            commandName + ".md"
          )}`
        );
        return {
          success: false,
          filesChanged: [],
          error: `Cursor command "${commandName}" not found in ${CURSOR_COMMANDS_DIR}/`,
        };
      }

      const prompt = buildPrompt({
        tasks,
        instructions: config.instructions,
      });

      const interpolatedCommand = interpolateTemplate(template, {
        prompt,
        tasks,
      });

      logger.step(
        `Running Cursor command "${commandName}" for ${tasks.length} comment(s)...`
      );
      logger.debug("Interpolated command:", interpolatedCommand);

      // Use cursor agent with --print for non-interactive mode
      const result = await exec(
        "cursor",
        ["agent", "--print", "--workspace", cwd, interpolatedCommand],
        {
          cwd,
          timeout: 300000,
        }
      );

      if (result.exitCode !== 0) {
        logger.error("Cursor command failed:", result.stderr);
        return {
          success: false,
          filesChanged: [],
          error: result.stderr || "Cursor command exited with non-zero code",
        };
      }

      const filesChanged = await detectChangedFiles(cwd);

      if (filesChanged.length === 0) {
        logger.warn("Cursor command ran but no files were changed");
        return {
          success: true,
          filesChanged: [],
          error: "No changes were made",
        };
      }

      logger.success(
        `Changed ${filesChanged.length} file(s): ${filesChanged.join(", ")}`
      );

      return {
        success: true,
        filesChanged,
      };
    },
  };
};

export const cursorCommandExists = (
  cwd: string,
  commandName: string
): boolean => {
  return loadCommandTemplate(cwd, commandName) !== null;
};
