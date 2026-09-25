export type HyperframesWorkers = number | "auto";
export type HyperframesQuality = "draft" | "standard" | "high";
export type HyperframesBrowserGpu = "auto" | "software" | "hardware";

export type HyperframesExecutionOptions = import("./browser.js").BrowserOptions & {
  readonly ffprobePath?: string;
  /** Selected FFmpeg command for both source extraction and final H.264 encoding. */
  readonly ffmpegPath?: string;
  /** Parallel Chrome workers inside one render. This is separate from Provider request concurrency. */
  readonly workers?: HyperframesWorkers;
  /** Upper bound for auto's browser reservation; explicit workers remain fixed. */
  readonly maxWorkers?: number;
  readonly quality?: HyperframesQuality;
  /** Chrome's rasterizer, default hardware. Use software without a usable GPU. */
  readonly browserGpu?: HyperframesBrowserGpu;
  readonly processTimeoutMs?: number;
  readonly initializationTimeoutMs?: number;
  readonly frameTimeoutMs?: number;
  readonly maxProcessOutputBytes?: number;
  /** Artifact staging lifecycles in flight inside one render. */
  readonly artifactStagingConcurrency?: number;
  /** Bytes of completed, out-of-order PNGs retained while an MP4 waits for its next frame. */
  readonly maxPendingFrameBytes?: number;
  /** Bytes of decoded source PNGs resident in one render's reusable working set. */
  readonly maxDecodedSourceBytes?: number;
  readonly maxRenderedBytes?: number;
};
