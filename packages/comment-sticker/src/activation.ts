import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioTrackCompanionFacet } from "@qflow/studio-companion";

import {
  commentStickerComponent,
  commentStickerManifest,
  commentStickerModuleRef,
  decodeCommentStickerStyleSurface,
  decodeCommentStickerTrackSurface,
  commentStickerMarkupSurfaces,
} from "./index.js";
import { commentStickerStudioTrackCompanions } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{
    manifest: commentStickerManifest,
  }],
  facets: [
    ...[commentStickerComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({
      module: commentStickerModuleRef,
    declaration: commentStickerMarkupSurfaces.find((item) => item.name === "style")!,
      handler: decodeCommentStickerStyleSurface,
    }),
    createMarkupSurfaceFacet({
      module: commentStickerModuleRef,
    declaration: commentStickerMarkupSurfaces.find((item) => item.name === "track")!,
      handler: decodeCommentStickerTrackSurface,
    }),
    createStudioTrackCompanionFacet(commentStickerStudioTrackCompanions),
  ],
};

export default qflowPackage;
