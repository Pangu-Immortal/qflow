import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioCompanionFacet } from "@qflow/studio-companion";
import {
  audioTrackComponent,
  audioTrackManifest,
  audioTrackModuleRef,
  decodeAudioTrackSurface,
  decodeAudioSourceTimeSurface,
  audioTrackMarkupSurfaces,
} from "./index.js";
import { audioTrackStudioParameterCompanions, audioTrackStudioTrackCompanions } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: audioTrackManifest }],
  facets: [
    ...[audioTrackComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({
      module: audioTrackModuleRef,
      declaration: audioTrackMarkupSurfaces.find((item) => item.name === "track")!,
      handler: decodeAudioTrackSurface,
    }),
    createMarkupSurfaceFacet({
      module: audioTrackModuleRef,
      declaration: audioTrackMarkupSurfaces.find((item) => item.name === "source-time")!,
      handler: decodeAudioSourceTimeSurface,
    }),
    createStudioCompanionFacet({
      tracks: audioTrackStudioTrackCompanions,
      parameters: audioTrackStudioParameterCompanions,
    }),
  ],
};
export default qflowPackage;
