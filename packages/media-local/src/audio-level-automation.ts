import type { AudioProgramClip } from "@qflow/media-operations";

/** Per-sample level automation after source playback/fades, before any requested render-range crop. */
export function audioLevelAutomationFilter(clip: AudioProgramClip): string[] {
  if (clip.gainEnvelope === undefined && clip.audibility === undefined
    && clip.fadeInSamples === 0 && clip.fadeOutSamples === 0) return [];
  const sample = `(n+${clip.targetStartSample})`;
  let gain = "1";
  const points = clip.gainEnvelope;
  if (points !== undefined) {
    gain = String(points.at(-1)!.gain);
    for (let index = points.length - 1; index > 0; index--) {
      const left = points[index - 1]!, right = points[index]!;
      const line = `(${left.gain}+(${right.gain}-${left.gain})*(${sample}-${left.sample})/${right.sample-left.sample})`;
      gain = `if(lt(${sample},${right.sample}),${line},${gain})`;
    }
    gain = `if(lt(${sample},${points[0]!.sample}),${points[0]!.gain},${gain})`;
  }
  if (clip.audibility !== undefined) {
    const active = clip.audibility.map(span => `(gte(${sample},${span.startSample})*lt(${sample},${span.endSampleExclusive}))`).join("+") || "0";
    gain = `(${gain})*(${active})`;
  }
  if (clip.fadeInSamples > 0) {
    const end = clip.mixStartSample + clip.fadeInSamples;
    gain = `(${gain})*if(lt(${sample},${end}),max(0,(${sample}-${clip.mixStartSample})/${clip.fadeInSamples}),1)`;
  }
  if (clip.fadeOutSamples > 0) {
    const start = clip.mixEndSampleExclusive - clip.fadeOutSamples;
    gain = `(${gain})*if(gte(${sample},${start}),max(0,(${clip.mixEndSampleExclusive}-${sample})/${clip.fadeOutSamples}),1)`;
  }
  return [`aeval=exprs='val(0)*(${gain})|val(1)*(${gain})'`];
}
