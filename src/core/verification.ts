import { execShell } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import type { VerificationConfig, VerificationResult } from "../types/index.js";

export type VerificationRunResult = {
  passed: boolean;
  results: VerificationResult[];
  failedCommand?: string;
};

export const runVerification = async (
  config: VerificationConfig,
  cwd: string = process.cwd()
): Promise<VerificationRunResult> => {
  const { commands, timeout, stopOnFailure } = config;

  if (commands.length === 0) {
    logger.info("No verification commands configured, skipping");
    return { passed: true, results: [] };
  }

  const results: VerificationResult[] = [];
  let allPassed = true;
  let failedCommand: string | undefined;

  for (const command of commands) {
    logger.step(`Running: ${command}`);

    const result = await execShell(command, { cwd, timeout });

    const verificationResult: VerificationResult = {
      passed: result.exitCode === 0,
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
    };

    results.push(verificationResult);

    if (verificationResult.passed) {
      logger.success(`${command} passed (${result.durationMs}ms)`);
    } else {
      logger.error(`${command} failed with exit code ${result.exitCode}`);
      if (result.stderr) {
        logger.debug("stderr:", result.stderr);
      }
      allPassed = false;
      failedCommand = command;

      if (stopOnFailure) {
        logger.warn("Stopping verification due to failure");
        break;
      }
    }
  }

  return {
    passed: allPassed,
    results,
    failedCommand: allPassed ? undefined : failedCommand,
  };
};

export const formatVerificationSummary = (
  result: VerificationRunResult
): string => {
  const lines: string[] = [];

  lines.push(`Verification ${result.passed ? "PASSED" : "FAILED"}`);
  lines.push("");

  for (const r of result.results) {
    const status = r.passed ? "✓" : "✗";
    const duration = `${r.durationMs}ms`;
    lines.push(`  ${status} ${r.command} (${duration})`);
  }

  return lines.join("\n");
};
