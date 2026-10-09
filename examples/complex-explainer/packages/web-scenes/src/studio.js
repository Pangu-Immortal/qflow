import { compositionTypes } from "@qflow/composition";
import { textLayer, temporalLineageFor } from "@qflow/studio-companion";
const scenes = {
  ComponentWorkshop: ["Components in use", "Motion → components → library → another video"],
  SemanticWorkshop: ["Words drive motion", "Selection → reveal → revised words → following motion"],
  DeliveryWorkshop: ["From assets to a film", "Assets → result → sharing → reference callback"],
  CodeJourney: ["The coding route", "IDE → motion → rewrites → timing → Qflow"],
  Outro: ["Get Qflow", "GitHub → copy → install → characters → star"],
  Road: ["The editing route", "Editor → materials → motion → keyframes → generated sample"],
  Introduction: [
    "Introducing Qflow",
    "Homepage → code → installation → reference and replacement examples",
  ],
  Comparison: ["Competing tools", "Homepages → prices → templates → results → watermarks"],
};
export function sceneCompanions(module, tags) {
  return Object.entries(tags).map(([tag, spec]) => ({
    id: spec.name,
    role: "track",
    output: {
      type: compositionTypes.visualTrack,
      surface: spec.name,
      modules: [module],
    },
    family: "explainer-scenes",
    label: scenes[tag][0],
    tone: "violet",
    icon: "component",
    lane: { heightPx: 52 },
    bindings: [{ name: "z", writable: true, fallback: spec.defaults.z }],
    inspector: [
      {
        binding: "z",
        label: "Drawing order",
        domain: "where",
        section: { id: "stack", label: "Stacking" },
        control: "number",
        number: { step: 1 },
      },
    ],
    project(context) {
      return context.generic().map((e) => ({
        ...e,
        temporal: temporalLineageFor(context, context.placement.id, "window"),
        display: {
          title: scenes[tag][0],
          layers: [textLayer(scenes[tag][1])],
        },
        inspector: [
          {
            id: "sequence",
            label: "Sequence",
            domain: "how",
            section: { id: "scene", label: "Scene" },
            value: scenes[tag][1],
          },
        ],
      }));
    },
  }));
}
