import { existsSync } from "node:fs";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import { buildPrompt } from "./prompt-builder.js";
import type { FixEngine } from "./types.js";
import type { FixTask, EngineResult, FixConfig } from "../types/index.js";

// macOS Cursor Electron binary path - bypasses wrapper script's eval
const CURSOR_ELECTRON_PATH = "/Applications/Cursor.app/Contents/MacOS/Cursor";

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

const getCursorBinary = (): string => {
  // Use direct Electron binary path if available (bypasses wrapper's eval)
  if (existsSync(CURSOR_ELECTRON_PATH)) {
    return CURSOR_ELECTRON_PATH;
  }
  // Fall back to wrapper (may have issues with special characters)
  return "cursor";
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

      const prompt = buildPrompt({
        tasks,
        instructions: config.instructions,
      });

      logger.step(
        `Applying fixes for ${tasks.length} comment(s) via Cursor CLI...`
      );
      logger.debug("Prompt:", prompt);

      // Cursor CLI invocation
      // The --message flag sends the prompt to Cursor's AI
      // We call the Electron binary directly to bypass wrapper's eval
      const cursorBinary = getCursorBinary();
      logger.debug("Using Cursor binary:", cursorBinary);

      const result = await exec(cursorBinary, ["--message", prompt], {
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
