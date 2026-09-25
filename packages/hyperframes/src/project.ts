import { mkdir, open, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CompositableSurfaceRef } from "@qflow/media";
import type { BlobRef } from "@qflow/protocol";

import { materializeHyperframesHtml, selectHyperframesArtifacts } from "./document.js";
import type { HyperframesDocument, HyperframesFrameSpan } from "./types.js";
import { assertHyperframesHtmlProject, mapHyperframesHtmlUrls } from "./html-project.js";
import type { HyperframesHtmlProject } from "./html-project.js";

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

/** Stage an existing HTML programme; no reverse compilation or inferred Surface declarations. */
export async function stageHyperframesHtmlProject(options: {
  readonly project: HyperframesHtmlProject;
  readonly directory: string;
  readonly read: HyperframesArtifactReader;
  readonly signal?: AbortSignal;
}): Promise<void> {
  assertHyperframesHtmlProject(options.project);
  await mkdir(join(options.directory, "artifacts"), { recursive: true });
  const paths = new Map<string, string>();
  const resourcePaths = new Map<string, { readonly artifact: BlobRef; readonly path: string }>();
  for (const asset of options.project.assets) {
    options.signal?.throwIfAborted();
    let staged = resourcePaths.get(asset.artifact.resource);
    if (staged !== undefined) {
      if (staged.artifact.size !== asset.artifact.size || staged.artifact.mediaType !== asset.artifact.mediaType) {
        throw new Error(`HyperFrames Artifact ${asset.artifact.resource} has conflicting metadata`);
      }
    } else {
      const path = `artifacts/asset-${resourcePaths.size}${extension(asset.artifact.mediaType)}`;
      const bytes = await options.read(asset.artifact, options.signal);
      const file = await open(join(options.directory, path), "w");
      try {
        if (bytes instanceof Uint8Array) await file.writeFile(bytes);
        else for await (const chunk of bytes) { options.signal?.throwIfAborted(); await file.writeFile(chunk); }
      } finally { await file.close(); }
      staged = { artifact: asset.artifact, path };
      resourcePaths.set(asset.artifact.resource, staged);
    }
    paths.set(asset.url, `./${staged.path}`);
  }
  await writeFile(join(options.directory, "index.html"), mapHyperframesHtmlUrls(options.project.html, url => paths.get(url) ?? url), {
    encoding: "utf8", ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
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
  /** Whole-request absolute selection. Omit only when every frame may be rendered. */
  readonly frameSelection?: readonly HyperframesFrameSpan[];
  /** Maximum complete Artifact read/write/validation lifecycles in flight. */
  readonly maxConcurrentArtifacts?: number;
  readonly signal?: AbortSignal;
}): Promise<void> {
  const { document, directory, read } = options;
  const controller = new AbortController();
  const signal = options.signal === undefined ? controller.signal : AbortSignal.any([options.signal, controller.signal]);
  signal.throwIfAborted();
  const selectedResources = new Set(selectHyperframesArtifacts(document, options.frameSelection)
    .map((entry) => entry.artifact.resource));
  const maxConcurrentArtifacts = options.maxConcurrentArtifacts ?? 1;
  if (!Number.isSafeInteger(maxConcurrentArtifacts) || maxConcurrentArtifacts < 1) {
    throw new Error("HyperFrames Artifact staging concurrency must be a positive safe integer");
  }
  const artifactDirectory = join(directory, "artifacts");
  await mkdir(artifactDirectory, { recursive: true });
  const selected = document.artifacts.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => selectedResources.has(entry.artifact.resource));
  // Paths remain a deterministic function of the complete compiled Document.
  // Unselected compiler-owned media keep a missing local URL in inert markup;
  // selected roots can only activate Artifacts admitted above.
  const paths = new Map(document.artifacts.map((entry, index) => [entry.artifact.resource,
    `./artifacts/asset-${index}${extension(entry.artifact.mediaType)}`]));
  const surfaces = new Map(document.surfaces.map((surface) => [surface.artifact.resource, surface]));
  if (options.validateSurface === undefined
    && selected.some(({ entry }) => surfaces.has(entry.artifact.resource))) {
    throw new Error("HyperFrames Runtime has no Surface-byte validator");
  }
  let nextArtifact = 0;
  let failure: unknown;
  const stageNext = async (): Promise<void> => {
    while (failure === undefined) {
      const index = nextArtifact;
      if (index >= selected.length) return;
      nextArtifact += 1;
      const selectedArtifact = selected[index]!;
      const artifact = selectedArtifact.entry.artifact;
      try {
        signal.throwIfAborted();
        // Resource identities are portable protocol values, not filesystem names.
        const name = `asset-${selectedArtifact.index}${extension(artifact.mediaType)}`;
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
      } catch (error) {
        if (failure === undefined) {
          failure = error;
          controller.abort(error);
        }
        return;
      }
    }
  };
  const workers = Array.from({ length: Math.min(maxConcurrentArtifacts, selected.length) }, () => stageNext());
  // A failure stops new claims, but every already-started reader, writer and
  // validator settles before the caller may remove the staging directory.
  await Promise.all(workers);
  // Preserve whichever abort reached the combined signal first, including an
  // external caller's exact reason rather than a later stream AbortError.
  signal.throwIfAborted();
  if (failure !== undefined) throw failure;
  // All writes have settled before the caller can remove the staged directory.
  const html = materializeHyperframesHtml(document, (artifact) => {
    const path = paths.get(artifact.resource);
    if (path === undefined) throw new Error(`HyperFrames Artifact ${artifact.resource} has no materialized path`);
    return path;
  });
  await writeFile(join(directory, "index.html"), html, { encoding: "utf8", signal });
}
