import { mediaDependency, timelineDependency } from "./schema.js";
import type { ModuleManifest, TypeRef } from "@qflow/qflow/protocol";
import { audioTrackSchema, compositionSchema, visualTrackSchema } from "./schema.js";
export const compositionModuleRef = { name: "@qflow/composition", version: "1" } as const;
export const compositionTypes = { visualTrack: { module: compositionModuleRef, name: "VisualTrack" }, audioTrack: { module: compositionModuleRef, name: "AudioTrack" }, composition: { module: compositionModuleRef, name: "Composition" } } satisfies Record<string, TypeRef>;
export const compositionManifest: ModuleManifest = { format: "qflow.module@1", name: compositionModuleRef.name, version: compositionModuleRef.version,
  dependencies: [mediaDependency, timelineDependency], types: [
    { name: compositionTypes.visualTrack.name },
    { name: compositionTypes.audioTrack.name },
    { name: compositionTypes.composition.name },
  ], capabilities: [], producers: [] };
export const compositionDependency = { module: compositionModuleRef } as const;
