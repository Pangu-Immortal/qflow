import type { StructuredElement, SurfaceAttributeVocabulary, SurfaceResolvedReference } from "@qflow/markup";
import { sameType } from "@qflow/protocol";
import { timelineTypes } from "@qflow/timeline";

export type TemporalContext = { readonly timeline: SurfaceResolvedReference };

export const temporalContextAttributeVocabulary = [
  { name: "timeline", kind: "reference", required: true, accepts: [timelineTypes.timeline],
    summary: "The complete absolute film Timeline." },
] as const satisfies readonly SurfaceAttributeVocabulary[];

export function resolveTemporalContext(input: {
  readonly element: StructuredElement;
  readonly resolveReference: (path: string) => SurfaceResolvedReference | undefined;
}): TemporalContext {
  const raw = input.element.attributes.timeline;
  if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${input.element.name}.timeline must be a reference.`);
  const found = input.resolveReference(raw.path);
  if (found === undefined || !sameType(found.type, timelineTypes.timeline)) {
    throw new Error(`${input.element.name}.timeline must reference a Timeline.`);
  }
  return { timeline: found };
}
