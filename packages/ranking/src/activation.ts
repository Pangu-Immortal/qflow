import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioTrackCompanionFacet } from "@qflow/studio-companion";

import {
  decodeColumnStyleSurface,
  decodeColumnSurface,
  decodeTierBoardStyleSurface,
  decodeTierBoardSurface,
  decodeTopThreeStyleSurface,
  decodeTopThreeSurface,
  rankingComponent,
  rankingManifest,
  rankingMarkupSurfaces,
  rankingModuleRef,
} from "./index.js";
import { rankingStudioTrackCompanions } from "./studio.js";

const facets = [
  ["tier-style", decodeTierBoardStyleSurface],
  ["column-style", decodeColumnStyleSurface],
  ["top-three-style", decodeTopThreeStyleSurface],
  ["tier", decodeTierBoardSurface],
  ["column", decodeColumnSurface],
  ["top-three", decodeTopThreeSurface],
] as const;

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{
    manifest: rankingManifest,
  }],
  facets: [
    ...[rankingComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    ...facets.map(([surface, handler]) => createMarkupSurfaceFacet({
      module: rankingModuleRef,
      declaration: rankingMarkupSurfaces.find((item) => item.name === surface)!,
      handler,
    })),
    createStudioTrackCompanionFacet(rankingStudioTrackCompanions),
  ],
};

export default qflowPackage;
