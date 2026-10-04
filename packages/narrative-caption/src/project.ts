import { assertCaptionDocument, assertCaptionTiming } from "@qflow/caption";
import type { CaptionDocument, CaptionTiming, CaptionTimingCue, CaptionTimingUnit } from "@qflow/caption";
import { tokenFrameSpan } from "@qflow/narrative-temporal";
import type { NarrativeProjection } from "@qflow/narrative-temporal";

import type { NarrativeCaptionBinding } from "./types.js";
import { NarrativeCaptionTimingError } from "./error.js";

export function projectNarrativeCaptionTiming(
  document: CaptionDocument,
  binding: NarrativeCaptionBinding,
  projection: NarrativeProjection,
): CaptionTiming {
  assertCaptionDocument(document);
  if (binding.documentId !== document.id || binding.narrativeId !== projection.narrativeId) {
    throw new NarrativeCaptionTimingError("CAPTION_BINDING", "Caption binding disagrees with its document or NarrativeProjection.");
  }
  const sourceTokens = new Map(binding.units.map((unit) => [unit.unitId, unit.sourceTokenIds] as const));
  const breaks = new Set(document.cueBreaks.map((cueBreak) => cueBreak.afterUnitId));
  const timed: Array<{ unit: CaptionDocument["units"][number]; timing: CaptionTimingUnit }> = [];
  const previousByRole = new Map<string | undefined, { timing: CaptionTimingUnit }>();
  for (const unit of document.units) {
    const window = tokenFrameSpan(projection, sourceTokens.get(unit.id) ?? []);
    if (window === undefined) continue;
    if (window.endFrameExclusive < window.startFrame) {
      throw new NarrativeCaptionTimingError("CAPTION_TOKEN_ORDER", `Caption unit ${unit.id} references Narrative Tokens in reverse order.`);
    }
    const startFrame = window.startFrame;
    const endFrameExclusive = Math.max(startFrame + 1, window.endFrameExclusive);
    const previous = previousByRole.get(unit.role);
    if (previous !== undefined && startFrame > previous.timing.startFrame && startFrame < previous.timing.endFrameExclusive) {
      previous.timing = { ...previous.timing, endFrameExclusive: startFrame };
    }
    const entry = { unit, timing: { unitId: unit.id, startFrame, endFrameExclusive } };
    previousByRole.set(unit.role, entry);
    timed.push(entry);
  }
  const cues: CaptionTimingCue[] = [];
  let current: { units: CaptionTimingUnit[]; groupId?: string } | undefined;
  const flush = (): void => {
    if (current === undefined || current.units.length === 0) return;
    cues.push({
      id: `${document.id}:cue:${cues.length + 1}`,
      startFrame: current.units[0]!.startFrame,
      endFrameExclusive: current.units.at(-1)!.endFrameExclusive,
      units: current.units,
    });
    current = undefined;
  };
  const documentOrder = new Map(document.units.map((unit, index) => [unit.id, index]));
  for (const [index, entry] of timed.entries()) {
    const previousDocumentUnit = index === 0 ? undefined : timed[index - 1]!.unit;
    const mustBreak = current !== undefined && (
      current.groupId !== entry.unit.groupId
      || (previousDocumentUnit !== undefined && (breaks.has(previousDocumentUnit.id)
        || documentOrder.get(entry.unit.id)! !== documentOrder.get(previousDocumentUnit.id)! + 1))
    );
    if (mustBreak) flush();
    if (current === undefined) {
      current = { units: [], ...(entry.unit.groupId === undefined ? {} : { groupId: entry.unit.groupId }) };
    }
    current.units.push(entry.timing);
  }
  flush();
  const result: CaptionTiming = { timelineId: projection.timelineId, documentId: document.id, cues };
  assertCaptionTiming(result);
  return result;
}
