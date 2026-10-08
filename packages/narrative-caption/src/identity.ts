import type { CaptionDocument } from "@qflow/caption";
import type { Narrative } from "@qflow/narrative";

import type { NarrativeCaptionBinding } from "./types.js";

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

export function assertNarrativeCaptionBindingIdentity(value: NarrativeCaptionBinding): void {
  nonempty(value.id, "NarrativeCaptionBinding id");
  nonempty(value.narrativeId, "NarrativeCaptionBinding narrativeId");
  nonempty(value.documentId, "NarrativeCaptionBinding documentId");
  unique(value.units.map((unit) => unit.unitId), "NarrativeCaptionBinding unit id");
  for (const unit of value.units) {
    if (unit.sourceTokenIds.length === 0) throw new Error(`Narrative Caption unit ${unit.unitId} has no source Token.`);
    unique(unit.sourceTokenIds, `Narrative Caption unit ${unit.unitId} Token`);
  }
}

export function assertNarrativeCaptionBindingFor(
  value: NarrativeCaptionBinding,
  narrative: Narrative,
  document: CaptionDocument,
): void {
  assertNarrativeCaptionBindingIdentity(value);
  if (value.narrativeId !== narrative.id || value.documentId !== document.id) {
    throw new Error("NarrativeCaptionBinding disagrees with its Narrative or CaptionDocument.");
  }
  const tokenIds = new Set(narrative.tokens.map((token) => token.id));
  const documentUnitIds = new Set(document.units.map((unit) => unit.id));
  const bindingUnitIds = new Set(value.units.map((unit) => unit.unitId));
  if (documentUnitIds.size !== bindingUnitIds.size
    || [...documentUnitIds].some((unitId) => !bindingUnitIds.has(unitId))
    || [...bindingUnitIds].some((unitId) => !documentUnitIds.has(unitId))) {
    throw new Error("NarrativeCaptionBinding must cover CaptionDocument units exactly.");
  }
  const unknownToken = value.units.flatMap((unit) => unit.sourceTokenIds)
    .find((tokenId) => !tokenIds.has(tokenId));
  if (unknownToken !== undefined) {
    throw new Error(`NarrativeCaptionBinding references unknown Narrative Token ${unknownToken}.`);
  }
}
