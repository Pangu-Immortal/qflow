import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";

import { emojiRevealComponent, emojiRevealManifest, emojiRevealMarkupSurfaces, emojiRevealModuleRef } from "./index.js";
import { decodeEmojiRevealStyleSurface, decodeEmojiRevealTrackSurface } from "./surface.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: emojiRevealManifest }],
  facets: [
    createProducerPackageFacet(emojiRevealComponent),
    createAdmissionPackageFacet(emojiRevealComponent),
    createMarkupSurfaceFacet({ module: emojiRevealModuleRef, declaration: emojiRevealMarkupSurfaces.find((item) => item.name === "style")!, handler: decodeEmojiRevealStyleSurface }),
    createMarkupSurfaceFacet({ module: emojiRevealModuleRef, declaration: emojiRevealMarkupSurfaces.find((item) => item.name === "emojiReveal")!, handler: decodeEmojiRevealTrackSurface }),
  ],
};
export default qflowPackage;
