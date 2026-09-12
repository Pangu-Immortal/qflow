import { narrativeTypes } from "@qflow/narrative";
import { timelineTypes } from "@qflow/timeline";
import { sealGraphFragment } from "@qflow/elaborator";

import { captionProducers, captionTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

export const captionTimingFragment = sealGraphFragment({
  inputs: [
    { name: "document", type: narrativeTypes.captionDocument },
    { name: "timeline", type: timelineTypes.track },
  ],
  operations: [{
    id: "temporalize-caption-document",
    producer: captionProducers.temporalizeDocument,
    inputs: { document: input("document"), timeline: input("timeline") },
    result: { kind: "output", name: "caption" },
  }],
  exports: [{ name: "caption", type: captionTypes.timedProjection, root: operation("temporalize-caption-document") }],
});
