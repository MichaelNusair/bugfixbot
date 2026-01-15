import type { FixTask } from '../types/index.js';
import type { PromptContext } from './types.js';

const formatTask = (task: FixTask, index: number): string => {
  const lines: string[] = [];

  lines.push(`## Fix ${index + 1}: ${task.filePath}:${task.lineStart}`);

  if (task.lineEnd !== task.lineStart) {
    lines[0] = `## Fix ${index + 1}: ${task.filePath}:${task.lineStart}-${task.lineEnd}`;
  }

  lines.push('');
  lines.push('> ' + task.body.split('\n').join('\n> '));

  if (task.diffHunk) {
    lines.push('');
    lines.push('Context from diff:');
    lines.push('```diff');
    lines.push(task.diffHunk);
    lines.push('```');
  }

  return lines.join('\n');
};

const DEFAULT_INSTRUCTIONS = `
- Make minimal changes to address the review comments
- Do not change public APIs unless specifically requested
- Update tests if behavior changes
- If a fix is unclear or requires architectural decisions, leave a TODO comment and note it
- Preserve existing code style and conventions
`.trim();

export const buildPrompt = (context: PromptContext): string => {
  const { tasks, instructions } = context;

  const lines: string[] = [];

  lines.push('Apply the following fixes to the codebase:');
  lines.push('');

  for (let i = 0; i < tasks.length; i++) {
    lines.push(formatTask(tasks[i], i));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('Instructions:');
  lines.push(instructions ?? DEFAULT_INSTRUCTIONS);

  return lines.join('\n');
};

export const buildCompactPrompt = (context: PromptContext): string => {
  const { tasks, instructions } = context;

  const fixes = tasks.map((task, i) => {
    const location = `${task.filePath}:${task.lineStart}`;
    return `${i + 1}. [${location}] ${task.body.split('\n')[0]}`;
  });

  return `Fix these review comments:\n${fixes.join('\n')}\n\n${instructions ?? DEFAULT_INSTRUCTIONS}`;
};

export const estimateTokens = (prompt: string): number => {
  // Rough estimation: ~4 characters per token
  return Math.ceil(prompt.length / 4);
};
