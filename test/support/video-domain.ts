import { blobManifest } from "@qflow/blob";
import { compositionComponent, compositionManifest } from "@qflow/composition";
import { mediaComponent, mediaManifest } from "@qflow/media";
import { narrativeManifest } from "@qflow/narrative";
import { narrativeTemporalManifest } from "@qflow/narrative-temporal";
import { timelineManifest } from "@qflow/timeline";
import { spatialComponent, spatialManifest } from "@qflow/spatial";
import { speechAlignmentManifest } from "@qflow/narrative-speech-alignment";
import { speechEvidenceManifest } from "@qflow/speech-evidence";
import { recipeManifest } from "@qflow/recipe";
import { temporalManifest } from "@qflow/temporal";

/** Shared test fixture only; production packages import only the contracts they use. */
export const videoContractManifests = [
  blobManifest,
  narrativeManifest,
  narrativeTemporalManifest,
  mediaManifest,
  speechAlignmentManifest,
  speechEvidenceManifest,
  recipeManifest,
  timelineManifest,
  spatialManifest,
  temporalManifest,
  compositionManifest,
] as const;

export { compositionComponent, mediaComponent, spatialComponent };
