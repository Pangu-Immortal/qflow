import { compositionTypes } from "@qflow/qflow/composition";
import { textLayer, temporalLineageFor } from "@qflow/qflow/studio-adapter";
const fields = {
  PosterTitle: [
    ["text", "Title", "text"],
    ["subtitle", "Subtitle", "text"],
    ["y", "Y", "number"],
    ["size", "Title size", "number"],
    ["subtitle-size", "Subtitle size", "number"],
    ["subtitle-gap", "Subtitle gap", "number"],
  ],
};
export function sceneCompanions(module, tags) {
  return Object.entries(tags).map(([tag, spec]) => {
    const inspector = [...fields[tag], ["z", "Drawing order", "number"]].map(
      ([binding, label, control]) => ({
        binding,
        label,
        control,
        domain: ["y", "z"].includes(binding) ? "where" : "how",
        section: { id: "title", label: "Title" },
        ...(binding === "y" ? { unit: "%", number: { scale: 100, step: 1 } } : {}),
        ...(["size", "subtitle-size", "subtitle-gap"].includes(binding)
          ? { unit: "px", number: { minimum: 0, step: 1 } }
          : {}),
      }),
    );
    return {
      id: spec.name,
      role: "track",
      output: {
        type: compositionTypes.visualTrack,
        surface: spec.name,
        modules: [module],
      },
      family: "launch-scenes",
      label: "Montage title",
      tone: "orange",
      icon: "text",
      lane: { heightPx: 44 },
      bindings: inspector.map((f) => ({
        name: f.binding,
        writable: true,
        fallback: spec.defaults[f.binding],
      })),
      inspector,
      project(context) {
        return context.generic().map((e) => ({
          ...e,
          temporal: temporalLineageFor(context, context.placement.id, "window"),
          display: {
            title: "Montage title",
            layers: [
              textLayer(
                context.placement?.attributes.text ?? context.placement?.attributes.title ?? tag,
              ),
            ],
          },
        }));
      },
    };
  });
}
