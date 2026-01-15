type LogLevel = "debug" | "info" | "warn" | "error";

type LoggerOptions = {
  level: LogLevel;
  prefix?: string;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

let globalLevel: LogLevel = "info";

export const setLogLevel = (level: LogLevel): void => {
  globalLevel = level;
};

export const createLogger = (options: Partial<LoggerOptions> = {}) => {
  const { prefix = "bugfixbot" } = options;

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= LOG_LEVELS[globalLevel];
  };

  const formatMessage = (level: LogLevel, message: string): string => {
    const timestamp = new Date().toISOString().slice(11, 19);
    const color = LOG_COLORS[level];
    const levelStr = level.toUpperCase().padEnd(5);
    return `${color}${timestamp}${RESET} ${BOLD}[${prefix}]${RESET} ${color}${levelStr}${RESET} ${message}`;
  };

  return {
    debug: (message: string, ...args: unknown[]): void => {
      if (shouldLog("debug")) {
        console.log(formatMessage("debug", message), ...args);
      }
    },

    info: (message: string, ...args: unknown[]): void => {
      if (shouldLog("info")) {
        console.log(formatMessage("info", message), ...args);
      }
    },

    warn: (message: string, ...args: unknown[]): void => {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", message), ...args);
      }
    },

    error: (message: string, ...args: unknown[]): void => {
      if (shouldLog("error")) {
        console.error(formatMessage("error", message), ...args);
      }
    },

    success: (message: string): void => {
      if (shouldLog("info")) {
        console.log(`\x1b[32m✓${RESET} ${message}`);
      }
    },

    step: (message: string): void => {
      if (shouldLog("info")) {
        console.log(`\x1b[34m→${RESET} ${message}`);
      }
    },
  };
};

export const logger = createLogger();
