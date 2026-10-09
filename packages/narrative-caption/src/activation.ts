import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";

import {
  decodeNarrativeCaptionTimingSurface,
  narrativeCaptionComponent,
  narrativeCaptionManifest,
  narrativeCaptionModuleRef,
  narrativeCaptionTimingMarkupSurface,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: narrativeCaptionManifest }],
  facets: [
    ...[narrativeCaptionComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),createMarkupSurfaceFacet({
    module: narrativeCaptionModuleRef,
    declaration: narrativeCaptionTimingMarkupSurface,
    handler: decodeNarrativeCaptionTimingSurface,
  })],
};
export default qflowPackage;
