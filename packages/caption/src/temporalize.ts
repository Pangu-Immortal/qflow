import type { CaptionDocument } from "@qflow/narrative";
import { projectTimelineSpace, tokenFrameSpan } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";

import { CaptionTimingError } from "./error.js";
import { assertCaptionDocument } from "./display.js";
import type { TimedCaptionProjection, TimedCaptionCue, TimedCaptionUnit } from "./types.js";

export function temporalizeCaptionDocument(
  document: CaptionDocument,
  semantic: Timeline,
): TimedCaptionProjection {
  assertCaptionDocument(document);
  const space = projectTimelineSpace(semantic);
  if (semantic.narrativeId !== undefined && document.narrativeId !== semantic.narrativeId) {
    throw new CaptionTimingError("CAPTION_NARRATIVE", "CaptionDocument and Timeline belong to different Narratives.");
  }
  const breaks = new Set(document.cueBreaks.map((cueBreak) => cueBreak.afterUnitId));
  const timed: Array<{ unit: CaptionDocument["units"][number]; timing: TimedCaptionUnit }> = [];
  const previousByRole = new Map<string | undefined, { timing: TimedCaptionUnit }>();
  for (const unit of document.units) {
    const window = tokenFrameSpan(semantic, unit.sourceTokenIds);
    if (window === undefined) continue;
    if (window.endFrameExclusive < window.startFrame) {
      throw new CaptionTimingError("CAPTION_SPEECH_ORDER", `Caption unit ${unit.id} references speech Tokens in reverse order.`);
    }
    const startFrame = window.startFrame;
    const endFrameExclusive = Math.max(startFrame + 1, window.endFrameExclusive);
    // Acoustic Word windows may overlap. The Timeline keeps those measurements; an authored unit
    // gets one owner: as soon as the next unit of the same Role starts, this one stops. A Cue
    // envelope ends at its last unit, so Cue boundaries are exclusive by the same rule.
    const previous = previousByRole.get(unit.role);
    if (previous !== undefined && startFrame > previous.timing.startFrame && startFrame < previous.timing.endFrameExclusive) {
      previous.timing = { ...previous.timing, endFrameExclusive: startFrame };
    }
    const entry = { unit, timing: { unitId: unit.id, startFrame, endFrameExclusive } };
    previousByRole.set(unit.role, entry);
    timed.push(entry);
  }
  const cues: TimedCaptionCue[] = [];
  let current: { units: TimedCaptionUnit[]; segmentId: string; turnId: string } | undefined;
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
      current.segmentId !== entry.unit.segmentId
      || current.turnId !== entry.unit.turnId
      || (previousDocumentUnit !== undefined && (breaks.has(previousDocumentUnit.id)
        || documentOrder.get(entry.unit.id)! !== documentOrder.get(previousDocumentUnit.id)! + 1))
    );
    if (mustBreak) flush();
    if (current === undefined) current = {
      units: [],
      segmentId: entry.unit.segmentId,
      turnId: entry.unit.turnId,
    };
    current.units.push(entry.timing);
  }
  flush();
  const result: TimedCaptionProjection = {
    spaceId: space.id,
    narrativeId: document.narrativeId,
    documentId: document.id,
    cues,
  };
  assertTimedCaptionProjection(result);
  return result;
}

export function assertTimedCaptionProjection(projection: TimedCaptionProjection): void {
  if (projection.spaceId.length === 0 || projection.narrativeId.length === 0 || projection.documentId.length === 0) {
    throw new Error("TimedCaptionProjection provenance is invalid");
  }
  const cueIds = new Set<string>();
  const unitIds = new Set<string>();
  for (const cue of projection.cues) {
    if (cue.id.length === 0 || cueIds.has(cue.id) || cue.units.length === 0
      || !Number.isSafeInteger(cue.startFrame) || !Number.isSafeInteger(cue.endFrameExclusive)
      || cue.startFrame < 0 || cue.endFrameExclusive <= cue.startFrame) throw new Error("TimedCaptionProjection contains an invalid Cue");
    cueIds.add(cue.id);
    for (const unit of cue.units) {
      if (unit.unitId.length === 0 || unitIds.has(unit.unitId) || !Number.isSafeInteger(unit.startFrame)
        || !Number.isSafeInteger(unit.endFrameExclusive) || unit.startFrame < 0 || unit.endFrameExclusive <= unit.startFrame) {
        throw new Error("TimedCaptionProjection contains an invalid or repeated unit timing");
      }
      unitIds.add(unit.unitId);
    }
  }
}
