import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";

import {
  decodeSeedanceFrameVideoSurface,
  decodeSeedanceReferenceVideoSurface,
  decodeSeedanceTextVideoSurface,
  seedanceComponent,
  seedanceDefinition,
  seedanceManifest,
  seedanceModuleRef,
  seedanceMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: seedanceManifest }],
  facets: [
    ...[seedanceComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    seedanceDefinition.facet,
    createMarkupSurfaceFacet({
      module: seedanceModuleRef,
    declaration: seedanceMarkupSurfaces.find((item) => item.name === "text-video")!,
      handler: decodeSeedanceTextVideoSurface,
    }),
    createMarkupSurfaceFacet({
      module: seedanceModuleRef,
    declaration: seedanceMarkupSurfaces.find((item) => item.name === "frame-video")!,
      handler: decodeSeedanceFrameVideoSurface,
    }),
    createMarkupSurfaceFacet({
      module: seedanceModuleRef,
    declaration: seedanceMarkupSurfaces.find((item) => item.name === "reference-video")!,
      handler: decodeSeedanceReferenceVideoSurface,
    }),
  ],
};

export default qflowPackage;
