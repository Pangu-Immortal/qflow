import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import {
  decodeAbsoluteInstantSurface, decodeAbsoluteWindowSurface, decodeClockSurface, decodeTimelineAuthorSurface, timelineAuthorComponent, timelineAuthorManifest,
  timelineAuthorModuleRef,
  timelineAuthorMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{
    manifest: timelineAuthorManifest,
  }],
  components: [timelineAuthorComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: timelineAuthorModuleRef,
    declaration: timelineAuthorMarkupSurfaces.find((item) => item.name === "timeline")!, handler: decodeTimelineAuthorSurface,
  }), createMarkupSurfaceHostFacet({ module: timelineAuthorModuleRef,
    declaration: timelineAuthorMarkupSurfaces.find(item => item.name === "clock")!, handler: decodeClockSurface,
  }), createMarkupSurfaceHostFacet({ module: timelineAuthorModuleRef,
    declaration: timelineAuthorMarkupSurfaces.find(item => item.name === "window")!, handler: decodeAbsoluteWindowSurface,
  }), createMarkupSurfaceHostFacet({ module: timelineAuthorModuleRef,
    declaration: timelineAuthorMarkupSurfaces.find(item => item.name === "instant")!, handler: decodeAbsoluteInstantSurface,
  })],
};
export default qflowPackage;
