import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EndpointInvocationContext } from "@qflow/endpoint-kit";
import { stageHyperframesProject } from "@qflow/hyperframes/project";
import { sealRenderedVisual } from "@qflow/media";
import type { MediaFrameRange, RenderedVisual } from "@qflow/media";
import { verifyCompositableSurfaceFile } from "@qflow/media-execution";
import { verifyHyperframesVisualRequest } from "@qflow/render-hyperframes";
import type { HyperframesVisualRequest } from "@qflow/render-hyperframes";
import { isStreamingResourceStore } from "@qflow/runtime";
import type { HyperframesExecutionOptions } from "./options.js";
import { assert, positiveInteger } from "./process.js";
import { runCaptureProcess } from "./capture-process.js";
import { finished } from "node:stream/promises";
import { autoWorkerLimit } from "./concurrency.js";
import { browserCacheDirectory, browserExecutablePath, configuredBrowserPath, requireBrowserExecutable, selectedBrowserVersion } from "./browser.js";

export type HyperframesRenderProgress =
  | { readonly phase: "staging" | "encoding" | "storing"; readonly elapsedMs: number }
  | { readonly phase: "decoding"; readonly completed: number; readonly total: number; readonly elapsedMs: number }
  | { readonly phase: "worker-progress"; readonly worker: number; readonly completed: number; readonly elapsedMs: number }
  | { readonly phase: "prepared"; readonly workers: number; readonly sourceFrames: number; readonly elapsedMs: number }
  | { readonly phase: "worker-initializing" | "worker-start"; readonly worker: number; readonly range: MediaFrameRange;
      readonly browserPid: number | undefined; readonly elapsedMs: number }
  | { readonly phase: "worker-complete"; readonly worker: number; readonly completed: number;
      readonly browserPid: number | undefined; readonly elapsedMs: number }
  | { readonly phase: "complete"; readonly frames: number; readonly elapsedMs: number };

export type RenderHyperframesVisualOptions = HyperframesExecutionOptions & {
  readonly resources: EndpointInvocationContext["resources"];
  readonly signal?: AbortSignal;
  readonly onDiagnostic?: (diagnostic: import("@qflow/runtime").ExecutionDiagnostic) => Promise<void>;
  readonly onProgress?: (event: HyperframesRenderProgress) => void;
};

export function resolveExecutionOptions(options: HyperframesExecutionOptions) {
  const workers = options.workers ?? "auto";
  assert(workers === "auto" || (Number.isSafeInteger(workers) && workers > 0),
    "workers must be auto or a positive safe integer");
  const quality = options.quality ?? "standard";
  assert(["draft", "standard", "high"].includes(quality), "HyperFrames quality is invalid");
  const browserGpu = options.browserGpu ?? "hardware";
  assert(["auto", "software", "hardware"].includes(browserGpu), "HyperFrames browserGpu is invalid");
  return {
    chromePath: configuredBrowserPath(options),
    browserVersion: selectedBrowserVersion(options),
    browserCacheDirectory: browserCacheDirectory(options),
    workers,
    maxWorkers: workers === "auto" ? positiveInteger(options.maxWorkers ?? autoWorkerLimit(), "maxWorkers") : workers,
    quality, browserGpu,
    ffmpegPath: options.ffmpegPath ?? "ffmpeg",
    ffprobePath: options.ffprobePath ?? "ffprobe",
    initializationTimeoutMs: options.initializationTimeoutMs === undefined
      ? undefined
      : positiveInteger(options.initializationTimeoutMs, "initializationTimeoutMs"),
    frameTimeoutMs: options.frameTimeoutMs === undefined
      ? undefined
      : positiveInteger(options.frameTimeoutMs, "frameTimeoutMs"),
    processTimeoutMs: positiveInteger(options.processTimeoutMs ?? 30 * 60_000, "processTimeoutMs"),
    maxProcessOutputBytes: positiveInteger(options.maxProcessOutputBytes ?? 4 * 1024 * 1024, "maxProcessOutputBytes"),
    maxRenderedBytes: positiveInteger(options.maxRenderedBytes ?? 16 * 1024 * 1024 * 1024, "maxRenderedBytes"),
  };
}

/** Same deterministic reservation for Runtime admission and the capture attempt. */
export function renderWorkerLimit(config: ReturnType<typeof resolveExecutionOptions>, frameCount: number, fps: number): number {
  return Math.min(config.maxWorkers, config.workers === "auto" ? Math.max(1, Math.ceil(frameCount / fps)) : frameCount);
}

/** Execute one attempt. Its deadline includes resource preparation and output storage. */
export async function renderHyperframesVisual(
  request: HyperframesVisualRequest,
  options: RenderHyperframesVisualOptions,
): Promise<RenderedVisual> {
  verifyHyperframesVisualRequest(request);
  const config = { ...resolveExecutionOptions(options), chromePath: browserExecutablePath(options) };
  const { document } = request;
  const range = request.range ?? { startFrame: 0, endFrameExclusive: document.frameCount };
  const frameCount = range.endFrameExclusive - range.startFrame;
  const controller = new AbortController();
  const signal = options.signal === undefined ? controller.signal : AbortSignal.any([controller.signal, options.signal]);
  const started = performance.now();
  let phaseStarted = started;
  let phase = "preparing resources";
  const timer = setTimeout(() => controller.abort(new Error(`HyperFrames render timed out during ${phase}`)), config.processTimeoutMs);
  let work: string | undefined;
  const diagnostics: Promise<void>[] = [];
  const diagnostic = (message: string) => {
    if (options.onDiagnostic === undefined) return;
    const pending = options.onDiagnostic({ level: "info", message });
    diagnostics.push(pending);
    void pending.catch(() => {});
  };
  const changePhase = (next: string) => {
    const now = performance.now();
    diagnostic(`${phase}: ${Math.round(now - phaseStarted)} ms`);
    phaseStarted = now;
    phase = next;
  };
  try {
    signal.throwIfAborted();
    await requireBrowserExecutable(config.chromePath, config.browserVersion);
    await options.onDiagnostic?.({ level: "info", message:
      `Render ${frameCount} frames; workers ${config.workers} (limit ${renderWorkerLimit(config, frameCount, document.frameRate.numerator / document.frameRate.denominator)}); opaque fast PNG; quality ${config.quality}; GPU ${config.browserGpu}; browser ${config.chromePath}; encoder ${config.ffmpegPath}` });
    options.onProgress?.({ phase: "staging", elapsedMs: 0 });
    work = await mkdtemp(join(tmpdir(), "qflow-hyperframes-local-"));
    await stageHyperframesProject({ document, directory: work, signal,
      read: async (artifact, readSignal) => {
        const io = { signal: readSignal! };
        const bytes = isStreamingResourceStore(options.resources)
          ? await options.resources.open(artifact.resource, io) : await options.resources.get(artifact.resource, io);
        assert(bytes !== undefined, `HyperFrames Artifact ${artifact.resource} is unavailable`);
        return bytes;
      },
      validateSurface: (surface, path, probeSignal) => verifyCompositableSurfaceFile({ surface, path,
        ffprobePath: config.ffprobePath, processTimeoutMs: config.processTimeoutMs,
        maxProbeOutputBytes: config.maxProcessOutputBytes, signal: probeSignal! }),
    });
    changePhase("decoding source frames");
    await runCaptureProcess({ document, range, config, directory: work,
      engineModule: import.meta.resolve("@hyperframes/engine"),
      producerModule: import.meta.resolve("@hyperframes/producer"),
    }, signal, (event) => {
      if (event.phase === "prepared") changePhase("starting browsers");
      if (event.phase === "worker-start" && phase === "starting browsers") changePhase("capturing frames");
      if (event.phase === "encoding") changePhase("encoding and verifying video");
      options.onProgress?.({ ...event, elapsedMs: Math.round(performance.now() - started) });
    },
      undefined, options.onDiagnostic);
    signal.throwIfAborted();
    changePhase("storing output");
    options.onProgress?.({ phase: "storing", elapsedMs: Math.round(performance.now() - started) });
    const output = join(work, "visual.mp4");
    let artifact;
    if (isStreamingResourceStore(options.resources)) {
      const stream = createReadStream(output, { signal });
      const closed = finished(stream).catch(() => {});
      try { artifact = await options.resources.putStream(stream, "video/mp4", { signal }); }
      finally { stream.destroy(); await closed; }
    } else {
      artifact = await options.resources.put(await readFile(output, { signal }), "video/mp4", { signal });
    }
    signal.throwIfAborted();

    changePhase("complete");
    await Promise.all(diagnostics);
    options.onProgress?.({ phase: "complete", frames: frameCount, elapsedMs: Math.round(performance.now() - started) });
    return sealRenderedVisual({ frameRate: document.frameRate, frameCount, canvas: document.canvas, artifact });
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    controller.abort(error);
    throw error;
  } finally {
    clearTimeout(timer);
    if (work !== undefined) await rm(work, { recursive: true, force: true });
    await Promise.all(diagnostics);
  }
}
