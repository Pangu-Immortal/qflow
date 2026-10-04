import { artifactManifest } from "@qflow/artifact";
import { compositionComponent, compositionManifest } from "@qflow/composition";
import { mediaComponent, mediaManifest } from "@qflow/media";
import { narrativeManifest } from "@qflow/narrative";
import { narrativeTemporalManifest } from "@qflow/narrative-temporal";
import { timelineManifest } from "@qflow/timeline";
import { spatialComponent, spatialManifest } from "@qflow/spatial";
import { speechManifest } from "@qflow/speech";
import { speechAlignmentManifest } from "@qflow/speech-alignment";
import { speechEvidenceManifest } from "@qflow/speech-evidence";
import { svsManifest } from "@qflow/svs";
import { temporalManifest } from "@qflow/temporal";
import { visualIrManifest } from "@qflow/visual-ir";

/** Shared test fixture only; production packages import only the contracts they use. */
export const videoContractManifests = [
  artifactManifest,
  narrativeManifest,
  narrativeTemporalManifest,
  mediaManifest,
  speechManifest,
  speechAlignmentManifest,
  speechEvidenceManifest,
  svsManifest,
  timelineManifest,
  spatialManifest,
  temporalManifest,
  visualIrManifest,
  compositionManifest,
] as const;

export { compositionComponent, mediaComponent, spatialComponent };
