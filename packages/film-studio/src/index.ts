import { timelineTypes } from "@qflow/timeline";
import type { StudioFilmCompanion } from "@qflow/studio-adapter";
import { compositionTypes } from "@qflow/composition";
import { filmModuleRef } from "@qflow/film";

/** Film owns the author vocabulary that selects its time source and peer Tracks. */
export const filmStudioCompanions: readonly StudioFilmCompanion[] = [{
  id: "film",
  match: { module: filmModuleRef, surface: "film", outputType: compositionTypes.composition },
  timeSources: [{ attribute: "timeline", type: timelineTypes.track }],
  tracks: {
    childSurface: "Track",
    sourceAttribute: "source",
    types: [compositionTypes.visualTrack, compositionTypes.audioTrack],
  },
}];
