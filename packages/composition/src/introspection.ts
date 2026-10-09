import type { ValueSchema } from "@qflow/qflow/protocol";

import {
  visualBoxSchema,
  visualElementSchema,
  visualImageSchema,
  visualMaskSchema,
  visualPathCommandSchema,
  visualProgramSchema,
  visualSurfaceSchema,
  visualTextDocumentSchema,
  visualTextFlowSchema,
  visualTextPaintSchema,
  visualTextSchema,
  visualTextTypographySchema,
  visualTrackSchema,
  visualVideoSchema,
} from "./schema.js";

/** Named values and invariants owned by Composition, presented by any author-inspection surface. */
export const visualCompositionVocabulary: {
  readonly shapes: Readonly<Record<string, ValueSchema>>;
  readonly rules: readonly string[];
} = {
  shapes: {
    "visual-track": visualTrackSchema,
    "visual-element": visualElementSchema,
    program: visualProgramSchema,
    box: visualBoxSchema,
    mask: visualMaskSchema,
    text: visualTextSchema,
    image: visualImageSchema,
    video: visualVideoSchema,
    surface: visualSurfaceSchema,
    "text-flow": visualTextFlowSchema,
    "text-typography": visualTextTypographySchema,
    "text-paint": visualTextPaintSchema,
    "text-document": visualTextDocumentSchema,
    "path-command": visualPathCommandSchema,
  },
  rules: [
    "A Present holds exactly one element with no `parent`; every other element names one, and it must be a box, mask or program.",
    "`order` is unique across the whole Present, not among siblings.",
    "A child's position is measured from its parent's box, not from the Canvas.",
    "An animation carries at least two keyframes, and every keyframe of one animation declares the same properties; `atFrame` is Present-relative.",
    "A plain text element provides exact ordered font artifacts and cannot combine them with raw `font`, `font-family`, `font-style`, `font-synthesis` or `font-weight` styles.",
    "A text element using glyph Paint cannot also declare raw stroke or paint-order styles.",
    "A media element's artifact media type must match image/video, and still images cannot carry sampling.",
    "A Surface with still timing cannot carry sampling; frame-based Surface sampling must match its typed timing.",
    "Mask roots must be direct children of one Present and both mask/content references must resolve to owned elements.",
  ],
};
