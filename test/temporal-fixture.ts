import type { NarrativeExcerpt, NarrativeMomentRef, NarrativeSelectionRef } from "@qflow/narrative";
import type { Timeline } from "@qflow/timeline";
import {
  composeTemporalWindow,
  projectProgramInstant,
} from "@qflow/temporal";
import type { TemporalInstantExpression } from "@qflow/temporal";
import { projectNarrativeInstant } from "@qflow/narrative-temporal";
import type { NarrativeProjection } from "@qflow/narrative-temporal";

export type TemporalWindowProjection = {
  readonly start: TemporalInstantExpression;
  readonly end: TemporalInstantExpression;
};
type NarrativeInstantExpression = {
  readonly ref: "selection.start" | "selection.end" | "segment.start" | "segment.end" | "moment.cue";
  readonly offset?: import("@qflow/temporal").TemporalDuration;
};
type NarrativeWindowProjection = { readonly start: NarrativeInstantExpression; readonly end: NarrativeInstantExpression };

export function projectProgramInstantFixture(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly projection: TemporalInstantExpression;
}) {
  return projectProgramInstant({ ...input, timeline: input.semantic, subjectId: input.subjectId ?? input.itemId });
}

export function projectMomentInstantFixture(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly narrative: NarrativeProjection;
  readonly moment: NarrativeMomentRef;
  readonly projection: NarrativeInstantExpression;
}) {
  return projectNarrativeInstant({ timeline: input.semantic, narrative: input.narrative,
    source: input.moment, sourceKind: "moment", spec: { id: input.itemId, subjectId: input.subjectId ?? input.itemId,
      boundary: "cue", ...(input.projection.offset === undefined ? {} : { offset: input.projection.offset }) } });
}

export function projectProgramWindow(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly projection: TemporalWindowProjection;
}) {
  const subjectId = input.subjectId ?? input.itemId;
  return composeTemporalWindow({ id: input.itemId, subjectId },
    projectProgramInstant({ itemId: `${input.itemId}.start`, subjectId, timeline: input.semantic, projection: input.projection.start }),
    projectProgramInstant({ itemId: `${input.itemId}.end`, subjectId, timeline: input.semantic, projection: input.projection.end }));
}

export function projectSelectionWindow(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly narrative: NarrativeProjection;
  readonly selection: NarrativeSelectionRef;
  readonly projection: NarrativeWindowProjection;
}) {
  const subjectId = input.subjectId ?? input.itemId;
  return composeTemporalWindow({ id: input.itemId, subjectId },
    projectNarrativeInstant({ timeline: input.semantic, narrative: input.narrative,
      source: input.selection, sourceKind: "selection", spec: narrativeSpec(`${input.itemId}.start`, subjectId, input.projection.start) }),
    projectNarrativeInstant({ timeline: input.semantic, narrative: input.narrative,
      source: input.selection, sourceKind: "selection", spec: narrativeSpec(`${input.itemId}.end`, subjectId, input.projection.end) }));
}

export function projectSegmentWindow(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly narrative: NarrativeProjection;
  readonly segment: NarrativeExcerpt;
  readonly projection: NarrativeWindowProjection;
}) {
  const subjectId = input.subjectId ?? input.itemId;
  return composeTemporalWindow({ id: input.itemId, subjectId },
    projectNarrativeInstant({ timeline: input.semantic, narrative: input.narrative,
      source: input.segment, sourceKind: "segment", spec: narrativeSpec(`${input.itemId}.start`, subjectId, input.projection.start) }),
    projectNarrativeInstant({ timeline: input.semantic, narrative: input.narrative,
      source: input.segment, sourceKind: "segment", spec: narrativeSpec(`${input.itemId}.end`, subjectId, input.projection.end) }));
}

export function projectMomentWindow(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly narrative: NarrativeProjection;
  readonly moment: NarrativeMomentRef;
  readonly projection: NarrativeWindowProjection;
}) {
  const subjectId = input.subjectId ?? input.itemId;
  return composeTemporalWindow({ id: input.itemId, subjectId },
    projectNarrativeInstant({ timeline: input.semantic, narrative: input.narrative,
      source: input.moment, sourceKind: "moment", spec: narrativeSpec(`${input.itemId}.start`, subjectId, input.projection.start) }),
    projectNarrativeInstant({ timeline: input.semantic, narrative: input.narrative,
      source: input.moment, sourceKind: "moment", spec: narrativeSpec(`${input.itemId}.end`, subjectId, input.projection.end) }));
}

function narrativeSpec(id: string, subjectId: string, expression: NarrativeInstantExpression) {
  return { id, subjectId,
    boundary: expression.ref === "moment.cue" ? "cue" as const : expression.ref.endsWith(".start") ? "start" as const : "end" as const,
    ...(expression.offset === undefined ? {} : { offset: expression.offset }) };
}
