import { timelineTypes } from "@qflow/timeline";

import { compositionTypes } from "@qflow/composition";
import type { VisualTrack } from "@qflow/composition";
import { sealGraphFragment } from "@qflow/elaborator";

import { typographyTrackProducers, typographyTrackTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

/** Provider-free official lowering from TypographyTrackProgram to one peer VisualTrack. */
export const typographyTrackFragment = sealGraphFragment({
  inputs: [
    { name: "timeline", type: timelineTypes.track },
    { name: "program", type: typographyTrackTypes.program },
  ],
  operations: [
    {
      id: "render",
      producer: typographyTrackProducers.render,
      inputs: { timeline: input("timeline"), program: input("program") },
      result: { kind: "output", name: "track" },
    },
  ],
  exports: [{
    name: "track",
    type: compositionTypes.visualTrack,
    root: operation("render"),
  }],
});
