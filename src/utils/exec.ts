import { spawn } from 'node:child_process';

export type ExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type ExecOptions = {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
};

export const exec = async (
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> => {
  const { cwd = process.cwd(), timeout = 300000, env } = options;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeoutId = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
    }, timeout);

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (killed) {
        resolve({
          exitCode: 124,
          stdout,
          stderr: stderr + '\nProcess timed out',
          durationMs,
        });
      } else {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          durationMs,
        });
      }
    });
  });
};

export const execShell = async (
  command: string,
  options: ExecOptions = {}
): Promise<ExecResult> => {
  const { cwd = process.cwd(), timeout = 300000, env } = options;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(command, [], {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeoutId = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
    }, timeout);

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (killed) {
        resolve({
          exitCode: 124,
          stdout,
          stderr: stderr + '\nProcess timed out',
          durationMs,
        });
      } else {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          durationMs,
        });
      }
    });
  });
};
