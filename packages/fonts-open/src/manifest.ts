import { mediaDependency, mediaTypes } from "@qflow/media";
import type { ModuleManifest } from "@qflow/protocol";

export const fontsOpenModuleRef = { name: "@qflow/fonts-open", version: "1" } as const;

export const fontsOpenMarkupSurfaces = [{
    name: "face",
    tag: "Face",
    mode: "structured",
    outputs: [mediaTypes.fontArtifact],
  }, {
    name: "stack",
    tag: "Stack",
    mode: "structured",
    outputs: [mediaTypes.fontStack],
  }] as const;


export const fontsOpenManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: fontsOpenModuleRef.name,
  version: fontsOpenModuleRef.version,
  dependencies: [mediaDependency],
  types: [],
  capabilities: [],
  producers: [],
};
