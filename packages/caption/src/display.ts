import type { CaptionDocument } from "./types.js";
import { assertCaptionDocumentIdentity } from "./identity.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertCaptionDocument(value: CaptionDocument): void {
  assertCaptionDocumentIdentity(value);
  assert(value.units.length > 0, "CaptionDocument is empty");
  for (const word of value.words) assert(word.separatorBefore === "" || word.separatorBefore === " ", "Caption word must declare its authored separator");
}

export type CaptionUnitSubset = {
  readonly documentId: string;
  readonly unitIds: readonly string[];
};

export function captionUnitsForRole(document: CaptionDocument, role: string): CaptionUnitSubset {
  assertCaptionDocument(document);
  const selected = new Set(document.cues.filter((cue) => cue.role === role).flatMap((cue) => cue.unitIds));
  const unitIds = document.units.filter((unit) => selected.has(unit.id)).map((unit) => unit.id);
  if (unitIds.length === 0) throw new Error(`Caption Role ${role} selects no display unit`);
  return { documentId: document.id, unitIds };
}

export function captionWordsForAttribute(document: CaptionDocument, attribute: string): readonly string[] {
  assertCaptionDocument(document);
  const name = attribute.trim();
  if (!name) throw new Error("Caption attribute name is empty");
  const wordIds = document.words
    .filter((word) => word.attributes.some((item) => item.name === name))
    .map((word) => word.id);
  if (wordIds.length === 0) throw new Error(`Caption attribute ${name} selects no display word`);
  return wordIds;
}

export function assertCaptionUnitSubset(value: CaptionUnitSubset, document: CaptionDocument): void {
  assertCaptionDocument(document);
  assert(value.documentId === document.id, "Caption unit subset belongs to another document");
  const known = new Set(document.units.map((unit) => unit.id));
  assert(value.unitIds.length > 0 && value.unitIds.every((id) => known.has(id)),
    "Caption unit subset contains an unknown unit");
  const order = new Map(document.units.map((unit, index) => [unit.id, index]));
  const indices = value.unitIds.map((id) => order.get(id)!);
  assert(indices.every((index, position) => position === 0 || index === indices[position - 1]! + 1),
    "Caption unit subset must be an ordered contiguous range");
}
