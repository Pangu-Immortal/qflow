import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { portraitMattingSurface, volcengineMattingDefinition, volcengineMattingModuleRef } from "./index.js";
import { decodePortraitMattingSurface } from "./surface.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: volcengineMattingDefinition.manifest }],
  facets: [
    ...[volcengineMattingDefinition.component].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),volcengineMattingDefinition.facet, createMarkupSurfaceFacet({
    module: volcengineMattingModuleRef, declaration: portraitMattingSurface, handler: decodePortraitMattingSurface,
  })],
};
export default qflowPackage;
