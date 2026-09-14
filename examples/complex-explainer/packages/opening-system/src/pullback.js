import { performanceMedia } from "./performance-media.js";
import {
  assertAttributes,
  assertEmptyElement,
  textAttribute,
  canonicalize,
  sealGraphFragment,
  createMarkupSurfaceHostFacet,
} from "@qflow/qflow/author-kit";
import {
  performanceStyle,
  performanceTypes,
  performanceModuleRef,
} from "@qflow/qflow/performance";
import { sealVisualTrack, compositionTypes } from "@qflow/qflow/composition";
import { timelineTypes } from "@qflow/qflow/timeline";
import { spatialTypes } from "@qflow/qflow/spatial";
import { temporalTypes } from "@qflow/qflow/temporal";
import { browserProgram } from "@qflow/qflow/hyperframes";
const styles = (o) =>
  Object.entries(o).map(([name, value]) => ({ name, value }));
// A local Use owns the pullback's clock; media continues at its placed source time.
export function installPullback(module, manifest, component, optionsType, mode="pullback") {
  const isFade=mode==="fade-out",tag=isFade?"FadeOut":"Pullback";
  const inputs = [
    { name: "timeline", type: timelineTypes.track },
    { name: "canvas", type: spatialTypes.canvas },
    { name: "window", type: temporalTypes.window },
    { name: "options", type: optionsType },
  ];
  const producer = { module, name: mode };
  if (!manifest.dependencies.some(d=>d.module.name===performanceModuleRef.name)) manifest.dependencies.push({ module: performanceModuleRef });
  manifest.producers.push({
    name: mode,
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
      const { timeline, canvas, window, options } = Object.fromEntries(
        Object.entries(inputs).map(([k, r]) => {
          if (r.value.kind !== "inline")
            throw Error("Pullback needs inline inputs");
          return [k, r.value.value];
        }),
      );
      const { clips, children } = performanceMedia(timeline, window);
      const duration = window.span.endFrameExclusive - window.span.startFrame;
      const program = browserProgram({
        html:
          '<div class="picture">' +
          children.map((c) => "{{" + c.id + "}}").join("") +
          "</div>",
        css: (isFade?":scope{background:#fce5ee}":"")+":scope{overflow:hidden}.picture{position:absolute;inset:0;transform-origin:50% 35%}",
        data: {
          scale: options.scale,
          fade: isFade,
          duration,
          spans: clips.map((c) => ({
            start: c.span.startFrame - window.span.startFrame,
            end: c.span.endFrameExclusive - window.span.startFrame,
          })),
        },
        setup: `const picture=root.querySelector('.picture'),videos=[...picture.querySelectorAll('video')];return frame=>{const p=Math.max(0,Math.min(1,frame/Math.max(1,data.duration-1))),scale=1+(data.scale-1)*Math.pow(1-p,4);picture.style.transform='scale('+scale+')';picture.style.opacity=data.fade?String(1-p*p*(3-2*p)):'1';videos.forEach((v,i)=>v.style.visibility=frame>=data.spans[i].start&&frame<data.spans[i].end?'inherit':'hidden');};`,
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
                  stacking: { order: 0, tieBreak: id },
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
      name: mode,
      tag,
      mode: "structured",
      outputs: [performanceTypes.style, optionsType],
      vocabulary: {
        summary:
          isFade?"Fade placed footage to transparent across this Use.":"Fast-to-slow pullback of placed footage, settling at ordinary full-frame geometry.",
        attributes: [
          {
            name: "id",
            kind: "identifier",
            required: true,
            summary: "Style identity",
          },
          ...(!isFade?[{
            name: "scale",
            kind: "literal",
            required: false,
            summary: "Initial magnification; defaults to 1.5",
          }]:[]),
        ],
      },
    },
    handler: ({ element }) => {
      assertAttributes(element, isFade?["id"]:["id", "scale"]);
      assertEmptyElement(element);
      const id = textAttribute(element, "id"),
        scale = isFade?1:Number(element.attributes.scale ?? 1.5);
      if (!Number.isFinite(scale) || scale < 1)
        throw Error("Pullback scale must be at least 1");
      const options = {
        type: optionsType,
        ref: { kind: "record", id: id + ".options" },
      };
      return {
        records: [
          {
            id: id + ".options",
            type: optionsType,
            value: { kind: "inline", value: canonicalize({ scale }) },
            range: element.range,
          },
          {
            id,
            type: performanceTypes.style,
            value: {
              kind: "inline",
              value: canonicalize(performanceStyle(fragment, { options })),
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
