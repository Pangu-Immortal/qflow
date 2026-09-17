import {
  assertExactAttributes as exactAttributes,
  textAttribute as stringAttribute,
  type StructuredElement,
  type StructuredSurfaceHandler,
  type SurfaceResolvedReference,
  type MarkupAttributeValue,
} from "@qflow/markup";
import { sameType } from "@qflow/protocol";
import { narrativeTypes } from "@qflow/narrative";
import type { NarrativeExcerpt } from "@qflow/narrative";
import { mediaTypes } from "@qflow/media";

import { whisperXBoundarySemanticTakeFragment, whisperXSemanticTakeFragment } from "./fragment.js";
import { whisperXTypes } from "./manifest.js";
import { parseWhisperXLanguage } from "./types.js";

function reference(
  element: StructuredElement,
  name: string,
  expected: SurfaceResolvedReference["type"],
  resolveReference: (path: string) => SurfaceResolvedReference | undefined,
): SurfaceResolvedReference {
  const raw: MarkupAttributeValue | undefined = element.attributes[name];
  if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${element.name}.${name} must be a whole-value reference`);
  const value = resolveReference(raw.path);
  if (value === undefined) throw new Error(`${element.name}.${name} cannot resolve ${raw.path}`);
  if (!sameType(value.type, expected)) throw new Error(`${element.name}.${name} has the wrong type`);
  return value;
}

function authoredExcerpt(value: SurfaceResolvedReference): NarrativeExcerpt | undefined {
  return value.record?.value.kind === "inline"
    ? value.record.value.value as unknown as NarrativeExcerpt
    : undefined;
}

export const decodeWhisperXSemanticTakeSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  const narrative = reference(element, "narrative", narrativeTypes.narrative, resolveReference);
  const segment = reference(element, "segment", narrativeTypes.excerpt, resolveReference);
  const media = reference(element, "media", mediaTypes.synchronized, resolveReference);
  const excerpt = authoredExcerpt(segment);
  const hasNoTokens = excerpt !== undefined && excerpt.tokenStart === excerpt.tokenEndExclusive;
  exactAttributes(element, hasNoTokens
    ? ["id", "narrative", "segment", "media"]
    : ["id", "narrative", "segment", "media", "language"]);
  if (element.children.some((child) => child.kind === "element" || child.value.trim())) {
    throw new Error(`${element.name} does not accept children`);
  }
  const id = stringAttribute(element, "id");
  if (hasNoTokens) {
    return {
      records: [],
      components: [{
        id,
        fragment: whisperXBoundarySemanticTakeFragment.id,
        inputs: { narrative: narrative.ref, segment: segment.ref, media: media.ref },
        outputs: { take: `${id}.take` },
        range: element.range,
      }],
      fragments: [whisperXBoundarySemanticTakeFragment],
    };
  }
  const language = parseWhisperXLanguage(stringAttribute(element, "language"), `${element.name}.language`);
  const languageId = `${id}.language`;
  return {
    records: [{
      id: languageId,
      type: whisperXTypes.language,
      value: { kind: "inline", value: language },
      range: element.range,
    }],
    components: [{
      id,
      fragment: whisperXSemanticTakeFragment.id,
      inputs: {
        narrative: narrative.ref,
        segment: segment.ref,
        media: media.ref,
        language: { kind: "record", id: languageId },
      },
      outputs: { take: `${id}.take` },
      range: element.range,
    }],
    fragments: [whisperXSemanticTakeFragment],
  };
};
