import type { CanonicalValue } from "@qflow/protocol";
import { assertHyperframesDocument, assertHyperframesHtmlProject, hyperframesHtmlDomain } from "@qflow/hyperframes";
import type { HyperframesDocument, HyperframesHtmlProject } from "@qflow/hyperframes";
import type { BlobRef } from "@qflow/protocol";
import { isResourceId } from "@qflow/protocol";
import { verifyMediaFrameRange } from "@qflow/media";
import type { MediaFrameRange } from "@qflow/media";

export type HyperframesVisualRequest = {
  readonly document: HyperframesDocument;
  readonly range?: MediaFrameRange;
};

/** Select original programme frames, in strictly increasing order. */
export type HyperframesFramesRequest = ({ readonly document: HyperframesDocument } | { readonly project: HyperframesHtmlProject }) & {
  readonly frames: readonly number[];
};
/** PNG images in request order. The request already supplies each frame's identity. */
export type HyperframesFrames = readonly BlobRef[];

export function hyperframesFramesDomain(request: HyperframesFramesRequest) {
  return "document" in request ? request.document : hyperframesHtmlDomain(request.project.html);
}

export function verifyHyperframesFramesRequest(value: unknown): asserts value is HyperframesFramesRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !["document", "project", "frames"].includes(key))
    || ("document" in value) === ("project" in value)) throw new Error("Frame request needs exactly one document or HTML project, and frames");
  const request = value as HyperframesFramesRequest;
  if ("document" in request) assertHyperframesDocument(request.document);
  else assertHyperframesHtmlProject(request.project);
  const { frameCount } = hyperframesFramesDomain(request);
  if (!Array.isArray(request.frames) || request.frames.length === 0 || request.frames.some((frame, index) =>
    !Number.isSafeInteger(frame) || frame < 0 || frame >= frameCount || (index > 0 && frame <= request.frames[index - 1]!))) {
    throw new Error(`Frames must be strictly increasing integers in [0, ${frameCount})`);
  }
}

export function hyperframesFramesRequest(request: HyperframesFramesRequest): CanonicalValue {
  verifyHyperframesFramesRequest(request);
  return request as unknown as CanonicalValue;
}

export function verifyHyperframesFrames(value: unknown): asserts value is HyperframesFrames {
  if (!Array.isArray(value) || value.length === 0 || value.some(blob => !blob || blob.kind !== "blob"
    || !isResourceId(blob.resource) || blob.mediaType !== "image/png" || !Number.isSafeInteger(blob.size) || blob.size <= 0)) {
    throw new Error("HyperFrames frames must be PNG BlobRefs in request order");
  }
}

export function verifyHyperframesVisualRequest(value: unknown): asserts value is HyperframesVisualRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => key !== "document" && key !== "range")) {
    throw new Error("HyperFrames visual request requires document and an optional range");
  }
  const request = value as HyperframesVisualRequest;
  assertHyperframesDocument(request.document);
  if (request.range !== undefined) verifyMediaFrameRange(request.range, request.document.frameCount);
}

export function hyperframesVisualRequest(document: HyperframesDocument, options: { readonly range?: MediaFrameRange } = {}): CanonicalValue {
  assertHyperframesDocument(document);
  if (options.range !== undefined) verifyMediaFrameRange(options.range, document.frameCount);
  return {
    document,
    ...(options.range === undefined ? {} : { range: options.range }),
  };
}
