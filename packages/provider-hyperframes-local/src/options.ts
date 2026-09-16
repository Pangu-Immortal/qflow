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
  readonly maxRenderedBytes?: number;
};
