export {
  loadConfig,
  validateConfig,
  configExists,
  getConfigPath,
  type LoadConfigOptions,
} from "./loader.js";
export {
  ConfigSchema,
  GitHubConfigSchema,
  FixConfigSchema,
  type ParsedConfig,
} from "./schema.js";
export {
  DEFAULT_CONFIG,
  DEFAULT_BOT_AUTHORS,
  DEFAULT_COMMIT_TEMPLATE,
} from "./defaults.js";
