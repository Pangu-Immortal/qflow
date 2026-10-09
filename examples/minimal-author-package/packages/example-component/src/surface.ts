import type { StructuredElement, StructuredSurfaceHandler, SurfaceComponentDraft, SurfaceRecordDraft, SurfaceResolvedReference } from "@qflow/qflow/markup";
import { exampleBoxFragment, exampleImageFragment, exampleTextFragment } from "./fragment.js";
import { exampleMarkupSurfaces, exampleTypes } from "./manifest.js";
import { mediaTypes } from "@qflow/media";
import { recipeType } from "@qflow/qflow/recipe";
import { blobTypes } from "@qflow/qflow/blob";
import { spatialTypes } from "@qflow/spatial";

function text(element: StructuredElement, name: string): string {
  const value = element.attributes[name];
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${element.name}.${name} must be text.`);
  return value.trim();
}
function reference(element: StructuredElement, name: string, resolve: (path: string) => SurfaceResolvedReference | undefined): SurfaceResolvedReference {
  const value = element.attributes[name];
  if (typeof value !== "object" || value.kind !== "reference") throw new Error(`${element.name}.${name} must be a reference.`);
  const resolved = resolve(value.path);
  if (resolved === undefined) throw new Error(`${element.name}.${name} cannot resolve ${value.path}`);
  return resolved;
}

export const decodeExampleSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  const id = text(element, "id");
  if (element.name.endsWith(":Style")) {
    const recipe = reference(element, "recipe", resolveReference);
    const font = reference(element, "font", resolveReference);
    if (recipe.type.module.name !== recipeType.module.name || recipe.type.name !== recipeType.name) throw new Error("Style.recipe must be an SVS Recipe.");
    if (font.type.module.name !== mediaTypes.fontStack.module.name || font.type.name !== mediaTypes.fontStack.name) throw new Error("Style.font must be a FontStackRef.");
    if (recipe.record?.value.kind !== "inline" || font.record?.value.kind !== "inline") throw new Error("Style references must resolve to inline records.");
    return { records: [{ id, type: exampleTypes.style, value: { kind: "inline", value: { recipe: recipe.record.value.value, fonts: font.record.value.value } }, range: element.range }], components: [], fragments: [], exports: [id] };
  }
  const timeline = reference(element, "timeline", resolveReference);
  const within = reference(element, "within", resolveReference);
  if (within.type.module.name !== spatialTypes.frame.module.name || within.type.name !== spatialTypes.frame.name) {
    throw new Error(`${element.name}.within must be a SpatialFrame.`);
  }
  const surface = exampleMarkupSurfaces.find((item) => item.tag === element.name.split(":").at(-1));
  if (surface === undefined) throw new Error(`Unknown example surface ${element.name}`);
  const fragment = surface.name === "box" ? exampleBoxFragment : surface.name === "text" ? exampleTextFragment : exampleImageFragment;
  const type = surface.name === "box" ? exampleTypes.box : surface.name === "text" ? exampleTypes.text : exampleTypes.imageSlot;
  const record: SurfaceRecordDraft = { id: `${id}.value`, type, value: { kind: "inline", value: { id } }, range: element.range };
  const image = element.attributes.image === undefined ? undefined : reference(element, "image", resolveReference);
  if (image !== undefined && (image.type.module.name !== blobTypes.blob.module.name || image.type.name !== blobTypes.blob.name)) throw new Error(`${element.name}.image must be a Blob Artifact.`);
  const component: SurfaceComponentDraft = { id, fragment: fragment.id, inputs: { timeline: timeline.ref,
    within: within.ref, ...(image === undefined ? {} : { image: image.ref }) }, outputs: { visual: `${id}.visual` }, range: element.range };
  return { records: [record], components: [component], fragments: [fragment], exports: [`${id}.value`, `${id}.visual`] };
};
