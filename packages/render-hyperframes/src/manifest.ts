import { artifactDependency } from "@qflow/artifact";
import { mediaDependency, mediaTypes } from "@qflow/media";
import { compositionDependency } from "@qflow/composition";
import {
  hyperframesManifest,
  hyperframesModuleRef,
  hyperframesTypes,
} from "@qflow/hyperframes";
import type {
  CapabilityRef,
  ModuleManifest,
  ProducerRef,
} from "@qflow/protocol";
import {
  mediaPipelineModuleRef,
} from "@qflow/media-pipeline";

export const renderHyperframesModuleRef = { name: "@qflow/render-hyperframes", version: "1" } as const;
export const renderHyperframesCapabilities = {
  renderVisual: { module: renderHyperframesModuleRef, name: "render-visual" },
} satisfies Record<string, CapabilityRef>;
export const renderHyperframesProducers = {
  requestVisual: { module: renderHyperframesModuleRef, name: "request-visual-render" },
} satisfies Record<string, ProducerRef>;

export const renderHyperframesMarkupSurfaces = [{
    name: "video",
    tag: "Video",
    mode: "structured",
    outputs: [],
  }] as const;


export const renderHyperframesManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: renderHyperframesModuleRef.name,
  version: renderHyperframesModuleRef.version,
  dependencies: [
    artifactDependency,
    mediaDependency,
    compositionDependency,
    { module: hyperframesModuleRef },
    { module: mediaPipelineModuleRef },
  ],
  types: [],
  capabilities: [{
    name: renderHyperframesCapabilities.renderVisual.name,
    returns: mediaTypes.renderedVisual,
  }],
  producers: [
    {
      name: renderHyperframesProducers.requestVisual.name,
      inputs: [{ name: "document", type: hyperframesTypes.document }],
      outputs: [],
      needs: [{
        name: "visual",
        capability: renderHyperframesCapabilities.renderVisual,
        returns: mediaTypes.renderedVisual,
      }],
    },
  ],
};
