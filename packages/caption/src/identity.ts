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
  if (!([value.words.length, value.units.length, value.cues.length].every((length) => length === 0)
    || [value.words.length, value.units.length, value.cues.length].every((length) => length > 0))) {
    throw new Error("CaptionDocument words, units and Cues must be empty together.");
  }
  unique(value.units.map((item) => item.id), "CaptionDocument unit id");
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
  unique(value.cues.map((item) => item.id), "CaptionDocument Cue id");
  const orderedUnits: string[] = [];
  for (const cue of value.cues) {
    if (cue.unitIds.length === 0) throw new Error(`Caption Cue ${cue.id} is empty.`);
    if (cue.role !== undefined) nonempty(cue.role, `Caption Cue ${cue.id} Role`);
    orderedUnits.push(...cue.unitIds);
  }
  if (orderedUnits.length !== value.units.length
    || orderedUnits.some((id, index) => id !== value.units[index]?.id)) {
    throw new Error("CaptionDocument Cues must partition units in order.");
  }
}
