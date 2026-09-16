import type { ExecutionDiagnostic } from "@qflow/runtime";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import type { CaptureInput } from "./capture.js";
import type { HyperframesRenderProgress } from "./render.js";

const exec = promisify(execFile);
const cleanupMs = 5_000;

/** Chrome starts its own process group, so stopping only the Node child is insufficient. */
async function killRenderTree(pid: number): Promise<void> {
  if (process.platform === "win32") {
    try {
      await exec("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, timeout: cleanupMs });
    } catch (error) {
      // The worker may exit after reporting completion, before taskkill opens it.
      // Ask the OS whether it is gone; localized taskkill output is not an API.
      try { process.kill(pid, 0); }
      catch (probeError) {
        if ((probeError as NodeJS.ErrnoException).code === "ESRCH") return;
      }
      throw error;
    }
    return;
  }
  const descendants = [pid];
  for (let i = 0; i < descendants.length; i++) {
    const children = await exec("pgrep", ["-P", String(descendants[i])], { timeout: cleanupMs })
      .then(({ stdout }) => stdout.trim().split(/\s+/u).filter(Boolean).map(Number),
        (error) => { if ((error as { code?: unknown }).code === 1) return []; throw error; });
    for (const child of children) if (!descendants.includes(child)) descendants.push(child);
  }
  // Kill the whole tree before waiting: only after every ancestor is dead are
  // orphaned descendants reparented and reaped, making kill(pid, 0) read ESRCH.
  for (const child of descendants.reverse()) {
    for (const target of [-child, child]) {
      try { process.kill(target, "SIGKILL"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    }
  }
  const deadline = Date.now() + cleanupMs;
  let remaining = descendants;
  while (remaining.length > 0) {
    remaining = remaining.filter((child) => {
      try { process.kill(child, 0); return true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
    });
    if (remaining.length === 0) break;
    if (Date.now() >= deadline) throw new Error(`Render process ${remaining[0]} did not stop after SIGKILL`);
    await delay(20);
  }
}

/** One disposable execution, with no persisted state or resubmission behavior. */
export async function runCaptureProcess(
  input: CaptureInput,
  signal: AbortSignal,
  onProgress: (event: HyperframesRenderProgress) => void,
  entry = new URL("./capture-worker.ts", import.meta.url),
  onDiagnostic?: (diagnostic: ExecutionDiagnostic) => Promise<void>,
): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    // The launcher's resolver hooks are process-local, so this child preloads the same
    // environment before it imports any package the Distribution owns.
    const child = spawn(process.execPath, [
      "--import", import.meta.resolve("tsx"),
      "--import", new URL("./capture-bootstrap.ts", import.meta.url).href,
      fileURLToPath(entry),
    ], {
      detached: process.platform !== "win32", windowsHide: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    let failure: Error | undefined;
    let completed = false;
    let closed = false;
    let outputBytes = 0;
    let stderr = "";
    let diagnostics = Promise.resolve();
    let grace: ReturnType<typeof setTimeout> | undefined;
    let killing: Promise<void> | undefined;
    const kill = () => {
      if (grace !== undefined) clearTimeout(grace);
      killing ??= (child.pid === undefined ? Promise.resolve() : killRenderTree(child.pid)).catch((error) => {
        if (!completed) failure = new Error(`${failure?.message ?? "Render cleanup failed"}; ${String(error)}`);
        diagnostic({ level: "warning", message: `Render process-tree cleanup could not be confirmed: ${String(error)}` });
        child.kill("SIGKILL");
      });
      return killing;
    };
    const stop = (error: Error) => {
      failure ??= error;
      if (closed) return;
      if (child.connected) child.send({ type: "abort", error: failure.message }, () => {});
      awaitExit();
    };
    const diagnostic = (value: ExecutionDiagnostic) => {
      if (onDiagnostic === undefined) return;
      diagnostics = diagnostics.then(() => onDiagnostic(value))
        .catch((error) => stop(error instanceof Error ? error : new Error(String(error))));
    };
    const awaitExit = () => {
      grace ??= setTimeout(() => {
        diagnostic({ level: "warning", message: `Render process did not exit within ${cleanupMs} ms; terminating its remaining process tree` });
        void kill();
      }, cleanupMs);
    };
    const abort = () => stop(signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason)));
    signal.addEventListener("abort", abort, { once: true });
    const log = (chunk: Buffer, error: boolean) => {
      outputBytes += chunk.byteLength;
      if (error) stderr = `${stderr}${chunk.toString()}`.slice(-32_000);
      if (outputBytes > input.config.maxProcessOutputBytes) stop(new Error("HyperFrames process output exceeded the configured limit"));
    };
    for (const [stream, pipe] of [["stdout", child.stdout], ["stderr", child.stderr]] as const) {
      pipe?.setEncoding("utf8");
      pipe?.on("data", (text: string) => {
        log(Buffer.from(text), stream === "stderr");
        if (text.trim()) diagnostic({ stream, level: "info", message: text.trimEnd() });
      });
    }
    child.on("message", (value: { type: string; event?: HyperframesRenderProgress; error?: string }) => {
      if (value.type === "progress" && value.event !== undefined) {
        try { onProgress(value.event); } catch (error) { stop(error instanceof Error ? error : new Error(String(error))); }
      } else if (value.type === "stopping") {
        stop(new Error(value.error));
      } else if (value.type === "completed" || value.type === "failed") {
        completed = value.type === "completed";
        if (completed) {
          // Successful capture has closed its resources and will disconnect after this message.
          awaitExit();
        } else {
          failure ??= new Error(value.error);
          // Resource cleanup may itself have failed. Keep the worker alive until
          // its remaining descendants have been discovered and terminated.
          void kill();
        }
      }
    });
    child.on("error", (error) => { failure ??= error; void kill(); });
    child.on("close", () => {
      closed = true;
      if (grace !== undefined) clearTimeout(grace);
      signal.removeEventListener("abort", abort);
      void (killing ?? Promise.resolve()).then(async () => {
        await diagnostics;
        if (failure !== undefined) reject(failure);
        else if (!completed) reject(new Error(`HyperFrames process exited before completion: ${stderr}`));
        else resolve();
      });
    });
    child.send({ type: "start", input }, (error) => { if (error) { failure ??= error; void kill(); } });
    if (signal.aborted) abort();
  });
}
