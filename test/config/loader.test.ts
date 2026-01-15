import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, configExists, getConfigPath } from '../../src/config/loader.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

const TEST_DIR = join(process.cwd(), 'test', '.test-config');

describe('loadConfig', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('returns defaults when no config file exists', () => {
    const config = loadConfig({ cwd: TEST_DIR });

    expect(config.github.auth).toBe('env');
    expect(config.fix.engine).toBe('cursor-cli');
    expect(config.guardrails.maxCycles).toBe(5);
  });

  it('loads config from bugfixbot.yml', () => {
    const configContent = `
github:
  repo: test/repo
  auth: gh
guardrails:
  maxCycles: 10
`;
    writeFileSync(join(TEST_DIR, 'bugfixbot.yml'), configContent);

    const config = loadConfig({ cwd: TEST_DIR });

    expect(config.github.repo).toBe('test/repo');
    expect(config.github.auth).toBe('gh');
    expect(config.guardrails.maxCycles).toBe(10);
    // Defaults should still be applied for unset values
    expect(config.fix.engine).toBe('cursor-cli');
  });

  it('merges overrides with file config', () => {
    const configContent = `
github:
  repo: file/repo
  auth: gh
`;
    writeFileSync(join(TEST_DIR, 'bugfixbot.yml'), configContent);

    const config = loadConfig({
      cwd: TEST_DIR,
      overrides: {
        github: { repo: 'override/repo', auth: 'token', botAuthors: ['custom-bot'] },
      },
    });

    expect(config.github.repo).toBe('override/repo');
    expect(config.github.auth).toBe('token');
  });

  it('loads from .bugfixbot.yml (dotfile variant)', () => {
    const configContent = `
github:
  repo: dotfile/repo
`;
    writeFileSync(join(TEST_DIR, '.bugfixbot.yml'), configContent);

    const config = loadConfig({ cwd: TEST_DIR });

    expect(config.github.repo).toBe('dotfile/repo');
  });

  it('prefers bugfixbot.yml over .bugfixbot.yml', () => {
    writeFileSync(join(TEST_DIR, 'bugfixbot.yml'), 'github:\n  repo: primary/repo');
    writeFileSync(join(TEST_DIR, '.bugfixbot.yml'), 'github:\n  repo: secondary/repo');

    const config = loadConfig({ cwd: TEST_DIR });

    expect(config.github.repo).toBe('primary/repo');
  });

  it('loads from explicit config path', () => {
    const customPath = join(TEST_DIR, 'custom-config.yml');
    writeFileSync(customPath, 'github:\n  repo: custom/repo');

    const config = loadConfig({ configPath: customPath, cwd: TEST_DIR });

    expect(config.github.repo).toBe('custom/repo');
  });
});

describe('configExists', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('returns false when no config exists', () => {
    expect(configExists(TEST_DIR)).toBe(false);
  });

  it('returns true when config exists', () => {
    writeFileSync(join(TEST_DIR, 'bugfixbot.yml'), 'github: {}');
    expect(configExists(TEST_DIR)).toBe(true);
  });
});

describe('getConfigPath', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('returns null when no config exists', () => {
    expect(getConfigPath(TEST_DIR)).toBeNull();
  });

  it('returns path when config exists', () => {
    writeFileSync(join(TEST_DIR, 'bugfixbot.yml'), 'github: {}');
    expect(getConfigPath(TEST_DIR)).toBe(join(TEST_DIR, 'bugfixbot.yml'));
  });
});
