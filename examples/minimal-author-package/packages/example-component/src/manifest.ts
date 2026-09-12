import { readFile } from "node:fs/promises";
import { compositionTypes } from "@qflow/qflow/composition";
import type { ModuleManifest, ProducerRef, TypeRef } from "@qflow/qflow/author-kit";
import { timelineTypes } from "@qflow/qflow/timeline";
import { temporalTypes } from "@qflow/qflow/temporal";
import { mediaTypes } from "@qflow/qflow/media";
import { svsRecipeType } from "@qflow/qflow/svs";
import { artifactTypes } from "@qflow/qflow/artifact";

const previewImage = (file: string) => ({
  mediaType: "image/png",
  path: `preview/${file}`,
  open: async () => Uint8Array.from(await readFile(new URL(`../preview/${file}`, import.meta.url))),
});

export const exampleModuleRef = { name: "@example/example-component", version: "1" } as const;
export const exampleTypes = {
  box: { module: exampleModuleRef, name: "ExampleBox" },
  text: { module: exampleModuleRef, name: "ExampleText" },
  mediaSlot: { module: exampleModuleRef, name: "ExampleMediaSlot" },
  style: { module: exampleModuleRef, name: "ExampleStyle" },
  itemSet: { module: exampleModuleRef, name: "ExampleItemSet" },
} satisfies Record<string, TypeRef>;
export const exampleProducers = {
  renderBox: { module: exampleModuleRef, name: "render-example-box" },
  renderText: { module: exampleModuleRef, name: "render-example-text" },
  renderMedia: { module: exampleModuleRef, name: "render-example-media-slot" },
  appendItems: { module: exampleModuleRef, name: "append-example-items" },
} satisfies Record<string, ProducerRef>;

export const exampleManifest: ModuleManifest = {
  format: "qflow.module@1", name: exampleModuleRef.name, version: exampleModuleRef.version,
  dependencies: [
    { module: artifactTypes.blob.module },
    { module: compositionTypes.visualTrack.module },
    { module: mediaTypes.fontStack.module },
    { module: timelineTypes.track.module },
    { module: svsRecipeType.module },
    { module: temporalTypes.window.module },
  ],
  types: Object.values(exampleTypes).map(({ name }) => ({ name })),
  capabilities: [],
  producers: Object.values(exampleProducers).map((producer) => ({
    name: producer.name,
    inputs: producer === exampleProducers.appendItems
      ? [{ name: "previous", type: exampleTypes.itemSet }, { name: "item", type: exampleTypes.itemSet }]
      : [{ name: "timeline", type: timelineTypes.track }, ...(producer === exampleProducers.renderMedia ? [{ name: "media", type: artifactTypes.blob }] : [])],
    outputs: producer === exampleProducers.appendItems
      ? [{ name: "set", type: exampleTypes.itemSet }]
      : [{ name: "track", type: compositionTypes.visualTrack }],
    needs: [],
  })),
};

const vocabulary = (summary: string, example: string) => ({
  summary,
  appearance: "A deterministic, self-contained example surface rendered on the supplied Timeline.",
  preview: previewImage("Box.png"),
  attributes: [
    { name: "id", kind: "identifier" as const, required: true, summary: "Names this instance." },
    { name: "timeline", kind: "reference" as const, required: true, accepts: [timelineTypes.track], summary: "Selects the complete Timeline." },
  ],
  ports: [{ name: "track", type: compositionTypes.visualTrack, summary: "The terminal VisualTrack." }],
  example,
  notes: ["The same shape is used for box, text and media-slot surfaces; only the terminal Producer changes."],
});

export const exampleMarkupSurfaces = [
  { name: "box", tag: "Box", mode: "structured", outputs: [exampleTypes.box, compositionTypes.visualTrack], vocabulary: { ...vocabulary("A framed box surface.", "<example:Box id=\"box\" timeline={speech.timeline}/>") , preview: previewImage("Box.png") } },
  { name: "text", tag: "Text", mode: "structured", outputs: [exampleTypes.text, temporalTypes.instantSpec, temporalTypes.windowSpec, temporalTypes.instant, temporalTypes.window, compositionTypes.visualTrack], vocabulary: { ...vocabulary("A text-bearing surface.", "<example:Text id=\"title\" timeline={speech.timeline}>Hello</example:Text>"), preview: previewImage("Box.png") } },
  { name: "media-slot", tag: "MediaSlot", mode: "structured", outputs: [exampleTypes.mediaSlot, compositionTypes.visualTrack], vocabulary: { ...vocabulary("A media slot whose content is a graph input.", "<example:MediaSlot id=\"shot\" timeline={speech.timeline} media={shot-media}/>") , attributes: [...vocabulary("", "").attributes, { name: "media", kind: "reference" as const, required: false, accepts: [artifactTypes.blob], summary: "Optional image or video Blob Artifact." }], preview: previewImage("Box.png") } },
  { name: "style", tag: "Style", mode: "structured", outputs: [exampleTypes.style], vocabulary: {
    summary: "Decodes one SVS Recipe and exact FontStackRef into a Style value.",
    attributes: [
      { name: "id", kind: "identifier", required: true, summary: "Names this Style." },
      { name: "recipe", kind: "reference", required: true, accepts: [svsRecipeType], summary: "The decoded recipe with path and properties." },
      { name: "font", kind: "reference", required: true, accepts: [mediaTypes.fontStack], summary: "An exact FontStackRef." },
    ], example: "<example:Style id=\"card\" recipe={recipes.card} font={caption-font}/>",
  } },
] as const;
