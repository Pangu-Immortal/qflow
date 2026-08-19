import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  commentStickerComponent,
  commentStickerManifest,
  commentStickerModuleRef,
  decodeCommentStickerStyleSurface,
  decodeCommentStickerTrackSurface,
  commentStickerMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{
    manifest: commentStickerManifest,
  }],
  components: [commentStickerComponent],
  hostFacets: [
    createMarkupSurfaceHostFacet({
      module: commentStickerModuleRef,
    declaration: commentStickerMarkupSurfaces.find((item) => item.name === "style")!,
      handler: decodeCommentStickerStyleSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: commentStickerModuleRef,
    declaration: commentStickerMarkupSurfaces.find((item) => item.name === "track")!,
      handler: decodeCommentStickerTrackSurface,
    }),
  ],
};

export default qflowPackage;
