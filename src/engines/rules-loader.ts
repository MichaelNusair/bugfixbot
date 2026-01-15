import { readFile, readdir, access, constants } from "node:fs/promises";
import { join, extname } from "node:path";
import { logger } from "../utils/logger.js";

type RuleMatch = {
  pattern: string;
  ruleFile: string;
};

const FILE_TYPE_RULES: RuleMatch[] = [
  { pattern: ".tsx", ruleFile: "platform-ui.mdc" },
  { pattern: ".jsx", ruleFile: "platform-ui.mdc" },
  { pattern: "Handler.ts", ruleFile: "backend--api-handlers.mdc" },
  { pattern: "-handler.ts", ruleFile: "backend--api-handlers.mdc" },
  { pattern: "entity-models", ruleFile: "backend--dynamo-db.mdc" },
  { pattern: "repository", ruleFile: "backend--dynamo-db.mdc" },
  { pattern: "-cdk", ruleFile: "backend--cdk-infrastructure.mdc" },
  { pattern: "service", ruleFile: "backend--service-layer.mdc" },
];

const GLOBAL_RULES = ["global--code-review.mdc", "global--repo.mdc"];

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const readFileIfExists = async (path: string): Promise<string | null> => {
  try {
    const content = await readFile(path, "utf-8");
    return content;
  } catch {
    return null;
  }
};

const determineRelevantRules = (filePaths: string[]): Set<string> => {
  const relevantRules = new Set<string>(GLOBAL_RULES);

  for (const filePath of filePaths) {
    for (const { pattern, ruleFile } of FILE_TYPE_RULES) {
      if (filePath.includes(pattern) || filePath.endsWith(pattern)) {
        relevantRules.add(ruleFile);
      }
    }
  }

  return relevantRules;
};

export const loadRulesContext = async (
  cwd: string,
  filePaths: string[]
): Promise<string> => {
  const cursorDir = join(cwd, ".cursor");
  const rulesDir = join(cursorDir, "rules");

  const sections: string[] = [];

  // 1. Load BUGBOT.md if present
  const bugbotPath = join(cursorDir, "BUGBOT.md");
  const bugbotContent = await readFileIfExists(bugbotPath);
  if (bugbotContent) {
    logger.debug("Loaded BUGBOT.md");
    sections.push("## Project Review Guidelines (BUGBOT.md)\n\n" + bugbotContent);
  }

  // 2. Determine which rules to load based on file types
  const relevantRules = determineRelevantRules(filePaths);

  // 3. Check if rules directory exists
  const rulesExist = await fileExists(rulesDir);
  if (!rulesExist) {
    logger.debug("No .cursor/rules directory found");
    return sections.join("\n\n---\n\n");
  }

  // 4. Load relevant rule files
  const loadedRules: string[] = [];
  for (const ruleName of relevantRules) {
    const rulePath = join(rulesDir, ruleName);
    const content = await readFileIfExists(rulePath);
    if (content) {
      // Strip frontmatter (--- ... ---) if present
      const stripped = content.replace(/^---[\s\S]*?---\n?/, "").trim();
      loadedRules.push(`### ${ruleName}\n\n${stripped}`);
      logger.debug(`Loaded rule: ${ruleName}`);
    }
  }

  if (loadedRules.length > 0) {
    sections.push("## Project Rules\n\n" + loadedRules.join("\n\n"));
  }

  const result = sections.join("\n\n---\n\n");
  
  if (result.length > 0) {
    logger.info(`Loaded ${loadedRules.length} rule file(s) for context`);
  }

  return result;
};

export const loadAllRulesContext = async (cwd: string): Promise<string> => {
  const cursorDir = join(cwd, ".cursor");
  const rulesDir = join(cursorDir, "rules");

  const sections: string[] = [];

  // Load BUGBOT.md
  const bugbotPath = join(cursorDir, "BUGBOT.md");
  const bugbotContent = await readFileIfExists(bugbotPath);
  if (bugbotContent) {
    sections.push("## Project Review Guidelines\n\n" + bugbotContent);
  }

  // Load all rules
  const rulesExist = await fileExists(rulesDir);
  if (rulesExist) {
    try {
      const files = await readdir(rulesDir);
      const mdcFiles = files.filter((f) => extname(f) === ".mdc");

      const loadedRules: string[] = [];
      for (const file of mdcFiles) {
        const content = await readFileIfExists(join(rulesDir, file));
        if (content) {
          const stripped = content.replace(/^---[\s\S]*?---\n?/, "").trim();
          loadedRules.push(`### ${file}\n\n${stripped}`);
        }
      }

      if (loadedRules.length > 0) {
        sections.push("## Project Rules\n\n" + loadedRules.join("\n\n"));
      }
    } catch (error) {
      logger.debug("Error reading rules directory:", error);
    }
  }

  return sections.join("\n\n---\n\n");
};
