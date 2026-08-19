import type { CanonicalValue } from "@qflow/protocol";
import { assertHyperframesDocument } from "@qflow/hyperframes";
import type { HyperframesDocument } from "@qflow/hyperframes";

export function hyperframesVisualRequest(document: HyperframesDocument): CanonicalValue {
  assertHyperframesDocument(document);
  return {
    document,
  };
}
