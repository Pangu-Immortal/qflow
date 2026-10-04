import { openFontStudioFields } from "@qflow/fonts-open/studio";
import { textFineMarkupSurfaces, textFineModuleRef, textFineTypes } from "@qflow/text-fine";
import type { FineTextOccurrence, TextItem } from "@qflow/text-fine";
import { compositionTypes } from "@qflow/composition";
import type { StudioTrackCompanion, StudioTrackCompanionContext, StudioEntityDraft, StudioInspectorFieldDeclaration, StudioSourceBindingDeclaration } from "@qflow/studio-adapter";
import { childEntities, requiredSurfaceValue, temporalLineageFor, textLayer } from "@qflow/studio-adapter";

const fontInspector = openFontStudioFields("style");

const typographyProperties = (textFineMarkupSurfaces
  .find((surface) => surface.name === "style")?.vocabulary.attributes
  .find((attribute) => attribute.name === "recipe")?.recipe ?? []);

function title(name: string): string {
  return name.split("-").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
}

function valuesFor(property: typeof typographyProperties[number]): readonly string[] | undefined {
  return "values" in property ? property.values : undefined;
}

type TypographyPlacement = Pick<StudioInspectorFieldDeclaration, "domain" | "page" | "section">;

function typographyPlace(domain: "where" | "how", page: string, section: string): TypographyPlacement {
  const id = section.toLowerCase().replaceAll(" ", "-");
  return { domain, page: { id: page.toLowerCase(), label: page }, section: { id, label: section } };
}

const typographyPlacement = new Map<string, TypographyPlacement>();
function placeTypography(names: readonly string[], domain: "where" | "how", page: string, section: string): void {
  for (const name of names) typographyPlacement.set(name, typographyPlace(domain, page, section));
}

placeTypography([
  "size", "weight", "font-style", "line-height", "tracking", "word-spacing", "kerning", "synthesis", "language",
  "direction", "writing-mode", "baseline-shift", "vertical-align", "tab-size", "indent", "paragraph-before",
  "paragraph-after", "transform", "caps", "cjk-spacing", "punctuation-trim",
], "how", "Typography", "Typography");
placeTypography(["fill"], "how", "Paint", "Fill");

const typographyColorProperties = new Set(["fill"]);
const typographyTextProperties = new Set(["language", "cjk-spacing", "punctuation-trim"]);

const typographyInspector: readonly StudioInspectorFieldDeclaration[] = typographyProperties.map((property) => {
  const placement = typographyPlacement.get(property.name);
  if (placement === undefined) throw new Error(`Typography Studio has no explicit Inspector declaration for ${property.name}.`);
  const options = valuesFor(property);
  return {
    binding: `style.${property.name}`, label: title(property.name), ...placement,
    ...(property.summary === undefined ? {} : { summary: property.summary }),
    control: options !== undefined ? "select" : typographyColorProperties.has(property.name) ? "color"
      : typographyTextProperties.has(property.name) ? "text" : "number",
    ...(options === undefined ? {} : { options }),
  };
});

function textOf(item: Pick<TextItem, "document">): string {
  return item.document.paragraphs.map((paragraph) => paragraph.inlines
    .map((inline) => inline.kind === "text" ? inline.text : " ")
    .join(""))
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

function projectFineText(context: StudioTrackCompanionContext): readonly StudioEntityDraft[] {
  const occurrence = requiredSurfaceValue(context, "occurrence") as FineTextOccurrence;
  const entity = childEntities(context, [{
    id: occurrence.id,
    startFrame: occurrence.span.startFrame,
    endFrameExclusive: occurrence.span.endFrameExclusive,
    stackOrder: occurrence.placement.z,
    sourceTypes: [textFineTypes.itemSpec, textFineTypes.plainItemSpec],
  }], "typography-item", "standard")[0];
  if (entity === undefined) return [];
  const label = textOf(occurrence);
  const temporal = temporalLineageFor(context, occurrence.id, "window");
  return [{
    ...entity,
    authoredId: context.placement?.id ?? occurrence.id,
    display: { ...entity.display, title: context.placement?.id ?? occurrence.id, layers: label.length === 0 ? [] : [textLayer(label)] },
    ...(context.placement === undefined ? {} : { elementRange: context.placement.range }),
    ...(temporal === undefined ? {} : { temporal }),
  }];
}

const placementBindings: Readonly<Record<"flow" | "point" | "path", readonly StudioSourceBindingDeclaration[]>> = {
  flow: ["z", "inline-size", "block-size", "padding", "align", "block-align", "wrap", "overflow", "max-lines", "minimum-scale", "clip", "columns", "column-gap", "metric-edge"].map((name) => ({ name, writable: true })),
  point: ["z", "anchor-inline", "anchor-block"].map((name) => ({ name, writable: true })),
  path: ["z", "side", "orientation", "start-margin", "end-margin", "align", "reverse", "overflow"].map((name) => ({ name, writable: true })),
};

const placementOptions = new Map<string, readonly string[]>([
  ["inline-size", ["hug", "fixed"]], ["block-size", ["hug", "fixed"]],
  ["align:flow", ["start", "center", "end", "justify"]], ["align:path", ["start", "center", "end"]],
  ["block-align", ["start", "center", "end"]], ["wrap", ["none", "word", "grapheme"]],
  ["overflow:flow", ["visible", "clip", "ellipsis", "shrink"]], ["overflow:path", ["visible", "clip"]],
  ["metric-edge", ["line-box", "cap-height", "ink"]], ["anchor-inline", ["start", "center", "end"]],
  ["anchor-block", ["start", "center", "end"]], ["side", ["left", "right"]],
  ["orientation", ["follow", "upright"]], ["reverse", ["true", "false"]], ["clip", ["true", "false"]],
]);

function occurrenceInspector(form: "flow" | "point" | "path"): readonly StudioInspectorFieldDeclaration[] {
  const direct = placementBindings[form].map(({ name }) => {
    const options = placementOptions.get(`${name}:${form}`) ?? placementOptions.get(name);
    return {
      binding: name, label: title(name), ...typographyPlace("where", "Layout", name === "z" ? "Stacking" : title(form)),
      control: options === undefined ? (name === "padding" ? "text" as const : "number" as const) : "select" as const,
      ...(options === undefined ? {} : { options }),
    };
  });
  return [...direct, ...fontInspector.fields, ...typographyInspector];
}

function fineTextCompanion(form: "flow" | "point" | "path"): StudioTrackCompanion {
  const geometry = form === "flow" ? "within" : form;
  return {
    id: form, role: "track",
    output: { type: compositionTypes.visualTrack, surface: form, modules: [textFineModuleRef] },
    family: "text", tone: "violet", icon: "text",
    bindings: [
      { name: geometry },
      { name: "content" },
      ...placementBindings[form],
      {
        name: "style",
        referenced: [fontInspector.binding],
        recipe: { through: ["recipe"], bindings: typographyProperties.map(({ name }) => ({ name })) },
      },
      { name: "motion" },
      ...(form === "path" ? [{ name: "path-motion" }] : []),
    ],
    inspector: occurrenceInspector(form),
    requiredValues: ["occurrence"], project: projectFineText,
    lane: { heightPx: 48 },
  };
}

export const textFineStudioTrackCompanions: readonly StudioTrackCompanion[] = [
  fineTextCompanion("flow"),
  fineTextCompanion("point"),
  fineTextCompanion("path"),
];
