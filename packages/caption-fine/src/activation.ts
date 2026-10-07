import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioCompanionFacet } from "@qflow/studio-companion";

import {
  captionFineComponent,
  captionFineManifest,
  captionFineModuleRef,
  decodeFineCaptionStyleSurface,
  decodeFineCaptionTrackSurface,
  captionFineMarkupSurfaces,
} from "./index.js";
import { captionFineStudioParameterCompanions, captionFineStudioTrackCompanions } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{
    manifest: captionFineManifest,
  }],
  facets: [
    ...[captionFineComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({
      module: captionFineModuleRef,
      declaration: captionFineMarkupSurfaces.find((item) => item.name === "style")!,
      handler: decodeFineCaptionStyleSurface,
    }),
    createMarkupSurfaceFacet({
      module: captionFineModuleRef,
      declaration: captionFineMarkupSurfaces.find((item) => item.name === "caption")!,
      handler: decodeFineCaptionTrackSurface,
    }),
    createStudioCompanionFacet({
      tracks: captionFineStudioTrackCompanions,
      parameters: captionFineStudioParameterCompanions,
    }),
  ],
};

export default qflowPackage;
