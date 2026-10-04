import type { ComponentPackage } from "@qflow/component-kit";
import type { Narrative, NarrativeExcerpt, NarrativeMomentRef, NarrativeSelectionRef } from "@qflow/narrative";
import { canonicalize } from "@qflow/protocol";
import type { ProducerRef, StoredValue } from "@qflow/protocol";
import type { LocalTemporalDomain, TemporalWindow } from "@qflow/temporal";
import type { Timeline } from "@qflow/timeline";

import { assertNarrativeAlignmentIdentity } from "./identity.js";
import { materializeSegmentBoundaryAlignment } from "./materialize.js";
import { narrativeTemporalProducers, narrativeTemporalTypes } from "./manifest.js";
import { createNarrativeProjection, projectNarrativeAlignment, projectNarrativeInstant } from "./projection.js";
import type { NarrativeAlignment, NarrativeInstantSpec, NarrativeProjection, NarrativeProjectionHeader, NarrativeProjectionParts } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

export const narrativeTemporalComponent = {
  validators: [{ type: narrativeTemporalTypes.narrativeAlignment,
    handler: ({ value }) => assertNarrativeAlignmentIdentity(inline<NarrativeAlignment>(value, "NarrativeAlignment")) }],
  producers: [{
    producer: narrativeTemporalProducers.materializeSegmentBoundaries,
    handler: ({ inputs }) => ({ outputs: { alignment: { kind: "inline", value: canonicalize(materializeSegmentBoundaryAlignment(
      inline<Narrative>(inputs.narrative?.value, "Narrative"),
      inline<NarrativeExcerpt>(inputs.segment?.value, "NarrativeExcerpt"),
      inline<LocalTemporalDomain>(inputs.domain?.value, "LocalTemporalDomain"),
    )) } }, needs: {} }),
  }, {
    producer: narrativeTemporalProducers.projectAlignment,
    handler: ({ inputs }) => ({ outputs: { parts: { kind: "inline", value: canonicalize({ parts: [
      projectNarrativeAlignment(
        inline<NarrativeAlignment>(inputs.alignment?.value, "NarrativeAlignment"),
        inline<LocalTemporalDomain>(inputs.domain?.value, "LocalTemporalDomain"),
        inline<TemporalWindow>(inputs.window?.value, "TemporalWindow"),
        inline<Timeline>(inputs.timeline?.value, "Timeline"),
      ),
    ] }) } }, needs: {} }),
  }, {
    producer: narrativeTemporalProducers.combineProjectionParts,
    handler: ({ inputs }) => {
      const left = inline<NarrativeProjectionParts>(inputs.left?.value, "NarrativeProjectionParts");
      const right = inline<NarrativeProjectionParts>(inputs.right?.value, "NarrativeProjectionParts");
      return { outputs: { parts: { kind: "inline" as const, value: canonicalize({ parts: [...left.parts, ...right.parts] }) } }, needs: {} };
    },
  }, {
    producer: narrativeTemporalProducers.finalizeProjection,
    handler: ({ inputs }) => {
      const header = inline<NarrativeProjectionHeader>(inputs.header?.value, "NarrativeProjectionHeader");
      const narrative = inline<Narrative>(inputs.narrative?.value, "Narrative");
      const timeline = inline<Timeline>(inputs.timeline?.value, "Timeline");
      const parts = inline<NarrativeProjectionParts>(inputs.parts?.value, "NarrativeProjectionParts");
      return { outputs: { projection: { kind: "inline" as const, value: canonicalize(
        createNarrativeProjection(header.id, narrative.id, timeline, parts.parts),
      ) } }, needs: {} };
    },
  }, ...([
    projectionFacet(narrativeTemporalProducers.projectSelectionInstant, "selection", "selection"),
    projectionFacet(narrativeTemporalProducers.projectSegmentInstant, "segment", "segment"),
    projectionFacet(narrativeTemporalProducers.projectMomentInstant, "moment", "moment"),
  ])],
} satisfies ComponentPackage;

function projectionFacet(producer: ProducerRef, inputName: "selection" | "segment" | "moment",
  sourceKind: "selection" | "segment" | "moment"): NonNullable<ComponentPackage["producers"]>[number] {
  return { producer, handler: ({ inputs }) => {
    const spec = inline<NarrativeInstantSpec>(inputs.spec?.value, "NarrativeInstantSpec");
    return { outputs: { instant: { kind: "inline" as const, value: canonicalize(projectNarrativeInstant({
      timeline: inline<Timeline>(inputs.timeline?.value, "Timeline"),
      narrative: inline<NarrativeProjection>(inputs.projection?.value, "NarrativeProjection"),
      source: inline<NarrativeSelectionRef | NarrativeExcerpt | NarrativeMomentRef>(inputs[inputName]?.value, inputName),
      sourceKind, spec,
    })) } }, needs: {} };
  } };
}
