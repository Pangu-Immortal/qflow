import { execFile } from "node:child_process";
import { mediaProcessEnv } from "./process-env.js";

export type MediaToolchainState =
  | { readonly state: "ready"; readonly ffprobeVersion: string; readonly ffmpegVersion?: string }
  | { readonly state: "down" | "mismatch"; readonly detail: string };

function run(executable: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile(executable, [...args], {
      env,
      timeout: 15_000,
      shell: false,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve(error === null
        ? { ok: true, output: stdout.trim() }
        : { ok: false, output: (stderr.trim() || error.message).split("\n").at(-1) ?? "" });
    });
  });
}

function firstLine(value: string): string {
  return value.split(/\r?\n/u, 1)[0]?.trim() ?? "";
}

/**
 * Check availability of the selected executables in their execution environment.
 * This does not predict compatibility with every future media command: the execution
 * implementation owns those commands and reports the tool's actual failure.
 */
export async function probeMediaToolchain(options: {
  readonly ffprobePath: string;
  readonly ffmpegPath?: string;
  readonly environment?: NodeJS.ProcessEnv;
}): Promise<MediaToolchainState> {
  const env = options.environment ?? mediaProcessEnv();
  const probeVersion = await run(options.ffprobePath, ["-version"], env);
  if (!probeVersion.ok) {
    return { state: "down", detail: `${options.ffprobePath} is unavailable: ${probeVersion.output}` };
  }
  const ffprobeVersion = firstLine(probeVersion.output);
  if (ffprobeVersion.length === 0) return { state: "mismatch", detail: "ffprobe returned no version" };
  if (options.ffmpegPath === undefined) return { state: "ready", ffprobeVersion };

  const ffmpegVersionResult = await run(options.ffmpegPath, ["-version"], env);
  if (!ffmpegVersionResult.ok) {
    return { state: "down", detail: `${options.ffmpegPath} is unavailable: ${ffmpegVersionResult.output}` };
  }
  const ffmpegVersion = firstLine(ffmpegVersionResult.output);
  return ffmpegVersion.length === 0
    ? { state: "mismatch", detail: "ffmpeg returned no version" }
    : { state: "ready", ffprobeVersion, ffmpegVersion };
}
