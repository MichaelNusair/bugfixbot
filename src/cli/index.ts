import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { watchCommand } from "./commands/watch.js";
import { statusCommand } from "./commands/status.js";
import { setLogLevel } from "../utils/logger.js";

const createCli = (): Command => {
  const program = new Command();

  program
    .name("bugfixbot")
    .description("Local-first PR review autopilot for Cursor Bugbot")
    .version("0.1.0")
    .option("-v, --verbose", "Enable verbose logging")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.verbose) {
        setLogLevel("debug");
      }
    });

  program
    .command("init")
    .description("Initialize bugfixbot in the current directory")
    .option("-f, --force", "Overwrite existing config files")
    .option("--skip-templates", "Skip creating Cursor command templates")
    .action(async (options) => {
      await runInit(process.cwd(), {
        force: options.force,
        skipTemplates: options.skipTemplates,
      });
    });

  program
    .command("run")
    .description("Run a single fix cycle")
    .option("--pr <number>", "PR number to fix", parseInt)
    .option("--repo <owner/repo>", "Repository (owner/repo)")
    .option("-c, --config <path>", "Path to config file")
    .action(async (options) => {
      const result = await runCommand(process.cwd(), {
        pr: options.pr,
        repo: options.repo,
        configPath: options.config,
      });

      if (result.status === "failed") {
        process.exit(1);
      }
    });

  program
    .command("watch")
    .description("Watch mode: continuously fix until done")
    .option("--pr <number>", "PR number to fix", parseInt)
    .option("--repo <owner/repo>", "Repository (owner/repo)")
    .option("-c, --config <path>", "Path to config file")
    .option("--max-cycles <number>", "Maximum cycles to run", parseInt)
    .option("--poll-interval <ms>", "Milliseconds between cycles", parseInt)
    .option(
      "--no-wait",
      "Exit immediately when no comments found (default: keep polling)"
    )
    .action(async (options) => {
      const result = await watchCommand(process.cwd(), {
        pr: options.pr,
        repo: options.repo,
        configPath: options.config,
        maxCycles: options.maxCycles,
        pollInterval: options.pollInterval,
        wait: options.wait,
      });

      if (result.status === "failed") {
        process.exit(1);
      }
    });

  program
    .command("status")
    .description("Show current status and pending comments")
    .option("--pr <number>", "PR number", parseInt)
    .option("--repo <owner/repo>", "Repository (owner/repo)")
    .option("-c, --config <path>", "Path to config file")
    .action(async (options) => {
      await statusCommand(process.cwd(), {
        pr: options.pr,
        repo: options.repo,
        configPath: options.config,
      });
    });

  return program;
};

export const cli = createCli();

export const run = async (argv: string[] = process.argv): Promise<void> => {
  await cli.parseAsync(argv);
};
