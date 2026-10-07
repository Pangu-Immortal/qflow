import { mediaDependency, mediaTypes } from "@qflow/qflow/media";
import type { ModuleManifest } from "@qflow/qflow/protocol";

export const fontsourceModuleRef = { name: "@qflow/fontsource", version: "1" } as const;

export const fontsourceMarkupSurfaces = [{
  name: "face",
  tag: "Face",
  mode: "structured",
  outputs: [mediaTypes.fontArtifact],
  vocabulary: {
    summary: "Materializes one exact face from an installed Fontsource npm package.",
    attributes: [
      { name: "id", kind: "identifier", required: true,
        summary: "Names the FontArtifact Record this element publishes." },
      { name: "package", kind: "literal", required: true,
        summary: "Names one installed @fontsource or @fontsource-variable package selected by the project lockfile." },
      { name: "weight", kind: "literal", required: true,
        summary: "Chooses an exact integer weight supported by the installed package." },
      { name: "style", kind: "literal", required: true, values: ["normal", "italic"],
        summary: "Chooses an exact style supported by the installed package." },
    ],
    example: `<fontsource:Face id="headline" package="@fontsource-variable/inter" weight="700" style="normal"/>`,
    notes: [
      "The active Distribution or project selects the adapter version; the project package.json and lockfile own the selected font package version.",
      "This adapter reads package metadata and CSS as data. It does not import or execute upstream package code.",
      "Changing package selects a dependency; it is not a family dropdown backed by a Qflow-maintained catalog.",
    ],
  },
}] as const;

export const fontsourceManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: fontsourceModuleRef.name,
  version: fontsourceModuleRef.version,
  dependencies: [mediaDependency],
  types: [],
  capabilities: [],
  producers: [],
};
