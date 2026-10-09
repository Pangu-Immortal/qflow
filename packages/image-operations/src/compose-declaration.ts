import { blobTypes } from "@qflow/qflow/blob";
import { spatialTypes } from "@qflow/spatial";

import { imageComposeTypes } from "./refs.js";

export const imageComposeMarkupSurface = {
  name: "compose",
  tag: "Compose",
  mode: "structured",
  outputs: [imageComposeTypes.options, imageComposeTypes.layerSpec, blobTypes.blob],
  vocabulary: {
    summary: "Flattens ordered still-image Layers at explicit rectangular Frames into one PNG Artifact.",
    attributes: [
      { name: "id", kind: "identifier", required: true,
        summary: "Names this composition so its image can be referenced elsewhere in the Source." },
      { name: "canvas", kind: "reference", required: true, accepts: [spatialTypes.canvas],
        summary: "Chooses the Canvas every Layer is painted onto." },
      { name: "background", kind: "literal", required: false,
        summary: "Sets the color the Canvas is cleared to before the first Layer is painted." },
    ],
    children: [{
      tag: "Layer", cardinality: "many",
      summary: "One image painted into its own Frame, in document order, and empty of children and text.",
      attributes: [
        { name: "source", kind: "reference", required: true, accepts: [blobTypes.blob],
          summary: "Chooses the image Artifact this Layer paints." },
        { name: "frame", kind: "reference", required: true, accepts: [spatialTypes.frame],
          summary: "Chooses the Frame on the Canvas the image is painted into." },
        { name: "fit", kind: "literal", required: false, values: ["contain", "cover", "stretch"],
          summary: "Decides how the image is sized to its Frame; defaults to `contain`." },
        { name: "interpolation", kind: "literal", required: false,
          values: ["nearest", "linear", "cubic", "area", "lanczos"],
          summary: "Decides which filter resamples the image while it is scaled; defaults to `lanczos`." },
        { name: "opacity", kind: "literal", required: false,
          summary: "Sets how strongly this Layer covers what is beneath it, from 0 to 1; defaults to 1." },
      ],
    }],
    ports: [{ name: "image", type: blobTypes.blob,
      summary: "The composed picture, a PNG." }],
    example: `<image:Compose id="comparison" canvas={comparison-canvas.canvas} background="#EEEAE2FF">
  <image:Layer source={before.image} frame={before-panel} fit="contain"/>
  <image:Layer source={after.image} frame={after-panel} fit="contain"/>
</image:Compose>`,
    notes: [
      "`background` is written as `#RRGGBBAA` and defaults to `#00000000`.",
      "The composition requires at least one Layer and holds at most 64.",
      "Child order is paint order, and a Frame that extends beyond the Canvas is clipped.",
      "The operation performs rectangular raster placement only; it does not redesign a scene or create timed layers.",
    ],
  },
} as const;
