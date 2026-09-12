import type { StructuredElement, SurfaceAttributeVocabulary, SurfaceResolvedReference } from "@qflow/markup";
import { timelineTypes } from "@qflow/timeline";

export type TemporalContext = {
  readonly timeline: SurfaceResolvedReference;
};

export const temporalContextAttributeVocabulary = [
  { name: "timeline", kind: "reference", required: true, accepts: [timelineTypes.track],
    summary: "The complete film Timeline, with any placed material and semantic anchors." },
] as const satisfies readonly SurfaceAttributeVocabulary[];

/** One author-facing Timeline; projections share its range and evidence. */
export function resolveTemporalContext(input: {
  readonly element: StructuredElement;
  readonly resolveReference: (path: string) => SurfaceResolvedReference | undefined;
}): TemporalContext {
  const { element, resolveReference } = input;
  const raw = element.attributes.timeline;
  if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${element.name}.timeline must be a reference.`);
  const found = resolveReference(raw.path);
  const expected = timelineTypes.track;
  if (found === undefined || found.type.module.name !== expected.module.name
    || found.type.module.version !== expected.module.version || found.type.name !== expected.name) {
    throw new Error(`${element.name}.timeline must reference a Timeline.`);
  }
  return { timeline: found };
}
