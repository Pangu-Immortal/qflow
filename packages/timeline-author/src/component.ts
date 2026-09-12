import type { ProgramClock } from "@qflow/program-space";
import type { ComponentPackage } from "@qflow/component-kit";
import type { StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";
import type { SemanticTake } from "@qflow/speech";

import { timelineAuthorProducers } from "./manifest.js";
import { appendTimelineAuthorTake, assembleTimelineAuthor, createTimelineAuthorSet } from "./program.js";
import type { TimelineAuthorHeader, TimelineAuthorSet } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as unknown as T;
}

export const timelineAuthorComponent = {
  producers: [
    {
      producer: timelineAuthorProducers.createSet,
      handler: () => ({
        outputs: { set: { kind: "inline", value: canonicalize(createTimelineAuthorSet()) } },
        needs: {},
      }),
    },
    {
      producer: timelineAuthorProducers.appendTake,
      handler: ({ inputs }) => ({
        outputs: { set: { kind: "inline", value: canonicalize(appendTimelineAuthorTake(
          inline<TimelineAuthorSet>(inputs.set?.value, "TimelineAuthorSet"),
          inline<SemanticTake>(inputs.take?.value, "SemanticTake"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: timelineAuthorProducers.assembleTrack,
      handler: ({ inputs }) => ({
        outputs: { track: { kind: "inline", value: canonicalize(assembleTimelineAuthor(
          inline<TimelineAuthorHeader>(inputs.header?.value, "TimelineAuthorHeader"),
          inline<TimelineAuthorSet>(inputs.set?.value, "TimelineAuthorSet"),
          inline<ProgramClock>(inputs.clock?.value, "ProgramClock"),
        )) } },
        needs: {},
      }),
    },
  ],
} satisfies ComponentPackage;
