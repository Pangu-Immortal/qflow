import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import { emojiRevealComponent, emojiRevealManifest, emojiRevealMarkupSurfaces, emojiRevealModuleRef } from "./index.js";
import { decodeEmojiRevealStyleSurface, decodeEmojiRevealTrackSurface } from "./surface.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: emojiRevealManifest }], components: [emojiRevealComponent],
  hostFacets: [
    createMarkupSurfaceHostFacet({ module: emojiRevealModuleRef, declaration: emojiRevealMarkupSurfaces.find((item) => item.name === "style")!, handler: decodeEmojiRevealStyleSurface }),
    createMarkupSurfaceHostFacet({ module: emojiRevealModuleRef, declaration: emojiRevealMarkupSurfaces.find((item) => item.name === "emojiReveal")!, handler: decodeEmojiRevealTrackSurface }),
  ],
};
export default qflowPackage;
