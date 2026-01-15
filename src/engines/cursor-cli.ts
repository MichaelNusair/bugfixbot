import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import { buildPromptWithRules } from "./prompt-builder.js";
import type { FixEngine } from "./types.js";
import type { FixTask, EngineResult, FixConfig } from "../types/index.js";

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

export const createCursorCliEngine = (
  cwd: string = process.cwd()
): FixEngine => {
  return {
    name: "cursor-cli",

    async applyFixes(
      tasks: FixTask[],
      config: FixConfig
    ): Promise<EngineResult> {
      if (tasks.length === 0) {
        return { success: true, filesChanged: [] };
      }

      const prompt = await buildPromptWithRules(
        {
          tasks,
          instructions: config.instructions,
        },
        cwd
      );

      logger.step(
        `Applying fixes for ${tasks.length} comment(s) via Cursor CLI...`
      );
      logger.debug("Prompt:", prompt);

      // Build CLI arguments
      const cliArgs = ["agent", "--print", "--workspace", cwd];
      
      // Add model if specified
      if (config.model) {
        cliArgs.push("--model", config.model);
        logger.debug(`Using model: ${config.model}`);
      }
      
      cliArgs.push(prompt);

      // Use cursor agent with --print for non-interactive mode
      const result = await exec("cursor", cliArgs, {
        cwd,
        timeout: 300000, // 5 minute timeout
      });

      if (result.exitCode !== 0) {
        logger.error("Cursor CLI failed:", result.stderr);
        return {
          success: false,
          filesChanged: [],
          error: result.stderr || "Cursor CLI exited with non-zero code",
        };
      }

      // Detect what files were changed
      const filesChanged = await detectChangedFiles(cwd);

      if (filesChanged.length === 0) {
        logger.warn("Cursor CLI ran but no files were changed");
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
