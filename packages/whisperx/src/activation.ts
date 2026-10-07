import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import {
  decodeWhisperXAlignmentSurface, whisperXComponent,
  whisperXManifest, whisperXModuleRef,
  whisperXMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: whisperXManifest }],
  facets: [
    ...[whisperXComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),createMarkupSurfaceFacet({
    module: whisperXModuleRef,
    declaration: whisperXMarkupSurfaces.find((item) => item.name === "alignment")!,
    handler: decodeWhisperXAlignmentSurface,
  })],
};
export default qflowPackage;
