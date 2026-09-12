import { sealVisualTrack } from "@qflow/qflow/composition";
import type { VisualElement } from "@qflow/qflow/composition";
import { browserProgram } from "@qflow/qflow/hyperframes";
import { projectTimelineMedia } from "@qflow/qflow/timeline";
import type { Timeline } from "@qflow/qflow/timeline";
import type { TemporalWindow } from "@qflow/qflow/temporal";
import type { SpatialFrame } from "@qflow/qflow/spatial";
import type { NarrativeExcerpt } from "@qflow/qflow/narrative";

/** Project behavior, not a registered special effect: the original Use window owns progress. */
export function movingFrame(timeline: Timeline, window: TemporalWindow, from: SpatialFrame, to: SpatialFrame) {
  return render(timeline, window, { from, to });
}
export function crossfade(timeline: Timeline, window: TemporalWindow, outgoing: NarrativeExcerpt, incoming: NarrativeExcerpt, frame: SpatialFrame) {
  for (const ref of [outgoing, incoming]) {
    if (ref.narrativeId !== timeline.narrativeId || !timeline.items.some(item => item.take.segment.segmentId === ref.id)) {
      throw new Error(`Unknown crossfade source ${ref.id}.`);
    }
  }
  return render(timeline, window, { outgoing: outgoing.id, incoming: incoming.id, from: frame, to: frame });
}
function render(timeline: Timeline, window: TemporalWindow, options: { from: SpatialFrame; to: SpatialFrame; outgoing?: string; incoming?: string }) {
  const id = window.subjectId;
  const clips = projectTimelineMedia(timeline, window.span).filter(clip => clip.media.visual !== undefined
    && (options.outgoing === undefined || clip.segmentId === options.outgoing || clip.segmentId === options.incoming));
  const videos: VisualElement[] = clips.map((clip, index) => ({
    id: `source-${index}`, parent: "scene", order: index + 1, kind: "video", muted: true,
    artifact: clip.media.visual!.artifact,
    attributes: [{ name: "data-source-role", value: options.incoming === clip.segmentId ? "incoming" : "outgoing" }],
    style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 }, { name: "width", value: "100%" }, { name: "height", value: "100%" }, { name: "object-fit", value: "cover" }],
    sampling: { sourceFrameRate: clip.media.timeline.frameRate, sourceFrameCount: clip.media.timeline.frameCount, segments: [{
      target: { startFrame: clip.span.startFrame - window.span.startFrame, endFrameExclusive: clip.span.endFrameExclusive - window.span.startFrame },
      sourceFrame: { numerator: clip.source.startFrame, denominator: 1 }, rate: { numerator: 1, denominator: 1 },
    }] },
  }));
  const program = browserProgram({
    html: `<div class="viewport">${videos.map((video,index) => `<div class="source" data-role="${clips[index]!.segmentId === options.incoming ? "incoming" : "outgoing"}">{{${video.id}}}</div>`).join("")}</div>`,
    css: `.viewport{position:absolute;overflow:hidden;isolation:isolate}.source{position:absolute;inset:0;${options.outgoing === undefined ? '' : 'mix-blend-mode:plus-lighter'}}`,
    data: { from: options.from, to: options.to, mixing: options.outgoing !== undefined, duration: window.span.endFrameExclusive - window.span.startFrame },
    setup: `const view=root.querySelector('.viewport'), sources=view.querySelectorAll('.source');
      return frame => {
        const p=Math.max(0,Math.min(1,frame/Math.max(1,data.duration-1)));
        const q=p*p*(3-2*p), a=data.from, b=data.to;
        Object.assign(view.style,{left:(a.xPx+(b.xPx-a.xPx)*q)+'px',top:(a.yPx+(b.yPx-a.yPx)*q)+'px',
          width:(a.widthPx+(b.widthPx-a.widthPx)*q)+'px',height:(a.heightPx+(b.heightPx-a.heightPx)*q)+'px'});
        if(data.mixing) for(const child of sources) {
          const role=child.dataset.role;
          child.style.opacity=String(role==='incoming'?p:1-p);
        }
      };`,
  });
  return sealVisualTrack({ id, programSpaceId: timeline.id, visualIr: "qflow.visual-ir@1", presents: videos.length ? [{ id, span: window.span,
    stacking: { order: 0, tieBreak: id }, elements: [{ id: "scene", kind: "program", order: 0, style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 }], program }, ...videos] }] : [] });
}
