import type { ModuleManifest, TypeRef } from "@qflow/protocol";

export const svsModuleRef = { name: "@qflow/svs", version: "1" } as const;
export const svsRecipeType = { module: svsModuleRef, name: "Recipe" } satisfies TypeRef;
export const svsFrontendId = "@qflow/svs@1";

export const svsManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: svsModuleRef.name,
  version: svsModuleRef.version,
  dependencies: [],
  types: [{
    name: svsRecipeType.name,
  }],
  capabilities: [],
  producers: [],
};
