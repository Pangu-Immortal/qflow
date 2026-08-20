import { artifactManifest } from "@qflow/artifact";
import { compositionComponent, compositionManifest } from "@qflow/composition";
import { mediaComponent, mediaManifest } from "@qflow/media";
import { narrativeManifest } from "@qflow/narrative";
import { programSpaceManifest } from "@qflow/program-space";
import { semanticTrackManifest } from "@qflow/semantic-track";
import { spatialComponent, spatialManifest } from "@qflow/spatial";
import { speechManifest } from "@qflow/speech";
import { speechEvidenceManifest } from "@qflow/speech-evidence";
import { temporalManifest } from "@qflow/temporal";
import { visualIrManifest } from "@qflow/visual-ir";

/** Shared test fixture only; production packages import only the contracts they use. */
export const videoContractManifests = [
  artifactManifest,
  narrativeManifest,
  mediaManifest,
  programSpaceManifest,
  speechManifest,
  speechEvidenceManifest,
  semanticTrackManifest,
  spatialManifest,
  temporalManifest,
  visualIrManifest,
  compositionManifest,
] as const;

export { compositionComponent, mediaComponent, spatialComponent };
