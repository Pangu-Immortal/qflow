import { mkdir, open, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CompositableSurfaceRef } from "@qflow/media";
import type { BlobRef } from "@qflow/protocol";

import { assertHyperframesDocument, materializeHyperframesHtml } from "./document.js";
import type { HyperframesDocument } from "./types.js";

/** Reads one execution resource. Whose store it comes from is the caller's business. */
export type HyperframesArtifactReader = (
  artifact: BlobRef,
  signal?: AbortSignal,
) => Promise<Uint8Array | AsyncIterable<Uint8Array>>;
/** Inspect the completed staged file; its lifetime belongs to the staging caller. */
export type HyperframesSurfaceValidator = (
  surface: CompositableSurfaceRef,
  path: string,
  signal?: AbortSignal,
) => Promise<void>;

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "font/woff2": ".woff2",
  "font/woff": ".woff",
  "font/ttf": ".ttf",
  "font/otf": ".otf",
};

function extension(mediaType: string): string {
  const found = EXTENSIONS[mediaType];
  if (found === undefined) throw new Error(`HyperFrames does not support Artifact media type ${mediaType}`);
  return found;
}

/**
 * Lay one document out as a directory HyperFrames can render.
 *
 * A local or hosted Provider can serve the same staged document to its capture engine.
 * Resource names are local to this staged project and carry no content claim.
 */
export async function stageHyperframesProject(options: {
  readonly document: HyperframesDocument;
  readonly directory: string;
  readonly read: HyperframesArtifactReader;
  readonly validateSurface?: HyperframesSurfaceValidator;
  readonly signal?: AbortSignal;
}): Promise<void> {
  const { document, directory, read } = options;
  const controller = new AbortController();
  const signal = options.signal === undefined ? controller.signal : AbortSignal.any([options.signal, controller.signal]);
  signal.throwIfAborted();
  assertHyperframesDocument(document);
  if (document.surfaces.length > 0 && options.validateSurface === undefined) {
    throw new Error("HyperFrames Runtime has no Surface-byte validator");
  }
  const artifactDirectory = join(directory, "artifacts");
  await mkdir(artifactDirectory, { recursive: true });
  const paths = new Map<string, string>();
  const surfaces = new Map(document.surfaces.map((surface) => [surface.artifact.resource, surface]));
  await Promise.allSettled(document.artifacts.map(async (artifact, index) => {
    try {
      signal.throwIfAborted();
      // Resource identities are portable protocol values, not filesystem names.
      const name = `asset-${index}${extension(artifact.mediaType)}`;
      const opened = await read(artifact, signal);
      signal.throwIfAborted();
      const chunks = opened instanceof Uint8Array
        ? (async function* () { yield opened; })()
        : opened;
      const surface = surfaces.get(artifact.resource);
      let size = 0;
      const path = join(artifactDirectory, name);
      const target = await open(path, "w");
      try {
        for await (const chunk of chunks) {
          signal.throwIfAborted();
          await target.writeFile(chunk);
          size += chunk.byteLength;
        }
      } finally {
        await target.close();
      }
      if (size !== artifact.size) {
        throw new Error(`HyperFrames Artifact ${artifact.resource} size differs`);
      }
      if (surface !== undefined) {
        // The validator borrows the completed staged file for this call only.
        await options.validateSurface!(structuredClone(surface), path, signal);
      }
      paths.set(artifact.resource, `./artifacts/${name}`);
    } catch (error) {
      controller.abort(error);
      throw error;
    }
  }));
  // All writes have settled before the caller can remove the staged directory.
  signal.throwIfAborted();
  const html = materializeHyperframesHtml(document, (artifact) => {
    const path = paths.get(artifact.resource);
    if (path === undefined) throw new Error(`HyperFrames Artifact ${artifact.resource} was not staged`);
    return path;
  });
  await writeFile(join(directory, "index.html"), html, { encoding: "utf8", signal });
}
