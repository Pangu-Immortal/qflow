import type { StudioFilmCompanion } from "@qflow/studio-adapter";
import { compositionTypes } from "@qflow/composition";
import { filmModuleRef } from "@qflow/film";
import { semanticTrackTypes } from "@qflow/semantic-track";

/** Film alone owns the author vocabulary that selects one semantic axis and its peer Tracks. */
export const filmStudioCompanions: readonly StudioFilmCompanion[] = [{
  id: "film",
  match: { module: filmModuleRef, surface: "film", outputType: compositionTypes.composition },
  semantic: { attribute: "semantic", type: semanticTrackTypes.track },
  tracks: {
    childSurface: "Track",
    sourceAttribute: "source",
    types: [compositionTypes.visualTrack, compositionTypes.audioTrack],
  },
}];
