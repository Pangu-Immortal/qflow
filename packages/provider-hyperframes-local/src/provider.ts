import { defineEndpointPackage } from "@qflow/endpoint-kit";
import { mediaTypes } from "@qflow/media";
import { renderHyperframesCapabilities, verifyHyperframesVisualRequest } from "@qflow/render-hyperframes";
import { canonicalize } from "@qflow/protocol";
import { resolveNodePackageExecutable } from "@qflow/package-loader-node";
import { renderHyperframesVisual, resolveExecutionOptions, renderWorkerLimit } from "./render.js";
import type { HyperframesExecutionOptions } from "./options.js";
import { renderProgressReporter } from "./progress.js";

export type * from "./options.js";
export const localHyperframesProviderModuleRef = { name: "@qflow/provider-hyperframes-local", version: "1" } as const;
export type CreateLocalHyperframesProviderOptions = HyperframesExecutionOptions & {
  readonly instance?: string;
  readonly pool?: string;
  /** Used by managed browser installation, not frame capture. */
  readonly nodePath?: string;
  readonly hyperframesCliPath?: string;
  /** Whole render requests admitted concurrently; independent of frame workers. */
  readonly defaultConcurrency?: number;
  /** Shared Chrome slots across Need executions using this pool. */
  readonly browserCapacity?: number;
};

export function defaultHyperframesCliPath(): string {
  return resolveNodePackageExecutable("hyperframes", "hyperframes", { from: import.meta.url });
}

export function createLocalHyperframesProvider(config: CreateLocalHyperframesProviderOptions) {
  const execution = resolveExecutionOptions(config);
  const pool = config.pool ?? config.instance ?? "hyperframes.local";
  const browsers = `capacity:${pool}/browsers`;
  if (config.browserCapacity !== undefined && (!Number.isSafeInteger(config.browserCapacity) || config.browserCapacity < 1)) {
    throw new Error("HyperFrames browserCapacity must be a positive integer");
  }
  const maxWorkers = execution.workers === "auto" ? Math.min(execution.maxWorkers, config.browserCapacity ?? Infinity) : execution.maxWorkers;
  const reserved = { ...execution, maxWorkers };
  return defineEndpointPackage({
    module: localHyperframesProviderModuleRef,
    facet: "render",
    instance: config.instance ?? "hyperframes.local",
    pool,
    pricing: { kind: "local" },
    defaultConcurrency: config.defaultConcurrency ?? 1,
    capabilities: [{
      lifecycle: "immediate" as const,
      capability: renderHyperframesCapabilities.renderVisual,
      returns: mediaTypes.renderedVisual,
      ...(config.browserCapacity === undefined ? {} : {
        resources: [{ id: browsers, limit: config.browserCapacity }],
        unitsForRequest: (request: import("@qflow/endpoint-kit").EndpointRequest) => {
          verifyHyperframesVisualRequest(request.constraints);
          const { document, range } = request.constraints;
          return { [browsers]: renderWorkerLimit(reserved,
            range === undefined ? document.frameCount : range.endFrameExclusive - range.startFrame,
            document.frameRate.numerator / document.frameRate.denominator) };
        },
      }),
      handler: async (context) => {
        const request = context.need.constraints;
        verifyHyperframesVisualRequest(request);
        const frameCount = request.range === undefined ? request.document.frameCount
          : request.range.endFrameExclusive - request.range.startFrame;
        const progress = renderProgressReporter(context.reportProgress, frameCount);
        try {
          const visual = await renderHyperframesVisual(request, { ...config, workers: execution.workers, maxWorkers,
            resources: context.resources, onProgress: progress.onProgress,
            ...(context.reportDiagnostic === undefined ? {} : { onDiagnostic: context.reportDiagnostic }) });
          return { value: { kind: "inline", value: canonicalize(visual) } };
        } finally {
          await progress.flush();
        }
      },
    }],
  });
}
