import { captionProducers, captionTypes } from "@qflow/caption";
import { compositionTypes } from "@qflow/composition";
import { sealGraphFragment } from "@qflow/elaborator";
import { narrativeTypes } from "@qflow/narrative";
import { semanticTrackTypes } from "@qflow/semantic-track";

import { captionFineProducers, captionFineTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

/** One timing join plus one Style-family render operation, regardless of how many Styles are used. */
export const fineCaptionTrackFragment = sealGraphFragment({
  inputs: [
    { name: "document", type: narrativeTypes.captionDocument },
    { name: "semantic", type: semanticTrackTypes.track },
    { name: "program", type: captionTypes.program },
  ],
  operations: [
    {
      id: "caption:temporalize-document",
      producer: captionProducers.temporalizeDocument,
      inputs: {
        document: input("document"), semantic: input("semantic"), program: input("program"),
      },
      result: { kind: "output", name: "caption" },
    },
    {
      id: "caption-fine:schedule",
      producer: captionFineProducers.schedule,
      inputs: {
        caption: operation("caption:temporalize-document"), program: input("program"), document: input("document"),
      },
      result: { kind: "output", name: "schedule" },
    },
    {
      id: "caption-fine:render",
      producer: captionFineProducers.render,
      inputs: {
        schedule: operation("caption-fine:schedule"), program: input("program"),
        document: input("document"), semantic: input("semantic"),
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
      name: "track",
      type: compositionTypes.visualTrack,
      root: operation("caption-fine:render"),
    },
  ],
});
