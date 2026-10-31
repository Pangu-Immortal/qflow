import {
  compileWireRequest,
  selectWireModelForRequest,
  generationTypes,
  sealGeneratedVideoSet,
} from "@qflow/generation";
import type { GenerationArtifactUrlResolver, GenerationRequest, GenerationWireMapping } from "@qflow/generation";
import { canonicalize } from "@qflow/qflow/protocol";
import type { BlobRef, CapabilityRef, CanonicalValue, StoredValue, TypeRef } from "@qflow/qflow/protocol";
import type { EndpointRequest, EndpointSupport } from "@qflow/qflow/endpoint";
import { dashScopeMappings } from "./mapping.js";

export type DashScopePreparedRequest = {
  readonly model: string;
  readonly compile: (resolve: GenerationArtifactUrlResolver) => Promise<Record<string, unknown>>;
};

const MB = 1_000_000;

/** DashScope accepts inline media as data URLs inside a 100 MB request body. */
export const dashScopeMediaLimits = {
  image: 20 * MB,
  audio: 15 * MB,
  body: 100 * MB,
} as const;

export type DashScopeRoute = GenerationWireMapping & {
  readonly key: string;
  readonly returns: TypeRef;
  readonly supports: (request: EndpointRequest) => EndpointSupport;
  readonly prepare: (constraints: CanonicalValue) => DashScopePreparedRequest;
  readonly packageResult: (artifacts: readonly BlobRef[]) => StoredValue;
};

function scalar(request: GenerationRequest, port: string): string | number | boolean | undefined {
  const value = request.ports[port]?.[0];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined;
}
function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function rejection(mapping: GenerationWireMapping, request: GenerationRequest): string | undefined {
  const images = request.ports.images?.length ?? 0;
  const audios = request.ports.audios?.length ?? 0;
  if (images > 0 && audios > 0 && scalar(request, "audio") !== true) {
    return "DashScope voice references need the model's own synchronized track: set audio to true";
  }
  return undefined;
}

/** Fold the flat media arrays into DashScope's typed `input.media` items. */
function wanVideoBody(model: string, input: Record<string, unknown>): Record<string, unknown> {
  const media = [
    ...strings(input.reference_image).map((url) => ({ type: "reference_image", url })),
    ...strings(input.reference_audio).map((url) => ({ type: "reference_audio", url })),
  ];
  const parameters: Record<string, unknown> = {
    resolution: input.resolution,
    ratio: input.ratio,
    duration: input.duration,
    watermark: input.watermark,
    audio: input.audio,
    prompt_extend: input.prompt_extend,
    ...(typeof input.seed === "number" ? { seed: input.seed } : {}),
  };
  return {
    model,
    input: { prompt: input.prompt, ...(media.length > 0 ? { media } : {}) },
    parameters,
  };
}

function capabilityKey(capability: CapabilityRef): string {
  return `${capability.module.name}@${capability.module.version}#${capability.name}`;
}

export const dashScopeRoutes: readonly DashScopeRoute[] = dashScopeMappings.map((mapping) => ({
  ...mapping,
  key: capabilityKey(mapping.capability),
  returns: generationTypes.videoSet,
  supports: (request) => {
    const reason = rejection(mapping, request.constraints as unknown as GenerationRequest);
    return reason === undefined ? { status: "supported" } : { status: "unsupported", reason };
  },
  prepare: (constraints) => {
    const request = constraints as unknown as GenerationRequest;
    const reason = rejection(mapping, request);
    if (reason !== undefined) throw new Error(reason);
    const model = selectWireModelForRequest(mapping, request);
    return {
      model,
      compile: async (resolve) => wanVideoBody(model, (await compileWireRequest(mapping, request, resolve)).input as Record<string, unknown>),
    };
  },
  packageResult: (artifacts) => ({
    kind: "inline",
    value: canonicalize(sealGeneratedVideoSet({ videos: artifacts })),
  }),
}));

const byCapability = new Map(dashScopeRoutes.map((route) => [route.key, route]));

export function dashScopeRouteForCapability(capability: CapabilityRef): DashScopeRoute | undefined {
  return byCapability.get(capabilityKey(capability));
}
