import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { ConfigSchema, type ParsedConfig } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import type { Config } from "../types/index.js";

export type LoadConfigOptions = {
  configPath?: string;
  cwd?: string;
  overrides?: Partial<Config>;
};

const CONFIG_FILENAMES = [
  "bugfixbot.yml",
  "bugfixbot.yaml",
  ".bugfixbot.yml",
  ".bugfixbot.yaml",
];

const findConfigFile = (cwd: string): string | null => {
  for (const filename of CONFIG_FILENAMES) {
    const filepath = join(cwd, filename);
    if (existsSync(filepath)) {
      return filepath;
    }
  }
  return null;
};

const parseConfigFile = (filepath: string): unknown => {
  const content = readFileSync(filepath, "utf-8");
  return parseYaml(content);
};

const deepMerge = <T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T => {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
};

export const loadConfig = (options: LoadConfigOptions = {}): Config => {
  const { configPath, cwd = process.cwd(), overrides = {} } = options;

  let fileConfig: unknown = {};

  const resolvedPath = configPath ?? findConfigFile(cwd);
  if (resolvedPath && existsSync(resolvedPath)) {
    fileConfig = parseConfigFile(resolvedPath);
  }

  const mergedWithDefaults = deepMerge(
    DEFAULT_CONFIG,
    fileConfig as Partial<Config>
  );
  const mergedWithOverrides = deepMerge(mergedWithDefaults, overrides);

  const parsed = ConfigSchema.parse(mergedWithOverrides);

  return parsed as Config;
};

export const validateConfig = (config: unknown): ParsedConfig => {
  return ConfigSchema.parse(config);
};

export const configExists = (cwd: string = process.cwd()): boolean => {
  return findConfigFile(cwd) !== null;
};

export const getConfigPath = (cwd: string = process.cwd()): string | null => {
  return findConfigFile(cwd);
};
