import { compositionTypes } from "@qflow/composition";
import type { VisualTrack } from "@qflow/composition";
import { sealGraphFragment } from "@qflow/elaborator";
import { semanticTrackTypes } from "@qflow/semantic-track";

import { typographyTrackProducers, typographyTrackTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

/** Provider-free official lowering from TypographyTrackProgram to one peer VisualTrack. */
export const typographyTrackFragment = sealGraphFragment({
  inputs: [
    { name: "semantic", type: semanticTrackTypes.track },
    { name: "program", type: typographyTrackTypes.program },
  ],
  operations: [{
    id: "render",
    producer: typographyTrackProducers.render,
    inputs: { semantic: input("semantic"), program: input("program") },
    result: { kind: "output", name: "track" },
  }],
  exports: [{
    name: "track",
    type: compositionTypes.visualTrack,
    root: operation("render"),
  }],
});
