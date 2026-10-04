export { textFineComponent } from "./component.js";
export { fineTextOccurrenceSchema, fineTextWindowAttributeVocabulary, textFineManifest, textFineMarkupSurfaces, textFineModuleRef, textFineProducers, textFineTypes } from "./manifest.js";
export { assertFineTextOccurrenceIdentity, assertPlainTextItemSpec, bindAreaTextPlacement, bindPathTextPlacement, bindPointTextPlacement, assertTextItemSpec, assertTextMaskSpec, assertTextMotion, assertTextPathMotion, assertTextPlacement, assertTextStyle, createFineTextOccurrence, renderFineTextMask, renderFineTextOccurrence, sealTextItemSpec, sealPlainTextItemSpec, materializePlainTextItem, sealTextMotion, sealTextPathMotion, sealTextMaskSpec, sealTextPlacement, sealTextStyle, stillTextMotion, stillTextPathMotion } from "./program.js";
export {
  decodeTypographyMotionSurface,
  decodeTypographyPathMotionSurface,
  decodeTypographyFlowSurface,
  decodeTypographyPointSurface,
  decodeTypographyPathSurface,
  decodeTypographyStyleSurface,
  decodeTypographyMaskSurface,
} from "./surface.js";
export type * from "./types.js";
