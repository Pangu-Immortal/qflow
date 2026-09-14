import { projectTimelineMedia } from "@qflow/qflow/timeline";
export function performanceMedia(timeline, window, parent = "scene") {
  const clips = projectTimelineMedia(timeline, window.span).filter(
    (clip) => clip.media.visual,
  );
  const children = clips.map((clip, index) => ({
    id: "clip" + index,
    parent,
    kind: "video",
    order: index + 1,
    muted: true,
    artifact: clip.media.visual.artifact,
    style: Object.entries({
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      "object-fit": "cover",
    }).map(([name, value]) => ({ name, value })),
    sampling: {
      sourceFrameRate: clip.media.timeline.frameRate,
      sourceFrameCount: clip.media.timeline.frameCount,
      segments: [
        {
          target: {
            startFrame: clip.span.startFrame - window.span.startFrame,
            endFrameExclusive:
              clip.span.endFrameExclusive - window.span.startFrame,
          },
          sourceFrame: { numerator: clip.source.startFrame, denominator: 1 },
          rate: { numerator: 1, denominator: 1 },
        },
      ],
    },
  }));
  return { clips, children };
}
