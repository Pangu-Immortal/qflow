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
export function installReframe(module, manifest, component) {
  const inputs = [
      { name: "timeline", type: timelineTypes.track },
      { name: "canvas", type: spatialTypes.canvas },
      { name: "window", type: temporalTypes.window },
      { name: "from", type: spatialTypes.frame },
      { name: "to", type: spatialTypes.frame },
    ],
    producer = { module, name: "reframe" };
  manifest.producers.push({
    name: "reframe",
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
      const { timeline, canvas, window, from, to } = Object.fromEntries(
          Object.entries(inputs).map(([k, r]) => [k, r.value.value]),
        ),
        { clips, children } = performanceMedia(timeline, window);
      const program = browserProgram({
        html:
          '<div class="viewport">' +
          children.map((v) => "{{" + v.id + "}}").join("") +
          "</div>",
        css: ".viewport{position:absolute;overflow:hidden}.viewport>*{object-position:50% 30%!important}",
        data: {
          from,
          to,
          duration: window.span.endFrameExclusive - window.span.startFrame,
        },
        setup: `const view=root.querySelector('.viewport');return f=>{const p=Math.max(0,Math.min(1,f/Math.max(1,data.duration-1))),q=p*p*(3-2*p),a=data.from,b=data.to;Object.assign(view.style,{left:(a.xPx+(b.xPx-a.xPx)*q)+'px',top:(a.yPx+(b.yPx-a.yPx)*q)+'px',width:(a.widthPx+(b.widthPx-a.widthPx)*q)+'px',height:(a.heightPx+(b.heightPx-a.heightPx)*q)+'px'});};`,
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
      name: "reframe",
      tag: "Reframe",
      mode: "structured",
      outputs: [performanceTypes.style],
      vocabulary: {
        summary:
          "Continuous prepared-performance viewport change between two Frames.",
        attributes: [
          {
            name: "id",
            kind: "identifier",
            required: true,
            summary: "Style identity",
          },
          ...["from", "to"].map((name) => ({
            name,
            kind: "reference",
            required: true,
            accepts: [spatialTypes.frame],
            summary: "Endpoint frame",
          })),
        ],
      },
    },
    handler: ({ element, resolveReference }) => {
      assertAttributes(element, ["id", "from", "to"]);
      assertEmptyElement(element);
      const bindings = {};
      for (const n of ["from", "to"]) {
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
