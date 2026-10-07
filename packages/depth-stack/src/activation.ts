import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioTrackCompanionFacet } from "@qflow/studio-companion";

import {
  decodeDepthStackLabelSurface,
  decodeDepthStackSurface,
  depthStackComponent,
  depthStackManifest,
  depthStackModuleRef,
  depthStackMarkupSurfaces,
} from "./index.js";
import { depthStackStudioTrackCompanions } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{
    manifest: depthStackManifest,
  }],
  facets: [
    ...[depthStackComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({
      module: depthStackModuleRef,
    declaration: depthStackMarkupSurfaces.find((item) => item.name === "label")!,
      handler: decodeDepthStackLabelSurface,
    }),
    createMarkupSurfaceFacet({
      module: depthStackModuleRef,
    declaration: depthStackMarkupSurfaces.find((item) => item.name === "track")!,
      handler: decodeDepthStackSurface,
    }),
    createStudioTrackCompanionFacet(depthStackStudioTrackCompanions),
  ],
};

export default qflowPackage;
