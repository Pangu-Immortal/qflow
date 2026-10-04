import { assertExactAttributes as exactAttributes, textAttribute as stringAttribute,
  type StructuredElement, type StructuredSurfaceHandler, type SurfaceResolvedReference, type SurfaceRecordDraft, type MarkupAttributeValue } from "@qflow/markup";
import { sameType } from "@qflow/protocol";
import { narrativeTypes } from "@qflow/narrative";
import type { NarrativeExcerpt } from "@qflow/narrative";
import { mediaTypes } from "@qflow/media";
import { temporalTypes } from "@qflow/temporal";

import { whisperXAlignmentFragment, whisperXBoundaryAlignmentFragment } from "./fragment.js";
import { whisperXTypes } from "./manifest.js";
import { parseWhisperXLanguage } from "./types.js";

function reference(element: StructuredElement, name: string, expected: SurfaceResolvedReference["type"],
  resolveReference: (path: string) => SurfaceResolvedReference | undefined): SurfaceResolvedReference {
  const raw: MarkupAttributeValue | undefined = element.attributes[name];
  if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${element.name}.${name} must be a whole-value reference`);
  const value = resolveReference(raw.path);
  if (value === undefined || !sameType(value.type, expected)) throw new Error(`${element.name}.${name} has the wrong type`);
  return value;
}
function authoredExcerpt(value: SurfaceResolvedReference): NarrativeExcerpt | undefined {
  return value.record?.value.kind === "inline" ? value.record.value.value as unknown as NarrativeExcerpt : undefined;
}

export const decodeWhisperXAlignmentSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  const narrative = reference(element, "narrative", narrativeTypes.narrative, resolveReference);
  const segment = reference(element, "segment", narrativeTypes.excerpt, resolveReference);
  const domain = reference(element, "domain", temporalTypes.localDomain, resolveReference);
  const excerpt = authoredExcerpt(segment);
  const hasNoTokens = excerpt !== undefined && excerpt.tokenStart === excerpt.tokenEndExclusive;
  exactAttributes(element, hasNoTokens ? ["id", "narrative", "segment", "domain"] : ["id", "narrative", "segment", "media", "domain", "language"]);
  if (element.children.some((child) => child.kind === "element" || child.value.trim())) throw new Error(`${element.name} does not accept children`);
  const id = stringAttribute(element, "id");
  const fragment = hasNoTokens ? whisperXBoundaryAlignmentFragment : whisperXAlignmentFragment;
  const records: SurfaceRecordDraft[] = [];
  const inputs: Record<string, SurfaceResolvedReference["ref"] | { kind: "record"; id: string }> = {
    narrative: narrative.ref, segment: segment.ref, domain: domain.ref,
  };
  if (!hasNoTokens) {
    inputs.media = reference(element, "media", mediaTypes.synchronized, resolveReference).ref;
    const language = parseWhisperXLanguage(stringAttribute(element, "language"), `${element.name}.language`);
    const languageId = `${id}.language`;
    records.push({ id: languageId, type: whisperXTypes.language, value: { kind: "inline", value: language }, range: element.range });
    inputs.language = { kind: "record", id: languageId };
  }
  return { records, components: [{ id, fragment: fragment.id, inputs,
    outputs: { alignment: `${id}.alignment` }, range: element.range }],
    fragments: [fragment], exports: [`${id}.alignment`] };
};
