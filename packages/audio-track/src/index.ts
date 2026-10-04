export { audioTrackComponent } from "./component.js";
export { createAudioTrackFragment, programAudioTrackFragment } from "./fragment.js";
export type { AudioTrackFragmentItem } from "./fragment.js";
export { audioClipSpecSchema, audioSourceTimeSchema, audioTrackDependency, audioTrackHeaderSchema, audioTrackManifest, audioTrackMarkupSurfaces, audioTrackModuleRef, audioTrackProducers, audioTrackProgramSchema, audioTrackSetSchema, audioTrackTypes } from "./manifest.js";
export { decodeAudioSourceTimeRelation, decodeAudioSourceTimeSurface, decodeAudioTrackSurface, audioClipDefaults } from "./surface.js";
export { appendAudioClip, assertAudioClipSpec, assertAudioTrackHeader, assertAudioTrackProgram, assertAudioTrackSet, createAudioTrackSet, finalizeAudioTrack, renderAudioTrack, sealAudioClipSpec, sealAudioTrackHeader, sealAudioTrackProgram } from "./program.js";
export { assertAudioSourceTimeSpec, defaultAudioSourceTimeSpec, resolveAudioSourceTime } from "./source-time.js";
export type * from "./types.js";
