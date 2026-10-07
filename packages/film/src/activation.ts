import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioCompanionFacet } from "@qflow/studio-companion";
import {
  decodeFilmSurface, filmComponent, filmManifest, filmModuleRef,
  filmMarkupSurfaces,
} from "./index.js";
import { filmStudioCompanions } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: filmManifest }],
  facets: [
    ...[filmComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({
      module: filmModuleRef,
      declaration: filmMarkupSurfaces.find((item) => item.name === "film")!, handler: decodeFilmSurface,
    }),
    createStudioCompanionFacet({ films: filmStudioCompanions }),
  ],
};
export default qflowPackage;
