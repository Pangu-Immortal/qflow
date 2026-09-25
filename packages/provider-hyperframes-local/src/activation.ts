import { resolve } from "node:path";
import {
  createRuntimeEndpointAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
  runtimeConfigPositiveInteger,
  runtimeConfigString,
} from "@qflow/runtime-kit";
import {
  diagnoseRuntimeExecutable,
  resolveRuntimeExecutable,
} from "@qflow/runtime-host-node";

import { createLocalHyperframesProvider } from "./provider.js";
import { configuredBrowserPath, browserExecutablePath, selectedBrowserVersion } from "./browser.js";
import type { HyperframesBrowserGpu, HyperframesQuality, HyperframesWorkers } from "./provider.js";
import { localHyperframesBrowserProgram } from "./program.js";

const localHyperframesRuntimeAdapter = createRuntimeEndpointAdapterFacet({
  use: "@qflow/provider-hyperframes-local",
  activate(context) {
    if (context.pool === undefined) throw new Error("local HyperFrames Provider Pool is required");
    const config = runtimeConfigObject(context.config, "local HyperFrames");
    runtimeConfigExact(config, [
      "nodePath", "chromePath", "browserVersion", "browserCacheDirectory", "browserDownloadBaseUrl", "ffprobePath", "ffmpegPath", "workers", "maxWorkers", "quality", "browserGpu",
      "defaultConcurrency", "browserCapacity", "initializationTimeoutMs", "frameTimeoutMs", "processTimeoutMs", "maxProcessOutputBytes", "artifactStagingConcurrency", "maxPendingFrameBytes", "maxDecodedSourceBytes", "maxRenderedBytes",
    ], "local HyperFrames");
    runtimeConfigString(config.nodePath, "HyperFrames nodePath");
    runtimeConfigString(config.ffprobePath, "HyperFrames ffprobePath");
    const workers = config.workers;
    if (workers !== undefined && workers !== "auto") {
      runtimeConfigPositiveInteger(workers, "HyperFrames workers");
    }
    const quality = runtimeConfigString(config.quality, "HyperFrames quality");
    if (quality !== undefined && quality !== "draft" && quality !== "standard" && quality !== "high") {
      throw new Error("HyperFrames quality is invalid");
    }
    const browserGpu = runtimeConfigString(config.browserGpu, "HyperFrames browserGpu");
    if (browserGpu !== undefined && browserGpu !== "auto" && browserGpu !== "software" && browserGpu !== "hardware") {
      throw new Error("HyperFrames browserGpu is invalid");
    }
    const configuredNode = runtimeConfigString(config.nodePath, "HyperFrames nodePath");
    const configuredChrome = runtimeConfigString(config.chromePath, "HyperFrames chromePath");
    const browserVersion = runtimeConfigString(config.browserVersion, "HyperFrames browserVersion");
    const browserDownloadBaseUrl = runtimeConfigString(config.browserDownloadBaseUrl, "HyperFrames browserDownloadBaseUrl");
    const configuredCache = runtimeConfigString(config.browserCacheDirectory, "HyperFrames browserCacheDirectory");
    const chromePath = configuredBrowserPath({ ...(configuredChrome === undefined ? {} : {
      chromePath: resolve(context.dataRoot, configuredChrome),
    }) });
    const browser = {
      ...(browserVersion === undefined ? {} : { browserVersion }),
      ...(browserDownloadBaseUrl === undefined ? {} : { browserDownloadBaseUrl }),
      ...(chromePath === undefined ? {} : { chromePath }),
      ...(configuredCache === undefined ? {} : { browserCacheDirectory: resolve(context.dataRoot, configuredCache) }),
    };
    const configuredFfprobe = runtimeConfigString(config.ffprobePath, "HyperFrames ffprobePath");
    const nodePath = resolveRuntimeExecutable(context.dataRoot, configuredNode ?? process.execPath);
    const configuredFfmpeg = runtimeConfigString(config.ffmpegPath, "HyperFrames ffmpegPath");
    const ffmpegPath = resolveRuntimeExecutable(context.dataRoot, configuredFfmpeg ?? "ffmpeg");
    const ffprobePath = resolveRuntimeExecutable(context.dataRoot, configuredFfprobe ?? "ffprobe");
    const defaultConcurrency = runtimeConfigPositiveInteger(config.defaultConcurrency, "HyperFrames defaultConcurrency");
    const maxWorkers = runtimeConfigPositiveInteger(config.maxWorkers, "HyperFrames maxWorkers");
    const browserCapacity = runtimeConfigPositiveInteger(config.browserCapacity, "HyperFrames browserCapacity");
    const initializationTimeoutMs = runtimeConfigPositiveInteger(config.initializationTimeoutMs, "HyperFrames initializationTimeoutMs");
    const frameTimeoutMs = runtimeConfigPositiveInteger(config.frameTimeoutMs, "HyperFrames frameTimeoutMs");
    const processTimeoutMs = runtimeConfigPositiveInteger(config.processTimeoutMs, "HyperFrames processTimeoutMs");
    const maxProcessOutputBytes = runtimeConfigPositiveInteger(config.maxProcessOutputBytes, "HyperFrames maxProcessOutputBytes");
    const artifactStagingConcurrency = runtimeConfigPositiveInteger(config.artifactStagingConcurrency, "HyperFrames artifactStagingConcurrency");
    const maxPendingFrameBytes = runtimeConfigPositiveInteger(config.maxPendingFrameBytes, "HyperFrames maxPendingFrameBytes");
    const maxDecodedSourceBytes = runtimeConfigPositiveInteger(config.maxDecodedSourceBytes, "HyperFrames maxDecodedSourceBytes");
    const maxRenderedBytes = runtimeConfigPositiveInteger(config.maxRenderedBytes, "HyperFrames maxRenderedBytes");
    return {
      endpoint: createLocalHyperframesProvider({
        instance: context.instance,
        pool: context.pool,
        nodePath,
        ...browser,
        ffprobePath,
        ffmpegPath,
        ...(workers === undefined ? {} : { workers: workers as HyperframesWorkers }),
        ...(maxWorkers === undefined ? {} : { maxWorkers }),
        ...(quality === undefined ? {} : { quality: quality as HyperframesQuality }),
        ...(browserGpu === undefined ? {} : { browserGpu: browserGpu as HyperframesBrowserGpu }),
        ...(defaultConcurrency === undefined ? {} : { defaultConcurrency }),
        ...(browserCapacity === undefined ? {} : { browserCapacity }),
        ...(initializationTimeoutMs === undefined ? {} : { initializationTimeoutMs }),
        ...(frameTimeoutMs === undefined ? {} : { frameTimeoutMs }),
        ...(processTimeoutMs === undefined ? {} : { processTimeoutMs }),
        ...(maxProcessOutputBytes === undefined ? {} : { maxProcessOutputBytes }),
        ...(artifactStagingConcurrency === undefined ? {} : { artifactStagingConcurrency }),
        ...(maxPendingFrameBytes === undefined ? {} : { maxPendingFrameBytes }),
        ...(maxDecodedSourceBytes === undefined ? {} : { maxDecodedSourceBytes }),
        ...(maxRenderedBytes === undefined ? {} : { maxRenderedBytes }),
      }),
      program: localHyperframesBrowserProgram({
        id: context.instance,
        nodePath,
        ...browser,
        ffprobePath,
        ffmpegPath,
      }),
      diagnose: async () => [
        { severity: "info", code: "HYPERFRAMES_BROWSER_SELECTION", subject: context.instance,
          message: `${chromePath === undefined ? `Managed Chrome Headless Shell ${selectedBrowserVersion(browser)} (${browserVersion === undefined ? "Provider recommendation" : "Profile version"})` : "Profile browser"}: ${browserExecutablePath(browser)}` },
        ...await diagnoseRuntimeExecutable({ root: context.dataRoot, configured: configuredFfmpeg, fallback: "ffmpeg", subject: "FFmpeg" }),
        ...await diagnoseRuntimeExecutable({
          root: context.dataRoot,
          configured: configuredNode,
          fallback: process.execPath,
          subject: "Node.js",
        }),
        ...await diagnoseRuntimeExecutable({
          root: context.dataRoot,
          configured: configuredFfprobe,
          fallback: "ffprobe",
          subject: "FFprobe",
        }),
      ],
    };
  },
});

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [localHyperframesRuntimeAdapter],
};

export default qflowPackage;
