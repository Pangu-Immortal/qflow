export { compositionComponent } from "./component.js";
export { compositionDependency, compositionManifest, compositionModuleRef, compositionTypes } from "./manifest.js";
export {
  audioTrackSchema, visualSourceTimeMapSchema,
  compositionSchema,
  visualColorPaintSchema,
  visualPathCommandSchema,
  visualTextDocumentSchema,
  visualTextFlowSchema,
  visualTextPaintSchema,
  visualTextSequenceSchema,
  visualTextTypographySchema,
  visualTrackSchema,
  visualBoxSchema, visualMaskSchema, visualTextSchema, visualImageSchema, visualVideoSchema, visualSurfaceSchema, visualProgramSchema, visualElementSchema,
} from "./schema.js";
export { assertAudioTrackIdentity, assertCompositionIdentity, assertVisualTrackIdentity, sealAudioTrack, sealComposition, sealVisualTrack } from "./track.js";
export { animatableLocalStyles } from "./track.js";
export { visualCompositionVocabulary } from "./introspection.js";
export type * from "./track.js";

export * from "./audio-level-automation.js";
export { audioSampleSpanSchema, audioGainEnvelopeSchema } from "./schema.js";
export {
  assertVisualStyleV1,
  VISUAL_IR_V1,
  VISUAL_STYLE_ENUM_VALUES_V1,
  VISUAL_STYLE_NAMES_V1,
} from "./visual.js";
export type { VisualStyleNameV1 } from "./visual.js";
