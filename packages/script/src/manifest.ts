import { captionDependency, captionTypes } from "@qflow/caption";
import { narrativeDependency, narrativeSchema, narrativeTypes } from "@qflow/narrative";
import { narrativeCaptionDependency, narrativeCaptionTypes } from "@qflow/narrative-caption";
import { textDependency, textTypes } from "@qflow/text";
import type { ModuleManifest, TypeRef } from "@qflow/protocol";

export const scriptModuleRef = { name: "@qflow/script", version: "1" } as const;
export const narrativeType: TypeRef = narrativeTypes.narrative;
export const narrativeExcerptType: TypeRef = narrativeTypes.excerpt;
export const narrativeSelectionType: TypeRef = narrativeTypes.selection;
export const narrativeMomentType: TypeRef = narrativeTypes.moment;
export const captionDocumentType: TypeRef = captionTypes.document;
export const narrativeCaptionBindingType: TypeRef = narrativeCaptionTypes.binding;
export { narrativeSchema };

export const scriptMarkupSurfaces = [
  {
    name: "script",
    tag: "script",
    mode: "raw",
    outputs: [
      narrativeType,
      narrativeExcerptType,
      textTypes.text,
      narrativeSelectionType,
      narrativeMomentType,
      captionDocumentType,
      narrativeCaptionBindingType,
    ],
    vocabulary: {
      summary: "Holds every spoken word as prose-first Segments and publishes the authored Narrative with the Selections, Moments and text projections the rest of the source reads.",
      attributes: [
        { name: "id", kind: "identifier", required: false,
          summary: "Names the Narrative Record and prefixes every view this element publishes." },
      ],
      text: "The element's own content is the Script body: named Segments holding prose, Role Cues, Dual Text, flat token attributes, and zero-width Selection and Moment markers. It carries no timecode, no media reference and no generation parameter.",
      ports: [
        { name: "", type: narrativeType,
          summary: "The complete authored Narrative, including speech structure, semantic anchors and its CaptionDocument, addressed by the element's own id." },
        { name: "segment.<id>", type: narrativeExcerptType,
          summary: "One Segment as a narrow Excerpt, used to associate a generated Take with that Segment." },
        { name: "segment.<id>.dialogue", type: textTypes.text,
          summary: "One Segment as display-independent dialogue, keeping Role Cue labels and the spoken side of Dual Text." },
        { name: "segment.<id>.speech", type: textTypes.text,
          summary: "One Segment as pronunciation only, with Role Cue labels dropped." },
        { name: "caption", type: captionDocumentType,
          summary: "A source-neutral CaptionDocument: display Words, grouping units and Cue breaks." },
        { name: "caption-binding", type: narrativeCaptionBindingType,
          summary: "The explicit relation from Caption units to this Narrative's speech Tokens." },
        { name: "selection.<id>", type: narrativeSelectionType,
          summary: "One named range over the Narrative, reusable wherever a Selection is read." },
        { name: "moment.<id>", type: narrativeMomentType,
          summary: "One named point in the Narrative, reusable wherever a Moment is read." },
      ],
      example: [
        '<script id="story">',
        "  @{whole}",
        "  <hook>",
        "    <HOST> @{problem} Never let anyone take credit for your work. @{/problem}",
        "  </hook>",
        "",
        "  <meeting>",
        "    <HOST> I started sending <BCC | B C C> recaps. @{ranking!} Everything changed.",
        "  </meeting>",
        "  @{/whole~}",
        "</script>",
      ].join("\n"),
      notes: [
        "`id` defaults to `script` and must be a canonical lower-case identifier of up to 64 characters.",
        "A Script requires at least one Segment, and natural-language text is refused outside a Segment.",
        "A Segment is opened by its own lower-case name and closed by that exact name, or written self-closing as `<pause/>`; the name is the Segment id, must be unique within the Script, and `script` is reserved. Segments do not nest.",
        "A Role Cue such as `<HOST>` is a bare tag inside a Segment with no close; its turn runs until the next Cue or the end of the Segment, and a Cue may not follow unowned speech in the same Segment. Role state resets when the Segment closes.",
        "Dual Text is written `<display | speech>`: the left side reaches Caption and the right side reaches dialogue and speech. `<display|>` shares the displayed prose with speech and forms the same complete alignment unit; its word times remain individual. `<|speech>` speaks without displaying. The explicit or shared speech must contain a spoken word; markers and punctuation alone supply no correspondence.",
        "Inside Dual Text, semantic markers belong to the source of spoken text: the explicit right side, or the shared left side when speech is omitted. Display attributes remain visual metadata and never enter spoken text.",
        "A flat token attribute follows a complete display token as `{name}` or `{name=value}`; multiple attributes use one comma-separated block. Zero-width markers and ordinary-prose comments do not interrupt that attachment; prose whitespace does. Attributes do not nest, do not carry timing, and never split a Dual Alignment Unit.",
        "Selection and Moment markers are fully enclosed in `@{...}` with all sigils inside. They are zero-width, share one name namespace, and may not split a speech token. Surrounding prose spaces remain content; do not add spaces to delimit a name:",
        [
          "| Marker | Meaning |",
          "|---|---|",
          "| `@{id}` | Opens a Selection at the next word's start |",
          "| `@{~id}` | Opens a Selection at the previous word's end |",
          "| `@{/id}` | Closes a Selection at the previous word's end |",
          "| `@{/id~}` | Closes a Selection at the next word's start |",
          "| `@{id!}` | A Moment at the next word's start |",
          "| `@{~id!}` | A Moment at the previous word's end |",
        ].join("\n"),
        "Each Selection name has one opening and one closing marker; use distinct names for distinct semantic ranges.",
        "`<!-- -->` comments never enter any projection, and `\\@`, `\\<`, `\\\\`, `\\{` and `\\}` write those characters literally; inside Dual Text `\\|` and `\\>` do the same.",
      ],
    },
  },
] as const;

export const scriptManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: scriptModuleRef.name,
  version: scriptModuleRef.version,
  dependencies: [captionDependency, narrativeDependency, narrativeCaptionDependency, textDependency],
  types: [],
  capabilities: [],
  producers: [],
};
