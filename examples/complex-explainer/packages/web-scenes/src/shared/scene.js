import { terminalSetup } from "./terminal.js";
import { scene_styles } from "./scene-styles.js";
import { sealVisualTrack } from "@qflow/qflow/composition";
import { browserProgram } from "@qflow/qflow/hyperframes";
import { assertTemporalWindowFor } from "@qflow/qflow/temporal";
const styles = (o) => Object.entries(o).map(([name, value]) => ({ name, value }));
export function scene(t, c, w, font, o, html, css, setup, events, entries, extra = {}) {
  assertTemporalWindowFor(w, { subjectId: o.id, space: t });
  const beats = Object.fromEntries(events.map((e) => [e.name, e.at.frame - w.span.startFrame]));
  const count = w.span.endFrameExclusive - w.span.startFrame;
  const backgrounds = [];
  entries = { ...entries };
  for (const [id, v] of Object.entries(entries)) {
    if (!v.media || !v.backdrop) continue;
    const key = "backdrop-" + id;
    entries[key] = { ...v, backdrop: false };
    backgrounds.push({
      id: key,
      start: v.start ?? 0,
      end: v.end ?? count,
      left: v.backdrop.left ?? 0,
      width: v.backdrop.width ?? 100,
    });
  }
  const backHtml =
    '<div class="backdrop">' +
    backgrounds
      .map(
        (v) =>
          `<div class="backdrop-pane" data-back="${v.id}" style="left:${v.left}%;width:${v.width}%">{{${v.id}}}</div>`,
      )
      .join("") +
    '</div><div class="backdrop-wash"></div>';
  const children = Object.entries(entries).map(([id, v], n) => {
    const shared = {
      id,
      parent: "scene",
      order: n + 2,
      style: styles({ width: "100%", height: "100%", "object-fit": "contain" }),
    };
    if (v.image) return { ...shared, kind: "image", artifact: v.image };
    const m = v.media,
      src = m.timeline.frameRate,
      start = Math.max(0, v.start ?? 0),
      end = Math.min(count, v.end ?? count);
    if (!m.visual) throw Error(id + " requires prepared picture");
    const rate = {
      numerator: src.numerator * t.frameRate.denominator * (v.rate?.numerator ?? 1),
      denominator: src.denominator * t.frameRate.numerator * (v.rate?.denominator ?? 1),
    };
    if (
      !v.loop &&
      !v.holdLast &&
      ((end - start - 1) * rate.numerator) / rate.denominator >= m.timeline.frameCount
    )
      throw Error(id + " source is too short");
    return {
      ...shared,
      kind: "video",
      artifact: m.visual.artifact,
      muted: true,
      sampling: {
        sourceFrameRate: src,
        sourceFrameCount: m.timeline.frameCount,
        segments: v.holdLast
          ? (() => {
              const played = Math.min(
                  end - start,
                  Math.ceil((m.timeline.frameCount * rate.denominator) / rate.numerator),
                ),
                segments = [
                  {
                    target: { startFrame: start, endFrameExclusive: start + played },
                    sourceFrame: { numerator: 0, denominator: 1 },
                    rate,
                  },
                ];
              if (start + played < end)
                segments.push({
                  target: { startFrame: start + played, endFrameExclusive: end },
                  sourceFrame: { numerator: m.timeline.frameCount - 1, denominator: 1 },
                  rate: { numerator: 0, denominator: 1 },
                });
              return segments;
            })()
          : v.loop
            ? Array.from(
                {
                  length: Math.ceil(
                    (end - start) /
                      Math.floor((m.timeline.frameCount * rate.denominator) / rate.numerator),
                  ),
                },
                (_, i) => {
                  const n = Math.floor((m.timeline.frameCount * rate.denominator) / rate.numerator),
                    a = start + i * n;
                  return {
                    target: { startFrame: a, endFrameExclusive: Math.min(end, a + n) },
                    sourceFrame: { numerator: 0, denominator: 1 },
                    rate,
                  };
                },
              )
            : [
                {
                  target: { startFrame: start, endFrameExclusive: end },
                  sourceFrame: { numerator: 0, denominator: 1 },
                  rate,
                },
              ],
      },
    };
  });
  return sealVisualTrack({
    id: o.id,
    programSpaceId: t.id,
    visualIr: "qflow.visual-ir@1",
    presents: [
      {
        id: o.id,
        span: w.span,
        stacking: { order: o.z, tieBreak: o.id },
        elements: [
          {
            id: "scene",
            kind: "program",
            order: 0,
            program: browserProgram({
              html: backHtml + html + '<div class="font-resource">{{font}}</div>',
              css: base + css,
              data: {
                beats,
                fps: t.frameRate.numerator / t.frameRate.denominator,
                count,
                backgrounds,
                ...extra,
              },
              setup:
                terminalSetup +
                `root.style.fontFamily=getComputedStyle(root.querySelector('.font-resource>*')).fontFamily;const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-Math.pow(1-clamp(x),3);const fade=(f,a,z,n=10)=>(a===0?1:ease((f-a)/n))*(z>=data.count?1:clamp((z-f)/n));const paintBackdrop=f=>{for(const b of data.backgrounds){root.querySelector('[data-back="'+b.id+'"]').style.opacity=String(fade(f,b.start,b.end,12));}};` +
                setup,
            }),
            style: styles({
              position: "absolute",
              inset: 0,
              width: c.widthPx + "px",
              height: c.heightPx + "px",
            }),
          },
          {
            id: "font",
            parent: "scene",
            kind: "text",
            order: 1,
            text: "Qflow 字",
            fonts: [font],
            style: styles({ "font-size": "12px" }),
          },
          ...children,
        ],
      },
    ],
  });
}
const base = scene_styles;
