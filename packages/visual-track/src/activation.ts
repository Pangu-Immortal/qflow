import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioCompanionFacet } from "@qflow/studio-companion";
import {
  decodeVisualTrackSurface,
  decodeVisualMotionSurface,
  decodeVisualSourceTimeSurface,
  visualTrackComponent,
  visualTrackManifest,
  visualTrackModuleRef,
  visualTrackMarkupSurfaces,
} from "./index.js";
import { visualTrackStudioParameterCompanions, visualTrackStudioTrackCompanions } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: visualTrackManifest }],
  facets: [
    ...[visualTrackComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({
      module: visualTrackModuleRef,
      declaration: visualTrackMarkupSurfaces.find((item) => item.name === "track")!,
      handler: decodeVisualTrackSurface,
    }),
    createMarkupSurfaceFacet({
      module: visualTrackModuleRef,
      declaration: visualTrackMarkupSurfaces.find((item) => item.name === "motion")!,
      handler: decodeVisualMotionSurface,
    }),
    createMarkupSurfaceFacet({
      module: visualTrackModuleRef,
      declaration: visualTrackMarkupSurfaces.find((item) => item.name === "source-time")!,
      handler: decodeVisualSourceTimeSurface,
    }),
    createStudioCompanionFacet({
      tracks: visualTrackStudioTrackCompanions,
      parameters: visualTrackStudioParameterCompanions,
    }),
  ],
};
export default qflowPackage;
