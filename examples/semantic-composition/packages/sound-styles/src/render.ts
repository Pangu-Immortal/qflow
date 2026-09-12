import { sealAudioTrack } from "@qflow/qflow/composition";
import { sourceSound } from "@qflow/qflow/sound";
import type { Timeline } from "@qflow/qflow/timeline";
import type { TemporalWindow } from "@qflow/qflow/temporal";
import type { NarrativeExcerpt } from "@qflow/qflow/narrative";

/** The family explicitly chooses the two roles; the Window only controls the blend progress. */
export function crossfadeSound(timeline: Timeline, window: TemporalWindow,
  outgoing: NarrativeExcerpt, incoming: NarrativeExcerpt) {
  if (outgoing.id === incoming.id && outgoing.narrativeId === incoming.narrativeId) throw new Error("Crossfade needs two distinct sources.");
  const left = sourceSound(timeline, window, outgoing, { gain: 1, endGain: 0 });
  const right = sourceSound(timeline, window, incoming, { gain: 0, endGain: 1 });
  return sealAudioTrack({ id: window.subjectId, programSpaceId: timeline.id, clips: [...left.clips, ...right.clips] });
}
