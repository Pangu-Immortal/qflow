import { timelineTypes } from "@qflow/timeline";
import { mediaTypes } from "@qflow/media";
import { artifactTypes } from "@qflow/artifact";

import { compositionTypes } from "@qflow/composition";
import { sealGraphFragment } from "@qflow/elaborator";
import { hyperframesProducers } from "@qflow/hyperframes";
import { mediaPipelineProducers } from "@qflow/media-pipeline";

import {
  renderHyperframesProducers,
} from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

export function createRenderHyperframesFragment(selectedRange = false) {
  return sealGraphFragment({
    inputs: [
      { name: "composition", type: compositionTypes.composition },
      { name: "timeline", type: timelineTypes.track },
      ...(selectedRange ? [{ name: "range", type: mediaTypes.frameRange }] : []),
    ],
    operations: [
      {
        id: "compile-document",
        producer: hyperframesProducers.compile,
        inputs: { composition: input("composition"), timeline: input("timeline") },
        result: { kind: "output", name: "document" },
      },
      {
        id: "request-visual-render",
        producer: selectedRange ? renderHyperframesProducers.requestVisualRange : renderHyperframesProducers.requestVisual,
        inputs: { document: operation("compile-document"), ...(selectedRange ? { range: input("range") } : {}) },
        result: { kind: "need", name: "visual" },
      },
      {
        id: "compile-audio-program",
        producer: mediaPipelineProducers.planAudio,
        inputs: { composition: input("composition"), timeline: input("timeline") },
        result: { kind: "output", name: "plan" },
      },
      {
        id: "request-audio-render",
        producer: selectedRange ? mediaPipelineProducers.renderAudioRange : mediaPipelineProducers.renderAudio,
        inputs: { plan: operation("compile-audio-program"), ...(selectedRange ? { range: input("range") } : {}) },
        result: { kind: "need", name: "audio" },
      },
      {
        id: "request-mux",
        producer: mediaPipelineProducers.mux,
        inputs: {
          visual: operation("request-visual-render"),
          audio: operation("request-audio-render"),
        },
        result: { kind: "need", name: "media" },
      },
      {
        id: "project-video",
        producer: mediaPipelineProducers.projectMuxed,
        inputs: { media: operation("request-mux") },
        result: { kind: "output", name: "video" },
      },
    ],
    exports: [{
      name: "video",
      type: artifactTypes.blob,
      root: operation("project-video"),
    }],
  });

}

export const renderHyperframesFragment = createRenderHyperframesFragment();
