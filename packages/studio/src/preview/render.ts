import type { Composition } from "@qflow/composition";
import { compileHyperframesDocument, materializeHyperframesHtml } from "@qflow/hyperframes";
import type { HyperframesDocument } from "@qflow/hyperframes";
import { compileAudioProgramPlan } from "@qflow/media-pipeline";
import type { Timeline } from "@qflow/timeline";

import { injectRuntimeShim } from "./runtime-shim.js";

export type RenderInput = {
  readonly composition: Composition;
  readonly timeline: Timeline;
  /** Resources Studio can serve for material selected by the Run. */
  readonly served?: ReadonlySet<string>;
};

/**
 * Compile the interpreted Tracks into the same HyperFrames document the real
 * renderer photographs frame by frame, and hand it back as an `iframe` srcdoc.
 *
 * Nothing is approximated here: placement, stacking, clipping, motion and
 * material all come from the projection selected by the Run.
 */
export function renderPreview(input: RenderInput): string {
  return renderStudioProgramme(input).preview;
}

/** The same compiled picture serves immediate frame capture and interactive playback. */
export function renderStudioProgramme(input: RenderInput): { readonly document: HyperframesDocument; readonly html: string; readonly preview: string } {
  const document = compileHyperframesDocument(input.composition, input.timeline);
  const html = materializeHyperframesHtml(document, (artifact) => {
    // The only Artifacts a preview can reference are files the author already
    // has. Anything else would be a Provider's output, which does not exist yet,
    // and failing loudly beats serving a picture with holes in it.
    if (input.served?.has(artifact.resource) !== true) {
      throw new Error(`Preview composition references Artifact ${artifact.resource}, which it cannot serve.`);
    }
    return `/__studio/material/${artifact.resource}`;
  });
  const audio = compileAudioProgramPlan(input.composition, input.timeline).clips
    .map((clip) => {
      if (input.served?.has(clip.artifact.resource) !== true) {
        throw new Error(`Preview audio references Artifact ${clip.artifact.resource}, which it cannot serve.`);
      }
      return `<audio class="qflow-studio-audio" preload="auto"
      src="/__studio/material/${clip.artifact.resource}"
      data-start="${clip.targetStartSample / 48_000}"
      data-duration="${(clip.targetEndSampleExclusive - clip.targetStartSample) / 48_000}"
      data-media-start="${clip.sourceStartSample / 48_000}"
      data-media-end="${clip.sourceEndSampleExclusive / 48_000}"
      data-loop="${clip.sourceLoop}"
      data-phase="${clip.sourcePhaseSample / 48_000}"
      data-playback-rate="${clip.playbackRate}"
      data-gain="${clip.gain}"
      data-level-automation="${encodeURIComponent(JSON.stringify({
        gainEnvelope: clip.gainEnvelope, audibility: clip.audibility,
        fadeInSamples: clip.fadeInSamples, fadeOutSamples: clip.fadeOutSamples,
        mixStartSample: clip.mixStartSample, mixEndSampleExclusive: clip.mixEndSampleExclusive,
      }))}"></audio>`;
    }).join("");
  return { document, html, preview: injectRuntimeShim(html, audio) };
}
