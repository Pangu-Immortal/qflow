import { palette } from "@explainer/visual-language";
import { performanceMedia } from "./performance-media.js";
import {
  assertAttributes,
  assertEmptyElement,
  textAttribute,
  canonicalize,
  sealGraphFragment,
  createMarkupSurfaceHostFacet,
  sameType,
} from "@qflow/qflow/author-kit";
import { performanceStyle, performanceTypes } from "@qflow/qflow/performance";
import { sealVisualTrack, compositionTypes } from "@qflow/qflow/composition";
import { timelineTypes } from "@qflow/qflow/timeline";
import { spatialTypes } from "@qflow/qflow/spatial";
import { temporalTypes } from "@qflow/qflow/temporal";
import { browserProgram } from "@qflow/qflow/hyperframes";
const styles = (o) =>
  Object.entries(o).map(([name, value]) => ({ name, value }));
export function installPortraitInset(module, manifest, component) {
  const inputs = [
      { name: "timeline", type: timelineTypes.track },
      { name: "canvas", type: spatialTypes.canvas },
      { name: "window", type: temporalTypes.window },
      { name: "frame", type: spatialTypes.frame },
    ],
    producer = { module, name: "portrait-inset" };
  manifest.producers.push({
    name: "portrait-inset",
    inputs,
    outputs: [{ name: "visual", type: compositionTypes.visualTrack }],
    needs: [],
  });
  const fragment = sealGraphFragment({
    inputs,
    operations: [
      {
        id: "render",
        producer,
        inputs: Object.fromEntries(
          inputs.map((p) => [p.name, { kind: "fragment-input", name: p.name }]),
        ),
        result: { kind: "output", name: "visual" },
      },
    ],
    exports: [
      {
        name: "visual",
        type: compositionTypes.visualTrack,
        root: { kind: "fragment-operation", operation: "render" },
      },
    ],
  });
  component.producers.push({
    producer,
    handler: ({ inputs }) => {
      const { timeline, canvas, window, frame } = Object.fromEntries(
          Object.entries(inputs).map(([k, r]) => [k, r.value.value]),
        ),
        { clips, children } = performanceMedia(timeline, window);
      const program = browserProgram({
        html:
          '<div class="viewport"><div class="inner">' +
          children.map((v) => "{{" + v.id + "}}").join("") +
          "</div></div>",
        css: `.viewport{position:absolute;overflow:hidden;border-radius:50%;border:4px solid ${palette.ink};box-shadow:0 0 0 5px #fa81b8,7px 9px 0 5px ${palette.ink}}.inner{position:absolute;inset:0;transform:scale(1.23);transform-origin:50% 28%}.inner>*{object-position:50% 28%!important}`,
        data: {
          frame,
          spans: clips.map((c) => ({
            start: c.span.startFrame - window.span.startFrame,
            end: c.span.endFrameExclusive - window.span.startFrame,
          })),
        },
        setup: `const view=root.querySelector('.viewport'),a=data.frame;Object.assign(view.style,{left:a.xPx+'px',top:a.yPx+'px',width:a.widthPx+'px',height:a.heightPx+'px'});const vs=[...root.querySelectorAll('video')];return f=>vs.forEach((v,i)=>v.style.visibility=f>=data.spans[i].start&&f<data.spans[i].end?'inherit':'hidden');`,
      });
      const id = window.subjectId,
        visual = sealVisualTrack({
          id,
          programSpaceId: timeline.id,
          visualIr: "qflow.visual-ir@1",
          presents: children.length
            ? [
                {
                  id,
                  span: window.span,
                  stacking: { order: 60, tieBreak: id },
                  elements: [
                    {
                      id: "scene",
                      kind: "program",
                      order: 0,
                      program,
                      style: styles({
                        position: "absolute",
                        inset: 0,
                        width: canvas.widthPx + "px",
                        height: canvas.heightPx + "px",
                      }),
                    },
                    ...children,
                  ],
                },
              ]
            : [],
        });
      return {
        outputs: { visual: { kind: "inline", value: canonicalize(visual) } },
        needs: {},
      };
    },
  });
  return createMarkupSurfaceHostFacet({
    module,
    declaration: {
      name: "portrait-inset",
      tag: "PortraitInset",
      mode: "structured",
      outputs: [performanceTypes.style],
      vocabulary: {
        summary: "Round speaking portrait with a tighter inner crop.",
        attributes: [
          {
            name: "id",
            kind: "identifier",
            required: true,
            summary: "Style identity",
          },
          ...["frame"].map((name) => ({
            name,
            kind: "reference",
            required: true,
            accepts: [spatialTypes.frame],
            summary: "Portrait viewport",
          })),
        ],
      },
    },
    handler: ({ element, resolveReference }) => {
      assertAttributes(element, ["id", "frame"]);
      assertEmptyElement(element);
      const bindings = {};
      for (const n of ["frame"]) {
        const a = element.attributes[n];
        if (a?.kind !== "reference") throw Error(n + " needs Frame");
        const r = resolveReference(a.path);
        if (!r || !sameType(r.type, spatialTypes.frame))
          throw Error(n + " needs Frame");
        bindings[n] = r;
      }
      return {
        records: [
          {
            id: textAttribute(element, "id"),
            type: performanceTypes.style,
            value: {
              kind: "inline",
              value: canonicalize(performanceStyle(fragment, bindings)),
            },
            range: element.range,
          },
        ],
        components: [],
        fragments: [],
      };
    },
  });
}
