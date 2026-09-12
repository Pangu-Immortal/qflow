import { projectTimelineSpace } from "@qflow/timeline";
import type { NarrativeExcerpt, NarrativeMomentRef, NarrativeSelectionRef } from "@qflow/narrative";
import type { Timeline } from "@qflow/timeline";
import {
  composeTemporalWindow,
  projectMomentInstant,
  projectProgramInstant,
  projectSegmentInstant,
  projectSelectionInstant,
} from "@qflow/temporal";
import type { TemporalInstantExpression } from "@qflow/temporal";

export type TemporalWindowProjection = {
  readonly start: TemporalInstantExpression;
  readonly end: TemporalInstantExpression;
};

const fixed = { kind: "fixed" as const };

export function projectProgramInstantFixture(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly projection: TemporalInstantExpression;
}) {
  return projectProgramInstant({ ...input, timeline: input.semantic, subjectId: input.subjectId ?? input.itemId, authority: fixed });
}

export function projectMomentInstantFixture(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly moment: NarrativeMomentRef;
  readonly projection: TemporalInstantExpression;
}) {
  return projectMomentInstant({ ...input, timeline: input.semantic, subjectId: input.subjectId ?? input.itemId, authority: fixed });
}

export function projectProgramWindow(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly projection: TemporalWindowProjection;
}) {
  const subjectId = input.subjectId ?? input.itemId;
  return composeTemporalWindow({ id: input.itemId, subjectId },
    projectProgramInstant({ itemId: `${input.itemId}.start`, subjectId, timeline: input.semantic, projection: input.projection.start, authority: fixed }),
    projectProgramInstant({ itemId: `${input.itemId}.end`, subjectId, timeline: input.semantic, projection: input.projection.end, authority: fixed }));
}

export function projectSelectionWindow(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly selection: NarrativeSelectionRef;
  readonly projection: TemporalWindowProjection;
}) {
  const subjectId = input.subjectId ?? input.itemId;
  return composeTemporalWindow({ id: input.itemId, subjectId },
    projectSelectionInstant({ itemId: `${input.itemId}.start`, subjectId, timeline: input.semantic, selection: input.selection, projection: input.projection.start, authority: fixed }),
    projectSelectionInstant({ itemId: `${input.itemId}.end`, subjectId, timeline: input.semantic, selection: input.selection, projection: input.projection.end, authority: fixed }));
}

export function projectSegmentWindow(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly segment: NarrativeExcerpt;
  readonly projection: TemporalWindowProjection;
}) {
  const subjectId = input.subjectId ?? input.itemId;
  return composeTemporalWindow({ id: input.itemId, subjectId },
    projectSegmentInstant({ itemId: `${input.itemId}.start`, subjectId, timeline: input.semantic, segment: input.segment, projection: input.projection.start, authority: fixed }),
    projectSegmentInstant({ itemId: `${input.itemId}.end`, subjectId, timeline: input.semantic, segment: input.segment, projection: input.projection.end, authority: fixed }));
}

export function projectMomentWindow(input: {
  readonly itemId: string;
  readonly subjectId?: string;
  readonly semantic: Timeline;
  readonly moment: NarrativeMomentRef;
  readonly projection: TemporalWindowProjection;
}) {
  const subjectId = input.subjectId ?? input.itemId;
  return composeTemporalWindow({ id: input.itemId, subjectId },
    projectMomentInstant({ itemId: `${input.itemId}.start`, subjectId, timeline: input.semantic, moment: input.moment, projection: input.projection.start, authority: fixed }),
    projectMomentInstant({ itemId: `${input.itemId}.end`, subjectId, timeline: input.semantic, moment: input.moment, projection: input.projection.end, authority: fixed }));
}
