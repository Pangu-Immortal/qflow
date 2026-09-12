import { assertCaptionProgramForDocument, assertTimedCaptionProjection, captionUseVisibility } from "@qflow/caption";
import type { CaptionProgram, TimedCaptionProjection } from "@qflow/caption";
import type { CaptionDocument } from "@qflow/narrative";

import { assertFineCaptionParameters, FINE_CAPTION_FAMILY } from "./style.js";
import type { FineCaptionParameters, FineCaptionSchedule, FineCaptionScheduledCue } from "./types.js";

function assertIntegerFrame(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer Frame`);
}

/**
 * Resolve visible Cue envelopes before the renderer runs.
 *
 * Semantic unit timing stays untouched. `leadFrames` and `tailFrames` only
 * widen the visible envelope, and `cut` prevents adjacent Cues from competing
 * for the same handoff interval without shortening either Cue's spoken time.
 */
export function scheduleFineCaption(
  projection: TimedCaptionProjection,
  program: CaptionProgram,
  document: CaptionDocument,
): FineCaptionSchedule {
  assertTimedCaptionProjection(projection);
  assertCaptionProgramForDocument(program, document);
  if (projection.documentId !== document.id) throw new Error("Fine Caption Schedule received another CaptionDocument");
  if (projection.narrativeId !== document.narrativeId) {
    throw new Error("Fine Caption Schedule received a CaptionDocument from another Narrative");
  }
  const parameters = new Map<string, FineCaptionParameters>();
  const activeStyles = new Set(program.uses.map(use => use.styleId));
  for (const style of program.styles) {
    if (!activeStyles.has(style.id)) continue;
    if (style.rendering === null) continue;
    if (style.rendering.family !== FINE_CAPTION_FAMILY) {
      throw new Error(`Fine Caption cannot schedule Style family ${style.rendering.family}`);
    }
    const value = style.rendering.parameters as unknown as FineCaptionParameters;
    assertFineCaptionParameters(value);
    parameters.set(style.id, value);
  }

  const units = new Map(document.units.map(unit => [unit.id, unit]));
  const cues: FineCaptionScheduledCue[] = [];
  for (const [index, use] of program.uses.entries()) {
    if (use.window.start.source.spaceId !== projection.spaceId) throw new Error("Caption Use belongs to another Timeline");
    const style = parameters.get(use.styleId);
    if (style === undefined) continue; // Hidden still participates in coverage below.
    const desired = projection.cues.filter(cue => use.role === undefined || units.get(cue.units[0]!.unitId)?.role === use.role).map((cue): FineCaptionScheduledCue => ({
      id: `${use.window.subjectId}:${cue.id}`, cueId: cue.id, styleId: use.styleId,
      semanticStartFrame: cue.startFrame, semanticEndFrameExclusive: cue.endFrameExclusive,
      visibleStartFrame: Math.max(0, cue.startFrame - style.timing.leadFrames),
      visibleEndFrameExclusive: cue.endFrameExclusive + style.timing.tailFrames,
      units: cue.units, visibility: [],
    }));
    // Resolve each speaker's ordinary Cue handoff before masking by Use windows.
    desired.sort((a, b) => a.semanticStartFrame - b.semanticStartFrame);
    const previousByRole = new Map<string | undefined, number>();
    const envelopes: FineCaptionScheduledCue[] = [];
    for (const wanted of desired) {
      let cue = wanted;
      const role = units.get(cue.units[0]!.unitId)?.role;
      const previousIndex = previousByRole.get(role);
      const previous = previousIndex === undefined ? undefined : envelopes[previousIndex];
      if (previous !== undefined && style.timing.handoff === "cut" && previous.semanticEndFrameExclusive <= cue.semanticStartFrame) {
        const previousEnd = Math.max(previous.semanticEndFrameExclusive, Math.min(previous.visibleEndFrameExclusive, cue.semanticStartFrame));
        envelopes[previousIndex!] = { ...previous, visibleEndFrameExclusive: previousEnd };
        cue = { ...cue, visibleStartFrame: Math.min(cue.semanticStartFrame, Math.max(cue.visibleStartFrame, previousEnd)) };
      }
      previousByRole.set(role, envelopes.length);
      envelopes.push(cue);
    }
    for (const cue of envelopes) {
      const role = units.get(cue.units[0]!.unitId)?.role;
      const visibility = captionUseVisibility(program, index, role, { startFrame: cue.visibleStartFrame, endFrameExclusive: cue.visibleEndFrameExclusive });
      if (visibility.length) cues.push({ ...cue, visibility });
    }
  }

  const ids = new Set<string>();
  for (const cue of cues) {
    if (ids.has(cue.id)) throw new Error(`Fine Caption Schedule repeats Cue ${cue.id}`);
    ids.add(cue.id);
    assertIntegerFrame(cue.semanticStartFrame, `Fine Caption Cue ${cue.id} semantic start`);
    assertIntegerFrame(cue.semanticEndFrameExclusive, `Fine Caption Cue ${cue.id} semantic end`);
    assertIntegerFrame(cue.visibleStartFrame, `Fine Caption Cue ${cue.id} visible start`);
    assertIntegerFrame(cue.visibleEndFrameExclusive, `Fine Caption Cue ${cue.id} visible end`);
    if (cue.semanticEndFrameExclusive <= cue.semanticStartFrame
      || cue.visibleStartFrame > cue.semanticStartFrame
      || cue.visibleEndFrameExclusive < cue.semanticEndFrameExclusive
      || cue.visibleEndFrameExclusive <= cue.visibleStartFrame) {
      throw new Error(`Fine Caption Cue ${cue.id} has an invalid visible envelope`);
    }
  }
  return {
    spaceId: projection.spaceId,
    narrativeId: projection.narrativeId,
    documentId: document.id,
    cues,
  };
}

export function assertFineCaptionSchedule(value: FineCaptionSchedule): void {
  if (!value.spaceId || !value.narrativeId || !value.documentId) {
    throw new Error("Fine Caption Schedule provenance is empty");
  }
  const ids = new Set<string>();
  for (const cue of value.cues) {
    if (!cue.id || !cue.styleId || ids.has(cue.id) || cue.units.length === 0) {
      throw new Error("Fine Caption Schedule contains an invalid Cue");
    }
    ids.add(cue.id);
    if (!cue.cueId || cue.visibility.length === 0 || cue.visibility.some(span =>
      !Number.isSafeInteger(span.startFrame) || !Number.isSafeInteger(span.endFrameExclusive)
      || span.startFrame < cue.visibleStartFrame || span.endFrameExclusive > cue.visibleEndFrameExclusive
      || span.endFrameExclusive <= span.startFrame)) throw new Error("Fine Caption visibility is invalid");
    for (const [label, frame] of [
      ["semantic start", cue.semanticStartFrame],
      ["semantic end", cue.semanticEndFrameExclusive],
      ["visible start", cue.visibleStartFrame],
      ["visible end", cue.visibleEndFrameExclusive],
    ] as const) assertIntegerFrame(frame, `Fine Caption Cue ${cue.id} ${label}`);
    if (cue.semanticEndFrameExclusive <= cue.semanticStartFrame
      || cue.visibleStartFrame > cue.semanticStartFrame
      || cue.visibleEndFrameExclusive < cue.semanticEndFrameExclusive
      || cue.visibleEndFrameExclusive <= cue.visibleStartFrame) {
      throw new Error(`Fine Caption Cue ${cue.id} has an invalid visible envelope`);
    }
  }
}
