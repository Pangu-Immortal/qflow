import { compositionDependency, compositionTypes } from "@qflow/composition";
import { narrativeDependency } from "@qflow/narrative";
import { programSpaceDependency, programSpaceSchema, programSpaceTypes } from "@qflow/program-space";
import type { ModuleManifest, ProducerRef, TypeRef, ValueSchema } from "@qflow/protocol";
import { semanticTakeSchema, speechDependency } from "@qflow/speech";

export const timelineModuleRef = { name: "@qflow/timeline", version: "1" } as const;
export const timelineTypes = {
  track: { module: timelineModuleRef, name: "Timeline" },
} satisfies Record<string, TypeRef>;
export const timelineProducers = {
  projectProgramSpace: { module: timelineModuleRef, name: "project-program-space" },
  projectAudio: { module: timelineModuleRef, name: "project-audio-track" },
} satisfies Record<string, ProducerRef>;

const string = { kind: "string", minLength: 1 } as const;
const object = (fields: Readonly<Record<string, { readonly schema: ValueSchema; readonly optional?: boolean }>>): ValueSchema => ({ kind: "object", fields });
export const timelineSchema: ValueSchema = object({
  ...(programSpaceSchema.kind === "object" ? programSpaceSchema.fields : {}),
  narrativeId: { schema: string, optional: true },
  items: { schema: { kind: "array", items: object({
    startFrame: { schema: { kind: "number", integer: true, minimum: 0 } },
    take: { schema: semanticTakeSchema },
  }) } },
});

export const timelineManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: timelineModuleRef.name,
  version: timelineModuleRef.version,
  dependencies: [speechDependency, narrativeDependency, programSpaceDependency, compositionDependency],
  types: [{ name: timelineTypes.track.name }],
  capabilities: [],
  producers: [
    { name: timelineProducers.projectProgramSpace.name, inputs: [{ name: "track", type: timelineTypes.track }], outputs: [{ name: "space", type: programSpaceTypes.programSpace }], needs: [] },
    { name: timelineProducers.projectAudio.name, inputs: [{ name: "track", type: timelineTypes.track }], outputs: [{ name: "audio", type: compositionTypes.audioTrack }], needs: [] },
  ],
};
export const timelineDependency = { module: timelineModuleRef } as const;
