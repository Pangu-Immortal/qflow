import { spawn } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, isAbsolute, resolve } from "node:path";

type ProcessResult = {
  readonly stdout: Uint8Array;
  readonly stderr: string;
};

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function positiveInteger(value: number, subject: string): number {
  assert(Number.isSafeInteger(value) && value > 0, `${subject} must be a positive integer`);
  return value;
}

/** The engine's binary override requires a path; resolve our selected command without its fallback search. */
export async function mediaExecutablePath(value: string): Promise<string> {
  const pathLike = isAbsolute(value) || value.includes("/") || value.includes("\\");
  const bases = pathLike ? [resolve(value)]
    : (process.env.PATH ?? "").split(delimiter).filter(Boolean).map(directory => resolve(directory, value));
  const extensions = process.platform === "win32" && !/\.[^\\/]+$/u.test(value) ? [".exe", ".com", ""] : [""];
  for (const base of bases) for (const extension of extensions) {
    const candidate = `${base}${extension}`;
    try {
      if (!(await stat(candidate)).isFile()) continue;
      await access(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      return candidate;
    } catch (error) {
      if (!["ENOENT", "ENOTDIR", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    }
  }
  throw new Error(`HyperFrames media executable ${value} is unavailable; correct the Provider's ffmpegPath or ffprobePath.`);
}

function processEnvironment(): NodeJS.ProcessEnv {
  const names = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL"] as const;
  return Object.fromEntries(names.flatMap((name) => process.env[name] === undefined
    ? []
    : [[name, process.env[name]]])) as NodeJS.ProcessEnv;
}

export async function runProcess(args: {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly signal?: AbortSignal;
}): Promise<ProcessResult> {
  args.signal?.throwIfAborted();
  return await new Promise((resolve, reject) => {
    const child = spawn(args.executable, [...args.argv], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: processEnvironment(),
    });
    const stdout: Buffer[] = [];
    let outputBytes = 0;
    let stderr = "";
    let settled = false;
    let failure: Error | undefined;
    const stop = (error: Error) => {
      failure ??= error;
      child.kill("SIGKILL");
    };
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      args.signal?.removeEventListener("abort", abort);
      if (error === undefined) resolve({ stdout: Buffer.concat(stdout), stderr });
      else reject(error);
    };
    const abort = () => stop(args.signal?.reason ?? new Error("Process aborted"));
    args.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      stop(new Error(`${args.executable} timed out`));
    }, args.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > args.maxOutputBytes) {
        stop(new Error(`${args.executable} output exceeded the configured limit`));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      stderr = `${stderr}${chunk.toString()}`.slice(-32_000);
      if (outputBytes > args.maxOutputBytes) {
        stop(new Error(`${args.executable} output exceeded the configured limit`));
      }
    });
    child.on("error", (error) => finish(error));
    if (args.signal?.aborted) abort();
    child.on("close", (code) => {
      if (failure !== undefined) finish(failure);
      else if (code === 0) finish();
      else finish(new Error(`${args.executable} exited ${String(code)}: ${stderr}`));
    });
  });
}
