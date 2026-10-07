import { assertCaptionProgramForDocument, assertCaptionTiming, captionUseVisibility } from "@qflow/qflow/caption";
import type { CaptionProgram, CaptionTiming } from "@qflow/qflow/caption";
import type { CaptionDocument } from "@qflow/qflow/caption";

import { assertFineCaptionParameters, FINE_CAPTION_FAMILY } from "./style.js";
import type { FineCaptionParameters, FineCaptionSchedule, FineCaptionScheduledCue } from "./types.js";

function assertIntegerFrame(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer Frame`);
}

/**
 * Resolve visible Cue envelopes before the renderer runs.
 *
 * Resolved unit timing stays untouched. `leadFrames` and `tailFrames` only
 * widen the visible envelope, and `cut` prevents adjacent Cues from competing
 * for the same handoff interval without shortening either Cue's spoken time.
 */
export function scheduleFineCaption(
  timing: CaptionTiming,
  program: CaptionProgram,
  document: CaptionDocument,
): FineCaptionSchedule {
  assertCaptionTiming(timing);
  assertCaptionProgramForDocument(program, document);
  if (timing.documentId !== document.id) throw new Error("Fine Caption Schedule received another CaptionDocument");
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
    if (use.window.start.timelineId !== timing.timelineId) throw new Error("Caption Use belongs to another Timeline");
    const style = parameters.get(use.styleId);
    if (style === undefined) continue; // Hidden still participates in coverage below.
    const desired = timing.cues.filter(cue => use.role === undefined || units.get(cue.units[0]!.unitId)?.role === use.role).map((cue): FineCaptionScheduledCue => ({
      id: `${use.window.subjectId}:${cue.id}`, cueId: cue.id, styleId: use.styleId,
      timedStartFrame: cue.startFrame, timedEndFrameExclusive: cue.endFrameExclusive,
      visibleStartFrame: Math.max(0, cue.startFrame - style.timing.leadFrames),
      visibleEndFrameExclusive: cue.endFrameExclusive + style.timing.tailFrames,
      units: cue.units, visibility: [],
    }));
    // Resolve each speaker's ordinary Cue handoff before masking by Use windows.
    desired.sort((a, b) => a.timedStartFrame - b.timedStartFrame);
    const previousByRole = new Map<string | undefined, number>();
    const envelopes: FineCaptionScheduledCue[] = [];
    for (const wanted of desired) {
      let cue = wanted;
      const role = units.get(cue.units[0]!.unitId)?.role;
      const previousIndex = previousByRole.get(role);
      const previous = previousIndex === undefined ? undefined : envelopes[previousIndex];
      if (previous !== undefined && style.timing.handoff === "cut" && previous.timedEndFrameExclusive <= cue.timedStartFrame) {
        const previousEnd = Math.max(previous.timedEndFrameExclusive, Math.min(previous.visibleEndFrameExclusive, cue.timedStartFrame));
        envelopes[previousIndex!] = { ...previous, visibleEndFrameExclusive: previousEnd };
        cue = { ...cue, visibleStartFrame: Math.min(cue.timedStartFrame, Math.max(cue.visibleStartFrame, previousEnd)) };
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
    assertIntegerFrame(cue.timedStartFrame, `Fine Caption Cue ${cue.id} timed start`);
    assertIntegerFrame(cue.timedEndFrameExclusive, `Fine Caption Cue ${cue.id} timed end`);
    assertIntegerFrame(cue.visibleStartFrame, `Fine Caption Cue ${cue.id} visible start`);
    assertIntegerFrame(cue.visibleEndFrameExclusive, `Fine Caption Cue ${cue.id} visible end`);
    if (cue.timedEndFrameExclusive <= cue.timedStartFrame
      || cue.visibleStartFrame > cue.timedStartFrame
      || cue.visibleEndFrameExclusive < cue.timedEndFrameExclusive
      || cue.visibleEndFrameExclusive <= cue.visibleStartFrame) {
      throw new Error(`Fine Caption Cue ${cue.id} has an invalid visible envelope`);
    }
  }
  return {
    timelineId: timing.timelineId,
    documentId: document.id,
    cues,
  };
}

export function assertFineCaptionSchedule(value: FineCaptionSchedule): void {
  if (!value.timelineId || !value.documentId) {
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
      ["timed start", cue.timedStartFrame],
      ["timed end", cue.timedEndFrameExclusive],
      ["visible start", cue.visibleStartFrame],
      ["visible end", cue.visibleEndFrameExclusive],
    ] as const) assertIntegerFrame(frame, `Fine Caption Cue ${cue.id} ${label}`);
    if (cue.timedEndFrameExclusive <= cue.timedStartFrame
      || cue.visibleStartFrame > cue.timedStartFrame
      || cue.visibleEndFrameExclusive < cue.timedEndFrameExclusive
      || cue.visibleEndFrameExclusive <= cue.visibleStartFrame) {
      throw new Error(`Fine Caption Cue ${cue.id} has an invalid visible envelope`);
    }
  }
}
