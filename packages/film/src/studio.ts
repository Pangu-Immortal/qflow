import { compositionTypes } from "@qflow/composition";
import type { StudioFilmCompanion } from "@qflow/studio-companion";
import { timelineTypes } from "@qflow/timeline";

import { filmModuleRef } from "./manifest.js";

/** Film owns the author vocabulary that selects its time source and peer Tracks. */
export const filmStudioCompanions: readonly StudioFilmCompanion[] = [{
  id: "film",
  match: { module: filmModuleRef, surface: "film", outputType: compositionTypes.composition },
  timeSources: [{ attribute: "timeline", type: timelineTypes.timeline }],
  tracks: {
    childSurface: "Track",
    sourceAttribute: "source",
    types: [compositionTypes.visualTrack, compositionTypes.audioTrack],
  },
}];
