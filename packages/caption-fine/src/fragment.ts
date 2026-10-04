import { captionTypes } from "@qflow/caption";
import { compositionTypes } from "@qflow/composition";
import { sealGraphFragment } from "@qflow/elaborator";
import { timelineTypes } from "@qflow/timeline";
import { regionTrackTypes } from "@qflow/region-track";
import { spatialTypes } from "@qflow/spatial";

import { captionFineProducers, captionFineTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

/** One timing join plus one Style-family render operation, regardless of how many Styles are used. */
export const fineCaptionTrackFragment = sealGraphFragment({
  inputs: [
    { name: "document", type: captionTypes.document },
    { name: "timeline", type: timelineTypes.track },
    { name: "within", type: spatialTypes.frame },
    { name: "timing", type: captionTypes.timing },
    { name: "program", type: captionTypes.program },
  ],
  operations: [
    {
      id: "caption-fine:schedule",
      producer: captionFineProducers.schedule,
      inputs: {
        timing: input("timing"), program: input("program"), document: input("document"),
      },
      result: { kind: "output", name: "schedule" },
    },
    {
      id: "caption-fine:render",
      producer: captionFineProducers.render,
      inputs: {
        schedule: operation("caption-fine:schedule"), program: input("program"),
        document: input("document"), timeline: input("timeline"), within: input("within"),
      },
      result: { kind: "output", name: "track" },
    },
  ],
  exports: [
    {
      name: "schedule",
      type: captionFineTypes.schedule,
      root: operation("caption-fine:schedule"),
    },
    {
      name: "visual",
      type: compositionTypes.visualTrack,
      root: operation("caption-fine:render"),
    },
  ],
});

/** The same Caption pipeline with one explicit, external spatial-evidence edge. */
export const fineCaptionRegionTrackFragment = sealGraphFragment({
  inputs: [
    { name: "document", type: captionTypes.document },
    { name: "timeline", type: timelineTypes.track },
    { name: "within", type: spatialTypes.frame },
    { name: "timing", type: captionTypes.timing },
    { name: "program", type: captionTypes.program },
    { name: "regions", type: regionTrackTypes.track },
  ],
  operations: [
    {
      id: "caption-fine:schedule",
      producer: captionFineProducers.schedule,
      inputs: {
        timing: input("timing"), program: input("program"), document: input("document"),
      },
      result: { kind: "output", name: "schedule" },
    },
    {
      id: "caption-fine:render",
      producer: captionFineProducers.renderWithRegions,
      inputs: {
        schedule: operation("caption-fine:schedule"), program: input("program"),
        document: input("document"), timeline: input("timeline"), within: input("within"), regions: input("regions"),
      },
      result: { kind: "output", name: "track" },
    },
  ],
  exports: [
    { name: "schedule", type: captionFineTypes.schedule, root: operation("caption-fine:schedule") },
    { name: "visual", type: compositionTypes.visualTrack, root: operation("caption-fine:render") },
  ],
});
