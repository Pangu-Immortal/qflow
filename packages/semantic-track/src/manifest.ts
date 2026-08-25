import { compositionDependency, compositionTypes } from "@qflow/composition";
import { narrativeDependency } from "@qflow/narrative";
import { programSpaceDependency, programSpaceTypes } from "@qflow/program-space";
import type { ModuleManifest, ProducerRef, TypeRef, ValueSchema } from "@qflow/protocol";
import { semanticTakeSchema, speechDependency } from "@qflow/speech";

export const semanticTrackModuleRef = { name: "@qflow/semantic-track", version: "1" } as const;
export const semanticTrackTypes = {
  track: { module: semanticTrackModuleRef, name: "SemanticTrack" },
} satisfies Record<string, TypeRef>;
export const semanticTrackProducers = {
  projectProgramSpace: { module: semanticTrackModuleRef, name: "project-program-space" },
  projectAudio: { module: semanticTrackModuleRef, name: "project-audio-track" },
} satisfies Record<string, ProducerRef>;

const string = { kind: "string", minLength: 1 } as const;
const object = (fields: Readonly<Record<string, { readonly schema: ValueSchema; readonly optional?: boolean }>>): ValueSchema => ({ kind: "object", fields });
export const semanticTrackSchema: ValueSchema = object({
  id: { schema: string },
  narrativeId: { schema: string },
  items: { schema: { kind: "array", minItems: 1, items: object({
    take: { schema: semanticTakeSchema },
  }) } },
});

export const semanticTrackManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: semanticTrackModuleRef.name,
  version: semanticTrackModuleRef.version,
  dependencies: [speechDependency, narrativeDependency, programSpaceDependency, compositionDependency],
  types: [{ name: semanticTrackTypes.track.name }],
  capabilities: [],
  producers: [
    { name: semanticTrackProducers.projectProgramSpace.name, inputs: [{ name: "track", type: semanticTrackTypes.track }], outputs: [{ name: "space", type: programSpaceTypes.programSpace }], needs: [] },
    { name: semanticTrackProducers.projectAudio.name, inputs: [{ name: "track", type: semanticTrackTypes.track }], outputs: [{ name: "audio", type: compositionTypes.audioTrack }], needs: [] },
  ],
};
export const semanticTrackDependency = { module: semanticTrackModuleRef } as const;
