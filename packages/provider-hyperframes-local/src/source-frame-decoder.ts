import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VideoMetadata } from "@hyperframes/engine";
import { assert, processEnvironment } from "./process.js";
import type { DecodedSourceFrame, SourceFrameWindow } from "./source-frame-store.js";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const alphaCodecs = new Set(["vp9", "vp8", "prores"]);

/** Incremental parser for concatenated PNGs from FFmpeg image2pipe. */
export class PngFrameParser {
  readonly #maxFrameBytes: number;
  #buffer = Buffer.alloc(0);
  #offset = 0;

  constructor(maxFrameBytes: number) {
    assert(Number.isSafeInteger(maxFrameBytes) && maxFrameBytes > 0, "PNG frame byte limit must be positive");
    this.#maxFrameBytes = maxFrameBytes;
  }

  push(chunk: Uint8Array): Buffer[] {
    if (chunk.byteLength === 0) return [];
    this.#buffer = this.#offset === 0
      ? Buffer.concat([this.#buffer, chunk])
      : Buffer.concat([this.#buffer.subarray(this.#offset), chunk]);
    this.#offset = 0;
    const frames: Buffer[] = [];
    while (true) {
      if (this.#buffer.length - this.#offset < pngSignature.length) break;
      assert(this.#buffer.subarray(this.#offset, this.#offset + pngSignature.length).equals(pngSignature),
        "FFmpeg source decoder emitted invalid PNG data");
      let cursor = this.#offset + pngSignature.length;
      let complete = false;
      while (this.#buffer.length - cursor >= 12) {
        const length = this.#buffer.readUInt32BE(cursor);
        const end = cursor + 12 + length;
        assert(end - this.#offset <= this.#maxFrameBytes, "FFmpeg decoded source PNG exceeds its frame byte limit");
        if (this.#buffer.length < end) break;
        const type = this.#buffer.toString("ascii", cursor + 4, cursor + 8);
        cursor = end;
        if (type !== "IEND") continue;
        frames.push(Buffer.from(this.#buffer.subarray(this.#offset, cursor)));
        this.#offset = cursor;
        complete = true;
        break;
      }
      if (!complete) break;
    }
    if (this.#offset > 0 && this.#offset === this.#buffer.length) {
      this.#buffer = Buffer.alloc(0);
      this.#offset = 0;
    } else {
      assert(this.#buffer.length - this.#offset <= this.#maxFrameBytes,
        "FFmpeg decoded source PNG exceeds its frame byte limit");
    }
    return frames;
  }

  finish(): void {
    assert(this.#buffer.length === this.#offset, "FFmpeg source decoder ended inside a PNG frame");
  }
}

export async function* decodeSourceFrameWindow(args: {
  readonly executable: string;
  readonly path: string;
  readonly outputDir: string;
  readonly outputPrefix: string;
  readonly window: Omit<SourceFrameWindow, "source">;
  readonly fps: { readonly num: number; readonly den: number };
  readonly metadata: VideoMetadata;
  readonly timeoutMs: number;
  readonly maxProcessOutputBytes: number;
  readonly signal?: AbortSignal;
}): AsyncGenerator<DecodedSourceFrame> {
  args.signal?.throwIfAborted();
  const count = args.window.endFrameExclusive - args.window.startFrame;
  assert(Number.isSafeInteger(count) && count > 0, "Source decode window is empty");
  await mkdir(args.outputDir, { recursive: true });
  const startTime = args.window.startFrame * args.fps.den / args.fps.num;
  const duration = count * args.fps.den / args.fps.num;
  const codec = args.metadata.videoCodec.toLowerCase();
  const hdr = args.metadata.colorSpace?.colorTransfer === "smpte2084"
    || args.metadata.colorSpace?.colorTransfer === "arib-std-b67";
  const ffmpegFps = `${args.fps.num}/${args.fps.den}`;
  const argv = ["-v", "error"];
  if (hdr && process.platform === "darwin") argv.push("-hwaccel", "videotoolbox");
  if (alphaCodecs.has(codec)) argv.push("-c:v", codec === "vp9" ? "libvpx-vp9" : codec === "vp8" ? "libvpx" : codec);
  if (count === 1) argv.push("-i", args.path, "-ss", String(startTime));
  else argv.push("-ss", String(startTime), "-i", args.path, "-t", String(duration));
  const filters: string[] = [];
  if (hdr && process.platform === "darwin") filters.push("format=nv12");
  if (count > 1 && !args.metadata.isVFR) filters.push(`fps=${ffmpegFps}`);
  if (filters.length > 0) argv.push("-vf", filters.join(","));
  if (count > 1 && args.metadata.isVFR) argv.push("-fps_mode", "cfr", "-r", ffmpegFps);
  argv.push("-frames:v", String(count), "-q:v", "0", "-compression_level", "1",
    "-f", "image2pipe", "-vcodec", "png", "pipe:1");

  const child = spawn(args.executable, argv, {
    shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: processEnvironment(),
  });
  let stopped: Error | undefined;
  let stderr = "";
  let stderrBytes = 0;
  let closed = false;
  const stop = (error: Error) => {
    stopped ??= error;
    if (!closed) child.kill("SIGKILL");
  };
  const abort = () => stop(args.signal?.reason instanceof Error ? args.signal.reason : new Error(String(args.signal?.reason)));
  args.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => stop(new Error(`HyperFrames source decoder timed out after ${args.timeoutMs} ms`)), args.timeoutMs);
  child.stderr!.on("data", (chunk: Buffer) => {
    stderrBytes += chunk.byteLength;
    stderr = `${stderr}${chunk.toString()}`.slice(-32_000);
    if (stderrBytes > args.maxProcessOutputBytes) stop(new Error("HyperFrames source decoder output exceeded its byte limit"));
  });
  const outcome = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => { closed = true; resolve({ code, signal }); });
  });
  const maxFrameBytes = args.metadata.width * args.metadata.height * 10 + 64 * 1024;
  assert(Number.isSafeInteger(maxFrameBytes), "HyperFrames decoded source frame limit exceeds safe arithmetic");
  const parser = new PngFrameParser(maxFrameBytes);
  let produced = 0;
  let completed = false;
  try {
    for await (const chunk of child.stdout!) {
      for (const png of parser.push(chunk)) {
        assert(produced < count, "FFmpeg source decoder emitted too many frames");
        const frame = args.window.startFrame + produced++;
        const path = join(args.outputDir, `${args.outputPrefix}-${frame}.png`);
        await writeFile(path, png);
        yield { frame, path, bytes: png.byteLength };
      }
    }
    parser.finish();
    const result = await outcome;
    if (stopped !== undefined) throw stopped;
    args.signal?.throwIfAborted();
    assert(result.code === 0, `FFmpeg source decoder exited ${result.signal ?? `code ${String(result.code)}`}: ${stderr}`);
    assert(produced === count, `HyperFrames expected ${count} source frames, decoded ${produced}`);
    completed = true;
  } finally {
    clearTimeout(timer);
    args.signal?.removeEventListener("abort", abort);
    if (!completed && !closed) child.kill("SIGKILL");
    await outcome.catch(() => {});
  }
}
