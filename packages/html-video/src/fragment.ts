import { timelineTypes } from "@qflow/timeline";
import { mediaTypes } from "@qflow/media";
import { blobTypes } from "@qflow/qflow/blob";

import { compositionTypes } from "@qflow/composition";
import { sealGraphFragment } from "@qflow/qflow/author";
import { htmlProgramProducers } from "@qflow/html-program";
import { mediaOperationsProducers } from "@qflow/media-operations";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

export function createHtmlVideoFragment(selectedRange = false) {
  return sealGraphFragment({
    inputs: [
      { name: "composition", type: compositionTypes.composition },
      { name: "timeline", type: timelineTypes.timeline },
      ...(selectedRange ? [{ name: "range", type: mediaTypes.frameRange }] : []),
    ],
    operations: [
      {
        id: "compile-program",
        producer: htmlProgramProducers.compile,
        inputs: { composition: input("composition"), timeline: input("timeline") },
        result: { kind: "output", name: "program" },
      },
      {
        id: "request-visual",
        producer: selectedRange ? htmlProgramProducers.requestVisualRange : htmlProgramProducers.requestVisual,
        inputs: { program: operation("compile-program"), ...(selectedRange ? { range: input("range") } : {}) },
        result: { kind: "need", name: "visual" },
      },
      {
        id: "compile-audio-program",
        producer: mediaOperationsProducers.planAudio,
        inputs: { composition: input("composition"), timeline: input("timeline") },
        result: { kind: "output", name: "plan" },
      },
      {
        id: "request-audio-render",
        producer: selectedRange ? mediaOperationsProducers.renderAudioRange : mediaOperationsProducers.renderAudio,
        inputs: { plan: operation("compile-audio-program"), ...(selectedRange ? { range: input("range") } : {}) },
        result: { kind: "need", name: "audio" },
      },
      {
        id: "request-mux",
        producer: mediaOperationsProducers.mux,
        inputs: {
          visual: operation("request-visual"),
          audio: operation("request-audio-render"),
        },
        result: { kind: "need", name: "media" },
      },
      {
        id: "project-video",
        producer: mediaOperationsProducers.projectMuxed,
        inputs: { media: operation("request-mux") },
        result: { kind: "output", name: "video" },
      },
    ],
    exports: [{
      name: "video",
      type: blobTypes.blob,
      root: operation("project-video"),
    }],
  });

}

export const htmlVideoFragment = createHtmlVideoFragment();
