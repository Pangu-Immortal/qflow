import type { Timeline } from "@qflow/timeline";
import type { CaptionDocument, CaptionProgram, CaptionTiming } from "@qflow/caption";
import type { ProducerPackage } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import type { StoredValue } from "@qflow/qflow/protocol";
import { canonicalize } from "@qflow/qflow/protocol";
import type { RegionEvidence } from "@qflow/region-evidence";
import type { SpatialFrame } from "@qflow/spatial";

import { captionFineProducers } from "./manifest.js";
import { renderFineCaption } from "./render.js";
import { scheduleFineCaption } from "./schedule.js";
import type { FineCaptionSchedule } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

export const captionFineComponent = {
  producers: [
    {
      producer: captionFineProducers.schedule,
      handler: ({ inputs }) => ({
        outputs: { schedule: { kind: "inline", value: canonicalize(scheduleFineCaption(
          inline<CaptionTiming>(inputs.timing?.value, "CaptionTiming"),
          inline<CaptionProgram>(inputs.program?.value, "CaptionProgram"),
          inline<CaptionDocument>(inputs.document?.value, "CaptionDocument"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: captionFineProducers.render,
      handler: ({ inputs }) => ({
        outputs: { track: { kind: "inline", value: canonicalize(renderFineCaption(
          inline<FineCaptionSchedule>(inputs.schedule?.value, "FineCaptionSchedule"),
          inline<CaptionProgram>(inputs.program?.value, "CaptionProgram"),
          inline<CaptionDocument>(inputs.document?.value, "CaptionDocument"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<SpatialFrame>(inputs.within?.value, "SpatialFrame"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: captionFineProducers.renderWithRegions,
      handler: ({ inputs }) => ({
        outputs: { track: { kind: "inline", value: canonicalize(renderFineCaption(
          inline<FineCaptionSchedule>(inputs.schedule?.value, "FineCaptionSchedule"),
          inline<CaptionProgram>(inputs.program?.value, "CaptionProgram"),
          inline<CaptionDocument>(inputs.document?.value, "CaptionDocument"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<SpatialFrame>(inputs.within?.value, "SpatialFrame"),
          inline<RegionEvidence>(inputs.regions?.value, "RegionEvidence"),
        )) } },
        needs: {},
      }),
    },
  ],
} satisfies ProducerPackage & AdmissionPackage;
