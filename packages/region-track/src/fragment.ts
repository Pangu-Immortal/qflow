import { sealGraphFragment } from "@qflow/elaborator";
import { spatialTypes } from "@qflow/spatial";
import { svsRecipeType } from "@qflow/svs";
import { timelineTypes } from "@qflow/timeline";

import { regionTrackProducers, regionTrackTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });

export const regionTrackFragment = sealGraphFragment({
  inputs: [
    { name: "within", type: spatialTypes.frame },
    { name: "timeline", type: timelineTypes.track },
    { name: "recipe", type: svsRecipeType },
  ],
  operations: [{ id: "resolve", producer: regionTrackProducers.resolve, inputs: {
    within: input("within"), timeline: input("timeline"), recipe: input("recipe"),
  }, result: { kind: "output", name: "track" } }],
  exports: [{ name: "track", type: regionTrackTypes.track, root: { kind: "fragment-operation", operation: "resolve" } }],
});
