import { describe, it, expect } from 'vitest';
import { runVerification, formatVerificationSummary } from '../../src/core/verification.js';
import type { VerificationConfig } from '../../src/types/index.js';

describe('runVerification', () => {
  it('returns passed when no commands configured', async () => {
    const config: VerificationConfig = {
      commands: [],
      timeout: 5000,
      stopOnFailure: true,
    };

    const result = await runVerification(config);

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it('runs a passing command', async () => {
    const config: VerificationConfig = {
      commands: ['echo "test"'],
      timeout: 5000,
      stopOnFailure: true,
    };

    const result = await runVerification(config);

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].exitCode).toBe(0);
  });

  it('detects a failing command', async () => {
    const config: VerificationConfig = {
      commands: ['exit 1'],
      timeout: 5000,
      stopOnFailure: true,
    };

    const result = await runVerification(config);

    expect(result.passed).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].exitCode).toBe(1);
    expect(result.failedCommand).toBe('exit 1');
  });

  it('stops on first failure when stopOnFailure is true', async () => {
    const config: VerificationConfig = {
      commands: ['exit 1', 'echo "should not run"'],
      timeout: 5000,
      stopOnFailure: true,
    };

    const result = await runVerification(config);

    expect(result.passed).toBe(false);
    expect(result.results).toHaveLength(1);
  });

  it('continues on failure when stopOnFailure is false', async () => {
    const config: VerificationConfig = {
      commands: ['exit 1', 'echo "still runs"'],
      timeout: 5000,
      stopOnFailure: false,
    };

    const result = await runVerification(config);

    expect(result.passed).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[1].passed).toBe(true);
  });

  it('runs multiple passing commands', async () => {
    const config: VerificationConfig = {
      commands: ['echo "one"', 'echo "two"', 'echo "three"'],
      timeout: 5000,
      stopOnFailure: true,
    };

    const result = await runVerification(config);

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(result.results.every((r) => r.passed)).toBe(true);
  });
});

describe('formatVerificationSummary', () => {
  it('formats a passing summary', () => {
    const result = {
      passed: true,
      results: [
        { passed: true, command: 'npm test', exitCode: 0, stdout: '', stderr: '', durationMs: 1500 },
        { passed: true, command: 'npm run lint', exitCode: 0, stdout: '', stderr: '', durationMs: 800 },
      ],
    };

    const summary = formatVerificationSummary(result);

    expect(summary).toContain('Verification PASSED');
    expect(summary).toContain('✓ npm test');
    expect(summary).toContain('✓ npm run lint');
  });

  it('formats a failing summary', () => {
    const result = {
      passed: false,
      results: [
        { passed: true, command: 'npm test', exitCode: 0, stdout: '', stderr: '', durationMs: 1500 },
        { passed: false, command: 'npm run lint', exitCode: 1, stdout: '', stderr: 'lint error', durationMs: 800 },
      ],
      failedCommand: 'npm run lint',
    };

    const summary = formatVerificationSummary(result);

    expect(summary).toContain('Verification FAILED');
    expect(summary).toContain('✓ npm test');
    expect(summary).toContain('✗ npm run lint');
  });
});
