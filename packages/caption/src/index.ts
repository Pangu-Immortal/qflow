export { CaptionTimingError } from "./error.js";
export {
  assertCaptionDocument,
  assertCaptionUnitSubset,
  captionUnitsForRole,
  captionUnitsForSelection,
} from "./display.js";
export type { CaptionUnitSubset } from "./display.js";
export { captionWordsForAttribute } from "./display.js";
export { captionComponent } from "./component.js";
export { captionTimingFragment } from "./fragment.js";
export {
  captionProgramSchema,
  captionStyleSchema,
  timedCaptionProjectionSchema,
  captionManifest,
  captionMarkupSurfaces,
  captionModuleRef,
  captionProducers,
  captionTypes,
} from "./manifest.js";
export { decodeHiddenCaptionStyleSurface } from "./surface.js";
export {
  assertCaptionProgram,
  assertCaptionProgramForDocument,
  assertCaptionStyle,
  appendCaptionUse,
  sealCaptionProgram,
  sealCaptionStyle,
} from "./style.js";
export { assertTimedCaptionProjection, temporalizeCaptionDocument } from "./temporalize.js";
export type * from "./types.js";

export { captionUseVisibility } from "./visibility.js";
