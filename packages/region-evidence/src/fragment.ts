import { sealGraphFragment } from "@qflow/author";
import { spatialTypes } from "@qflow/spatial";
import { recipeType } from "@qflow/recipe";
import { timelineTypes } from "@qflow/timeline";

import { regionEvidenceProducers, regionEvidenceTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });

export const regionEvidenceFragment = sealGraphFragment({
  inputs: [
    { name: "within", type: spatialTypes.frame },
    { name: "timeline", type: timelineTypes.timeline },
    { name: "recipe", type: recipeType },
  ],
  operations: [{ id: "resolve", producer: regionEvidenceProducers.resolve, inputs: {
    within: input("within"), timeline: input("timeline"), recipe: input("recipe"),
  }, result: { kind: "output", name: "evidence" } }],
  exports: [{ name: "evidence", type: regionEvidenceTypes.evidence, root: { kind: "fragment-operation", operation: "resolve" } }],
});
