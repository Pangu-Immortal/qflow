import type {
  ModuleManifest,
  TypeRef,
} from "@qflow/protocol";

export const artifactModuleRef = { name: "@qflow/artifact", version: "1" } as const;

export const artifactTypes = {
  blob: { module: artifactModuleRef, name: "BlobArtifact" },
} satisfies Record<string, TypeRef>;

export const artifactManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: artifactModuleRef.name,
  version: artifactModuleRef.version,
  dependencies: [],
  types: [{ name: artifactTypes.blob.name }],
  capabilities: [],
  producers: [],
};

export const artifactDependency = {
  module: artifactModuleRef,
} as const;
