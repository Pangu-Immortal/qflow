import { sealGraphFragment } from "@qflow/qflow/author";
import { compositionTypes } from "@qflow/composition";
import { timelineTypes } from "@qflow/timeline";
import { htmlDocumentProducers, htmlDocumentTypes } from "./manifest.js";

export const htmlDocumentFragment = sealGraphFragment({
  inputs: [{ name: "composition", type: compositionTypes.composition }, { name: "timeline", type: timelineTypes.timeline }],
  operations: [{
    id: "compile-document", producer: htmlDocumentProducers.compile,
    inputs: { composition: { kind: "fragment-input", name: "composition" }, timeline: { kind: "fragment-input", name: "timeline" } },
    result: { kind: "output", name: "document" },
  }],
  exports: [{ name: "document", type: htmlDocumentTypes.document, root: { kind: "fragment-operation", operation: "compile-document" } }],
});
