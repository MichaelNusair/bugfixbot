import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { DEFAULT_CONFIG } from "../../config/defaults.js";
import { logger } from "../../utils/logger.js";

const CONFIG_FILENAME = "bugfixbot.yml";
const CURSOR_COMMANDS_DIR = ".cursor/commands";

const DEFAULT_BUGBOT_FIX_TEMPLATE = `# Bugbot Fix Command

Apply the following fixes to the codebase:

{{prompt}}

## Instructions

- Make minimal changes to address the review comments
- Do not change public APIs unless specifically requested
- Update tests if behavior changes
- If a fix is unclear or requires architectural decisions, leave a TODO comment
- Preserve existing code style and conventions
`;

const DEFAULT_BUGBOT_FIX_AND_TEST_TEMPLATE = `# Bugbot Fix and Test Command

Apply the following fixes to the codebase:

{{prompt}}

## Instructions

- Make minimal changes to address the review comments
- Update or create tests to cover the changes
- Ensure all existing tests still pass
- If a fix is unclear, leave a TODO comment and note it
`;

export type InitOptions = {
  force?: boolean;
  skipTemplates?: boolean;
};

export const runInit = async (
  cwd: string = process.cwd(),
  options: InitOptions = {}
): Promise<boolean> => {
  const { force = false, skipTemplates = false } = options;

  logger.info("Initializing bugfixbot...");

  // Create config file
  const configPath = join(cwd, CONFIG_FILENAME);
  if (existsSync(configPath) && !force) {
    logger.warn(`Config file already exists: ${CONFIG_FILENAME}`);
    logger.info("Use --force to overwrite");
  } else {
    const configContent = yamlStringify(DEFAULT_CONFIG);
    writeFileSync(configPath, configContent);
    logger.success(`Created ${CONFIG_FILENAME}`);
  }

  // Create cursor commands templates
  if (!skipTemplates) {
    const commandsDir = join(cwd, CURSOR_COMMANDS_DIR);

    if (!existsSync(commandsDir)) {
      mkdirSync(commandsDir, { recursive: true });
      logger.success(`Created ${CURSOR_COMMANDS_DIR}/`);
    }

    const bugbotFixPath = join(commandsDir, "bugbot_fix.md");
    if (!existsSync(bugbotFixPath) || force) {
      writeFileSync(bugbotFixPath, DEFAULT_BUGBOT_FIX_TEMPLATE);
      logger.success("Created .cursor/commands/bugbot_fix.md");
    }

    const bugbotFixAndTestPath = join(commandsDir, "bugbot_fix_and_test.md");
    if (!existsSync(bugbotFixAndTestPath) || force) {
      writeFileSync(bugbotFixAndTestPath, DEFAULT_BUGBOT_FIX_AND_TEST_TEMPLATE);
      logger.success("Created .cursor/commands/bugbot_fix_and_test.md");
    }
  }

  // Create .bugfixbot directory for state (with .gitignore)
  const stateDir = join(cwd, ".bugfixbot");
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, ".gitignore"), "*\n");
    logger.success("Created .bugfixbot/ (gitignored)");
  }

  logger.success("Initialization complete!");
  logger.info("");
  logger.info("Next steps:");
  logger.info("  1. Edit bugfixbot.yml to configure your project");
  logger.info("  2. Run: bugfixbot run --pr <number>");
  logger.info("");

  return true;
};
