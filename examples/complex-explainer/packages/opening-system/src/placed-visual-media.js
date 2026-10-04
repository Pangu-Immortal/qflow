export function placedVisualMedia(timeline, window, sources, parent = "scene") {
  const clips = sources.flatMap((source) => {
    if (source.window.start.timelineId !== timeline.id || source.window.end.timelineId !== timeline.id)
      throw Error(`Visual source ${source.id} belongs to another Timeline.`);
    const placed = source.window.span;
    const startFrame = Math.max(placed.startFrame, window.span.startFrame);
    const endFrameExclusive = Math.min(
      placed.endFrameExclusive,
      window.span.endFrameExclusive,
      placed.startFrame + source.media.frameDomain.frameCount,
    );
    if (endFrameExclusive <= startFrame) return [];
    return [{
      source,
      span: { startFrame, endFrameExclusive },
      sourceStartFrame: startFrame - placed.startFrame,
    }];
  });
  const children = clips.map((clip, index) => ({
    id: "source-" + index,
    parent,
    kind: "video",
    order: index + 1,
    muted: true,
    artifact: clip.source.media.visual.artifact,
    style: Object.entries({
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      "object-fit": "cover",
    }).map(([name, value]) => ({ name, value })),
    sourceTime: {
      sourceFrameRate: clip.source.media.frameDomain.frameRate,
      sourceFrameCount: clip.source.media.frameDomain.frameCount,
      pieces: [{
        target: {
          startFrame: clip.span.startFrame - window.span.startFrame,
          endFrameExclusive:
            clip.span.endFrameExclusive - window.span.startFrame,
        },
        sourceAtStart: { numerator: clip.sourceStartFrame, denominator: 1 },
        rate: { numerator: 1, denominator: 1 },
      }],
    },
  }));
  return { clips, children };
}
