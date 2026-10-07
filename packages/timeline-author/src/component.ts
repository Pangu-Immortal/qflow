import { canonicalize } from "@qflow/qflow/protocol";
import type { ProducerPackage } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import type { StoredValue } from "@qflow/qflow/protocol";
import type { LocalTemporalDomain, TemporalDuration, TemporalExtent, TemporalWindow } from "@qflow/qflow/temporal";
import type { Clock, Timeline } from "@qflow/qflow/timeline";

import { timelineAuthorProducers } from "./manifest.js";
import {
  constructionAliasPoint, constructionDuration, constructionEarliest, constructionLatest, constructionOffset,
  constructionOrigin, constructionResolvedExtent, constructionSpan, constructionSpanBetween,
  constructionSpanEnd, constructionSpanEnding, constructionSpanStart,
  finalizeTimeline, materializeInstant, materializeWindow,
} from "./program.js";
import type {
  ConstructionExtent, ConstructionIdentitySpec, ConstructionOffsetSpec,
  ConstructionPoint, ConstructionSpan, TimelineAuthorHeader,
} from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline.`);
  return value.value as unknown as T;
}
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

export const timelineAuthorComponent = {
  producers: [
    { producer: timelineAuthorProducers.origin, handler: ({ inputs }) => ({ outputs: { point: output(constructionOrigin(inline<Clock>(inputs.clock?.value, "Clock"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.duration, handler: ({ inputs }) => ({ outputs: { extent: output(constructionDuration(inline<Clock>(inputs.clock?.value, "Clock"), inline<TemporalDuration>(inputs.duration?.value, "ConstructionDurationSpec"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.resolvedExtent, handler: ({ inputs }) => ({ outputs: { extent: output(constructionResolvedExtent(inline<Clock>(inputs.clock?.value, "Clock"), inline<TemporalExtent>(inputs.extent?.value, "TemporalExtent"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.offset, handler: ({ inputs }) => ({ outputs: { point: output(constructionOffset(inline<ConstructionPoint>(inputs.point?.value, "ConstructionPoint"), inline<ConstructionExtent>(inputs.extent?.value, "ConstructionExtent"), inline<ConstructionOffsetSpec>(inputs.spec?.value, "ConstructionOffsetSpec"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.earliest, handler: ({ inputs }) => ({ outputs: { point: output(constructionEarliest(inline<ConstructionPoint>(inputs.left?.value, "ConstructionPoint"), inline<ConstructionPoint>(inputs.right?.value, "ConstructionPoint"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.latest, handler: ({ inputs }) => ({ outputs: { point: output(constructionLatest(inline<ConstructionPoint>(inputs.left?.value, "ConstructionPoint"), inline<ConstructionPoint>(inputs.right?.value, "ConstructionPoint"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.aliasPoint, handler: ({ inputs }) => ({ outputs: { point: output(constructionAliasPoint(inline<ConstructionPoint>(inputs.point?.value, "ConstructionPoint"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.span, handler: ({ inputs }) => ({ outputs: { span: output(constructionSpan(inline<ConstructionPoint>(inputs.start?.value, "ConstructionPoint"), inline<ConstructionExtent>(inputs.extent?.value, "ConstructionExtent"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.spanEnding, handler: ({ inputs }) => ({ outputs: { span: output(constructionSpanEnding(inline<ConstructionPoint>(inputs.end?.value, "ConstructionPoint"), inline<ConstructionExtent>(inputs.extent?.value, "ConstructionExtent"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.spanBetween, handler: ({ inputs }) => ({ outputs: { span: output(constructionSpanBetween(inline<ConstructionPoint>(inputs.start?.value, "ConstructionPoint"), inline<ConstructionPoint>(inputs.end?.value, "ConstructionPoint"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.spanStart, handler: ({ inputs }) => ({ outputs: { point: output(constructionSpanStart(inline<ConstructionSpan>(inputs.span?.value, "ConstructionSpan"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.spanEnd, handler: ({ inputs }) => ({ outputs: { point: output(constructionSpanEnd(inline<ConstructionSpan>(inputs.span?.value, "ConstructionSpan"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.finalize, handler: ({ inputs }) => ({ outputs: { timeline: output(finalizeTimeline(inline<TimelineAuthorHeader>(inputs.header?.value, "TimelineAuthorHeader"), inline<Clock>(inputs.clock?.value, "Clock"), inline<ConstructionPoint>(inputs.end?.value, "ConstructionPoint"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.instant, handler: ({ inputs }) => ({ outputs: { instant: output(materializeInstant(inline<Timeline>(inputs.timeline?.value, "Timeline"), inline<ConstructionPoint>(inputs.point?.value, "ConstructionPoint"), inline<ConstructionIdentitySpec>(inputs.spec?.value, "ConstructionIdentitySpec"))) }, needs: {} }) },
    { producer: timelineAuthorProducers.window, handler: ({ inputs }) => ({ outputs: { window: output(materializeWindow(inline<Timeline>(inputs.timeline?.value, "Timeline"), inline<ConstructionSpan>(inputs.span?.value, "ConstructionSpan"), inline<ConstructionIdentitySpec>(inputs.spec?.value, "ConstructionIdentitySpec"))) }, needs: {} }) },
  ],
} satisfies ProducerPackage & AdmissionPackage;
