import type {
  ModuleManifest,
  TypeRef,
} from "@qflow/protocol";

export const blobModuleRef = { name: "@qflow/blob", version: "1" } as const;

export const blobTypes = {
  blob: { module: blobModuleRef, name: "Blob" },
} satisfies Record<string, TypeRef>;

export const blobManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: blobModuleRef.name,
  version: blobModuleRef.version,
  dependencies: [],
  types: [{ name: blobTypes.blob.name }],
  capabilities: [],
  producers: [],
};

export const blobDependency = {
  module: blobModuleRef,
} as const;
