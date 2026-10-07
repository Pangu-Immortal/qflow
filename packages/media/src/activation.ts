import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/markup";

import {
  decodeMediaAudioSurface, decodeMediaFontStackSurface, decodeMediaFontSurface, decodeMediaImageSurface, decodeMediaVideoSurface, mediaComponent,
  mediaManifest,
  mediaModuleRef,
  mediaMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: mediaManifest }],
  facets: [
    ...[mediaComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({
      module: mediaModuleRef,
    declaration: mediaMarkupSurfaces.find((item) => item.name === "image")!,
      handler: decodeMediaImageSurface,
    }),
    createMarkupSurfaceFacet({
      module: mediaModuleRef,
    declaration: mediaMarkupSurfaces.find((item) => item.name === "audio")!,
      handler: decodeMediaAudioSurface,
    }),
    createMarkupSurfaceFacet({
      module: mediaModuleRef,
    declaration: mediaMarkupSurfaces.find((item) => item.name === "video")!,
      handler: decodeMediaVideoSurface,
    }),
    createMarkupSurfaceFacet({
      module: mediaModuleRef,
    declaration: mediaMarkupSurfaces.find((item) => item.name === "font")!,
      handler: decodeMediaFontSurface,
    }),
    createMarkupSurfaceFacet({
      module: mediaModuleRef,
      declaration: mediaMarkupSurfaces.find((item) => item.name === "font-stack")!,
      handler: decodeMediaFontStackSurface,
    }),
  ],
};

export default qflowPackage;
