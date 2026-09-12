import type { AudioProgramClip } from "@qflow/media-pipeline";

/** Per-sample gain after source playback/fades, before any requested render-range crop. */
export function audioPresentationFilter(clip: AudioProgramClip): string[] {
  if (clip.gainEnvelope === undefined && clip.audibility === undefined) return [];
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
  return [`aeval=exprs='val(0)*(${gain})|val(1)*(${gain})'`];
}
