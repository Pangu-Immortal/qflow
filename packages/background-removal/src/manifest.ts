import { artifactDependency, artifactTypes } from "@qflow/artifact";
import type { CapabilityRef, ModuleManifest, ProducerRef } from "@qflow/protocol";

export const backgroundRemovalModuleRef = { name: "@qflow/background-removal", version: "1" } as const;
export const backgroundRemovalCapabilities = {
  remove: { module: backgroundRemovalModuleRef, name: "remove-background" },
} satisfies Record<string, CapabilityRef>;
export const backgroundRemovalProducers = {
  request: { module: backgroundRemovalModuleRef, name: "request-background-removal" },
} satisfies Record<string, ProducerRef>;

export const backgroundRemovalMarkupSurfaces = [{
    name: "background", tag: "Background", mode: "structured", outputs: [artifactTypes.blob],
  }] as const;


export const backgroundRemovalManifest: ModuleManifest = {
  format: "qflow.module@1", name: backgroundRemovalModuleRef.name, version: backgroundRemovalModuleRef.version,
  dependencies: [artifactDependency], types: [],
  capabilities: [{ name: backgroundRemovalCapabilities.remove.name, returns: artifactTypes.blob }],
  producers: [{
    name: backgroundRemovalProducers.request.name,
    inputs: [{ name: "source", type: artifactTypes.blob }], outputs: [],
    needs: [{ name: "image", capability: backgroundRemovalCapabilities.remove, returns: artifactTypes.blob }],
  }],
};
export const backgroundRemovalDependency = { module: backgroundRemovalModuleRef } as const;
