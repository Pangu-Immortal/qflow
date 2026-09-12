import { createStudioCompanionHostFacet } from "@qflow/qflow/studio-adapter";
import type { StudioParameterCompanion } from "@qflow/qflow/studio-adapter";

/** The project Style owns its inputs; Performance only owns its Use interval. */
export function styleStudioFacet(module: { readonly name: string; readonly version: string }) {
  const coordinates = ["left", "top", "right", "bottom", "x", "y", "width", "height"];
  const definitions = [
    { surface: "move", frames: ["from", "to"], sources: [] },
    { surface: "crossfade", frames: ["frame"], sources: ["outgoing", "incoming"] },
  ];
  const parameters: StudioParameterCompanion[] = definitions.map(({ surface, frames, sources }) => ({
    id: surface, match: { module, surface },
    bindings: [
      ...frames.map(name => ({ name, referenced: coordinates.map(name => ({ name, writable: true })) })),
      ...sources.map(name => ({ name })),
    ],
    inspector: [
      ...frames.flatMap(frame => coordinates.map(name => ({
        binding: `${frame}.${name}`, label: name, domain: "where" as const,
        page: { id: frame, label: frame }, section: { id: "frame", label: "Frame" },
        control: "number" as const, number: { suffixes: ["%", "px"], step: 1 },
      }))),
      ...sources.map(name => ({ binding: name, label: name, domain: "how" as const,
        section: { id: "sources", label: "Sources" }, control: "text" as const })),
    ],
  }));
  return createStudioCompanionHostFacet({ parameters });
}
