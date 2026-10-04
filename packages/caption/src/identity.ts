import type { CaptionDocument } from "./types.js";

function nonempty(value: string, subject: string): void {
  if (value.trim().length === 0) throw new Error(`${subject} must not be empty.`);
}

function unique(values: readonly string[], subject: string): Set<string> {
  const found = new Set<string>();
  for (const value of values) {
    nonempty(value, subject);
    if (found.has(value)) throw new Error(`${subject} repeats ${value}.`);
    found.add(value);
  }
  return found;
}

/** Validate the source-neutral document identity, including the valid wordless document. */
export function assertCaptionDocumentIdentity(value: CaptionDocument): void {
  nonempty(value.id, "CaptionDocument id");
  if ((value.units.length === 0) !== (value.words.length === 0)) {
    throw new Error("CaptionDocument units and words must be empty together.");
  }
  const unitIds = unique(value.units.map((item) => item.id), "CaptionDocument unit id");
  const wordIds = unique(value.words.map((item) => item.id), "CaptionDocument word id");
  const words = new Map(value.words.map((word) => [word.id, word] as const));
  const orderedWords: string[] = [];
  for (const unit of value.units) {
    if (unit.wordIds.length === 0) throw new Error(`Caption unit ${unit.id} is empty.`);
    for (const wordId of unit.wordIds) {
      const word = words.get(wordId);
      if (word === undefined || word.unitId !== unit.id) {
        throw new Error(`Caption unit ${unit.id} references a foreign word.`);
      }
      orderedWords.push(wordId);
    }
  }
  if (orderedWords.length !== wordIds.size
    || orderedWords.some((id, index) => id !== value.words[index]?.id)) {
    throw new Error("CaptionDocument units must partition words in order.");
  }
  unique(value.cueBreaks.map((item) => item.afterUnitId), "CaptionDocument Cue Break");
  if (value.cueBreaks.some((item) => !unitIds.has(item.afterUnitId))) {
    throw new Error("CaptionDocument Cue Break names an unknown unit.");
  }
}
