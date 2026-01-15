import { z } from "zod";

export const AuthMethodSchema = z.enum(["gh", "token", "env"]);

export const FixEngineSchema = z.enum(["cursor-cli", "cursor-command"]);

export const GitHubConfigSchema = z.object({
  repo: z.string().optional(),
  pr: z.number().optional(),
  auth: AuthMethodSchema.default("env"),
  token: z.string().optional(),
  botAuthors: z
    .array(z.string())
    .default(["cursor-bot", "bugbot", "cursor[bot]"]),
});

export const FixConfigSchema = z.object({
  engine: FixEngineSchema.default("cursor-cli"),
  command: z.string().optional(),
  instructions: z.string().optional(),
});

export const VerificationConfigSchema = z.object({
  commands: z.array(z.string()).default([]),
  timeout: z.number().default(300000),
  stopOnFailure: z.boolean().default(true),
});

export const GuardrailsConfigSchema = z.object({
  maxCycles: z.number().default(5),
  maxFilesPerCycle: z.number().default(10),
  maxLinesPerCycle: z.number().default(500),
  requireApprovalAbove: z.number().default(10),
  pollIntervalMs: z.number().default(30000),
  backoffMultiplier: z.number().default(1.5),
});

export const GitConfigSchema = z.object({
  commitTemplate: z
    .string()
    .default("chore(bugbot): fix review findings [cycle {cycle}]"),
  autoRebase: z.boolean().default(false),
  pushForce: z.boolean().default(false),
});

export const ConfigSchema = z.object({
  github: GitHubConfigSchema.default({}),
  fix: FixConfigSchema.default({}),
  verification: VerificationConfigSchema.default({}),
  guardrails: GuardrailsConfigSchema.default({}),
  git: GitConfigSchema.default({}),
});

export type ParsedConfig = z.infer<typeof ConfigSchema>;
