import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";

import {
  decodeRegionEvidenceSurface,
  regionEvidenceComponent,
  regionEvidenceManifest,
  regionEvidenceMarkupSurface,
  regionEvidenceModuleRef,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: regionEvidenceManifest }],
  facets: [
    ...[regionEvidenceComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),createMarkupSurfaceFacet({
    module: regionEvidenceModuleRef,
    declaration: regionEvidenceMarkupSurface,
    handler: decodeRegionEvidenceSurface,
  })],
};
export default qflowPackage;
