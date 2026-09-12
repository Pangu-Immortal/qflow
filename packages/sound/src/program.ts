import { sealAudioTrack, assertAudioTrackIdentity } from "@qflow/composition";
import type { AudioTrack, AudioClip, AudioSampleSpan, AudioGainPoint } from "@qflow/composition";
import { assertTemporalWindowFor } from "@qflow/temporal";
import type { TemporalWindow } from "@qflow/temporal";
import { projectTimelineAudio } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";
import type { NarrativeExcerpt } from "@qflow/narrative";
import { programFrameSampleBoundary } from "@qflow/program-space";

export type SoundUse = { readonly window: TemporalWindow; readonly audio: AudioTrack };
export type SoundSet = { readonly uses: readonly SoundUse[] };
export type SoundGain = { readonly gain: number; readonly endGain: number };

export function soundWindow(timeline: Timeline, window: TemporalWindow): AudioSampleSpan {
  assertTemporalWindowFor(window, { subjectId: window.subjectId, space: timeline });
  return { startSample: programFrameSampleBoundary(timeline, window.span.startFrame, 48000),
    endSampleExclusive: programFrameSampleBoundary(timeline, window.span.endFrameExclusive, 48000) };
}
export function intersectAudioSpans(left: readonly AudioSampleSpan[], right: readonly AudioSampleSpan[]): AudioSampleSpan[] {
  return left.flatMap(a => right.flatMap(b => {
    const startSample = Math.max(a.startSample, b.startSample), endSampleExclusive = Math.min(a.endSampleExclusive, b.endSampleExclusive);
    return endSampleExclusive > startSample ? [{ startSample, endSampleExclusive }] : [];
  }));
}
function subtract(spans: readonly AudioSampleSpan[], cut: AudioSampleSpan): AudioSampleSpan[] {
  return spans.flatMap(span => {
    if (cut.endSampleExclusive <= span.startSample || cut.startSample >= span.endSampleExclusive) return [span];
    return [
      ...(cut.startSample > span.startSample ? [{ startSample: span.startSample, endSampleExclusive: cut.startSample }] : []),
      ...(cut.endSampleExclusive < span.endSampleExclusive ? [{ startSample: cut.endSampleExclusive, endSampleExclusive: span.endSampleExclusive }] : []),
    ];
  });
}
function envelope(span: AudioSampleSpan, gain: SoundGain): readonly AudioGainPoint[] {
  if (![gain.gain, gain.endGain].every(value => Number.isFinite(value) && value >= 0 && value <= 64)) throw new Error("Sound gain must be from 0 to 64.");
  return [{ sample: span.startSample, gain: gain.gain }, { sample: span.endSampleExclusive, gain: gain.endGain }];
}
const unity = { gain: 1, endGain: 1 };

/** Default source choice is declaration order, independently of the order of Use rules. */
export function ordinarySound(timeline: Timeline, window: TemporalWindow, gain: SoundGain = unity): AudioTrack {
  const span = soundWindow(timeline, window), gainEnvelope = envelope(span, gain);
  const sources = new Map(projectTimelineAudio(timeline).clips.map(clip => [clip.id, clip]));
  const clips = timeline.items.flatMap(item => { const clip = sources.get(item.take.segment.segmentId); return clip ? [clip] : []; });
  const result: AudioClip[] = [];
  for (const [index, clip] of clips.entries()) {
    let audibility = intersectAudioSpans([span], [clip.target]);
    for (const later of clips.slice(index + 1)) audibility = subtract(audibility, later.target);
    if (audibility.length && (gain.gain !== 0 || gain.endGain !== 0)) result.push({ ...clip, gainEnvelope, audibility });
  }
  return sealAudioTrack({ id: window.subjectId, programSpaceId: timeline.id, clips: result });
}

/** Explicit source selection for project Styles, with its original placement/sampling retained. */
export function sourceSound(timeline: Timeline, window: TemporalWindow, segment: NarrativeExcerpt, gain: SoundGain = unity): AudioTrack {
  if (segment.kind !== "segment" || segment.narrativeId !== timeline.narrativeId) throw new Error("Sound source must be a Segment of this Timeline's Narrative.");
  if (!timeline.items.some(item => item.take.segment.segmentId === segment.id)) throw new Error(`Unknown Sound Segment ${segment.id}.`);
  const span = soundWindow(timeline, window), gainEnvelope = envelope(span, gain);
  const clip = projectTimelineAudio(timeline).clips.find(clip => clip.id === segment.id);
  const audibility = clip ? intersectAudioSpans([span], [clip.target]) : [];
  return sealAudioTrack({ id: `${window.subjectId}:${segment.id}`, programSpaceId: timeline.id,
    clips: clip && audibility.length && (gain.gain !== 0 || gain.endGain !== 0) ? [{ ...clip, gainEnvelope, audibility }] : [] });
}
export function appendSoundUse(set: SoundSet, window: TemporalWindow, audio: AudioTrack): SoundSet {
  assertAudioTrackIdentity(audio);
  if (audio.programSpaceId !== window.start.source.spaceId) throw new Error("Sound Use and audio belong to different Timelines.");
  return { uses: [...set.uses, { window, audio }] };
}
/** Resolve presentation coverage without changing original targets, source clocks or envelopes. */
export function resolveSound(timeline: Timeline, id: string, set: SoundSet): AudioTrack {
  const windows = set.uses.map(use => { assertAudioTrackIdentity(use.audio, timeline); return soundWindow(timeline, use.window); });
  const clips: AudioClip[] = [];
  for (const [index, use] of set.uses.entries()) {
    let active = [windows[index]!];
    for (const cut of windows.slice(index + 1)) active = subtract(active, cut);
    for (const clip of use.audio.clips) {
      const audibility = intersectAudioSpans(active, clip.audibility ?? [clip.target]);
      if (audibility.length) clips.push({ ...clip, id: `${index + 1}:${clip.id}`, audibility });
    }
  }
  const result = sealAudioTrack({ id, programSpaceId: timeline.id, clips });
  assertAudioTrackIdentity(result, timeline);
  return result;
}
