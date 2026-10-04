import type { CaptionTiming } from "./types.js";

export function assertCaptionTiming(timing: CaptionTiming): void {
  if (timing.timelineId.length === 0 || timing.documentId.length === 0) {
    throw new Error("CaptionTiming provenance is invalid");
  }
  const cueIds = new Set<string>();
  const unitIds = new Set<string>();
  for (const cue of timing.cues) {
    if (cue.id.length === 0 || cueIds.has(cue.id) || cue.units.length === 0
      || !Number.isSafeInteger(cue.startFrame) || !Number.isSafeInteger(cue.endFrameExclusive)
      || cue.startFrame < 0 || cue.endFrameExclusive <= cue.startFrame) throw new Error("CaptionTiming contains an invalid Cue");
    cueIds.add(cue.id);
    for (const unit of cue.units) {
      if (unit.unitId.length === 0 || unitIds.has(unit.unitId) || !Number.isSafeInteger(unit.startFrame)
        || !Number.isSafeInteger(unit.endFrameExclusive) || unit.startFrame < 0 || unit.endFrameExclusive <= unit.startFrame) {
        throw new Error("CaptionTiming contains an invalid or repeated unit timing");
      }
      unitIds.add(unit.unitId);
    }
  }
}
