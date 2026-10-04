import type { ComponentPackage, ProducerHandlerContext } from "@qflow/component-kit";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import type { Timeline } from "@qflow/timeline";

import {
  composeTemporalWindow,
  projectProgramInstant,
} from "./projection.js";
import { temporalExtentFromDomain, temporalExtentFromDuration } from "./extent.js";
import { temporalProducers } from "./index.js";
import type { LocalTemporalDomain, TemporalDuration, TemporalExtent, TemporalInstant, TemporalInstantSpec, TemporalShiftSpec, TemporalWindowSpec } from "./types.js";
import { shiftTemporalInstant } from "./projection.js";

function inline<T>(value: StoredValue | undefined, label: string): T {
  if (value?.kind !== "inline") throw new Error(`${label} must be inline.`);
  return value.value as unknown as T;
}

const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

function instantSpec(inputs: ProducerHandlerContext["inputs"]): TemporalInstantSpec {
  return inline<TemporalInstantSpec>(inputs.spec?.value, "TemporalInstantSpec");
}

export const temporalComponent = {
  producers: [
    { producer: temporalProducers.extentFromDomain, handler: ({ inputs }) => ({ outputs: { extent: output(
      temporalExtentFromDomain(inline<LocalTemporalDomain>(inputs.domain?.value, "LocalTemporalDomain")),
    ) }, needs: {} }) },
    { producer: temporalProducers.extentFromDuration, handler: ({ inputs }) => ({ outputs: { extent: output(
      temporalExtentFromDuration(inline<TemporalDuration>(inputs.duration?.value, "TemporalDuration"),
        inline<Timeline>(inputs.timeline?.value, "Timeline")),
    ) }, needs: {} }) },
    { producer: temporalProducers.projectProgramInstant, handler: ({ inputs }) => ({ outputs: { instant: output(projectProgramInstant({
      itemId: instantSpec(inputs).id,
      subjectId: instantSpec(inputs).subjectId,
      timeline: inline<Timeline>(inputs.timeline?.value, "Timeline"),
      projection: instantSpec(inputs).projection,
    })) }, needs: {} }) },
    { producer: temporalProducers.shiftInstant, handler: ({ inputs }) => ({ outputs: { instant: output(shiftTemporalInstant(
      inline<TemporalShiftSpec>(inputs.spec?.value, "TemporalShiftSpec"),
      inline<Timeline>(inputs.timeline?.value, "Timeline"),
      inline<TemporalInstant>(inputs.instant?.value, "TemporalInstant"),
      inline<TemporalExtent>(inputs.extent?.value, "TemporalExtent"),
    )) }, needs: {} }) },
    { producer: temporalProducers.reuseInstant, handler: ({ inputs }) => ({ outputs: { instant: output(
      inline<TemporalInstant>(inputs.instant?.value, "TemporalInstant"),
    ) }, needs: {} }) },
    { producer: temporalProducers.composeWindow, handler: ({ inputs }) => ({ outputs: { window: output(composeTemporalWindow(
      inline<TemporalWindowSpec>(inputs.spec?.value, "TemporalWindowSpec"),
      inline<TemporalInstant>(inputs.start?.value, "TemporalInstant start"),
      inline<TemporalInstant>(inputs.end?.value, "TemporalInstant end"),
    )) }, needs: {} }) },
  ],
} satisfies ComponentPackage;
