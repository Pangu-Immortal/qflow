import type { Composition } from "@qflow/composition";
import type { Timeline } from "@qflow/timeline";
import type { ProducerPackage } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import { canonicalize } from "@qflow/qflow/protocol";
import { compileHtmlDocument, assertHtmlDocument } from "./document.js";
import { htmlDocumentProducers, htmlDocumentTypes } from "./manifest.js";

export const htmlDocumentComponent = {
  producers: [{ producer: htmlDocumentProducers.compile, handler: ({ inputs }) => {
    const composition = inputs.composition!.value, timeline = inputs.timeline!.value;
    if (composition.kind !== "inline" || timeline.kind !== "inline") throw new Error("HTML document requires inline Composition and Timeline");
    return { outputs: { document: { kind: "inline", value: canonicalize(compileHtmlDocument(composition.value as unknown as Composition, timeline.value as unknown as Timeline)) } }, needs: {} };
  } }],
  validators: [{ type: htmlDocumentTypes.document, handler({ value }) {
    if (value.kind !== "inline") throw new Error("HTML document must be inline");
    assertHtmlDocument(value.value);
  } }],
} satisfies ProducerPackage & AdmissionPackage;
