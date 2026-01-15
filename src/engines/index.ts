import type { FixEngine as FixEngineType } from "../types/index.js";
import { createCursorCliEngine } from "./cursor-cli.js";
import { createCursorCommandEngine } from "./cursor-command.js";

export { createCursorCliEngine } from "./cursor-cli.js";
export {
  createCursorCommandEngine,
  cursorCommandExists,
} from "./cursor-command.js";
export {
  buildPrompt,
  buildPromptWithRules,
  buildCompactPrompt,
  estimateTokens,
} from "./prompt-builder.js";
export { loadRulesContext, loadAllRulesContext } from "./rules-loader.js";
export type { FixEngine, PromptContext } from "./types.js";

export const createEngine = (
  engineType: FixEngineType,
  cwd: string = process.cwd()
) => {
  switch (engineType) {
    case "cursor-cli":
      return createCursorCliEngine(cwd);
    case "cursor-command":
      return createCursorCommandEngine(cwd);
    default:
      throw new Error(`Unknown engine type: ${engineType}`);
  }
};
