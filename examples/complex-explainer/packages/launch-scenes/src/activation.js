import { sceneCompanions } from "./studio.js";
import { createStudioTrackCompanionHostFacet } from "@qflow/qflow/studio-adapter";
import {
  assertAttributes,
  assertEmptyElement,
  textAttribute,
  canonicalize,
  sameType,
  sealGraphFragment,
  createMarkupSurfaceHostFacet,
} from "@qflow/qflow/author-kit";
import { compositionTypes } from "@qflow/qflow/composition";
import { mediaTypes } from "@qflow/qflow/media";
import { timelineTypes } from "@qflow/qflow/timeline";
import { spatialTypes } from "@qflow/qflow/spatial";
import { temporalTypes, assertTemporalInstantFor } from "@qflow/qflow/temporal";
import {
  resolveTemporalContext,
  createTemporalWindowProjection,
  createTemporalInstantProjection,
  temporalWindowAttributeNames,
  temporalWindowAttributeVocabulary,
  temporalContextAttributeVocabulary,
  temporalInstantAttributeNames,
  temporalInstantAttributeVocabulary,
} from "@qflow/qflow/temporal-markup";
import { renderPoster } from "./render.js";
const module = { name: "@explainer/launch-scenes", version: "1" },
  type = (name) => ({ module, name }),
  producer = (name) => ({ module, name }),
  port = (name, type) => ({ name, type });
const options = type("Options"),
  events = type("Events");
const common = [
  port("timeline", timelineTypes.track),
  port("canvas", spatialTypes.canvas),
  port("window", temporalTypes.window),
  port("font", mediaTypes.fontArtifact),
  port("options", options),
  port("events", events),
];
const tags = {
  PosterTitle: {
    name: "poster",
    render: renderPoster,
    assets: [],
    defaults: {
      text: "Qflow",
      subtitle: "",
      z: 45,
      y: 0.18,
      size: 180,
      "subtitle-size": 44,
      "subtitle-gap": 36,
    },
  },
};
const ins = (tag) => [...common, ...tags[tag].assets.map((n) => port(n, mediaTypes.blobArtifact))];
export const manifest = {
  format: "qflow.module@1",
  ...module,
  dependencies: [
    ...new Map(
      [
        compositionTypes.visualTrack,
        mediaTypes.fontArtifact,
        mediaTypes.blobArtifact,
        timelineTypes.track,
        spatialTypes.canvas,
        temporalTypes.window,
        temporalTypes.instant,
      ].map((t) => [t.module.name, { module: t.module }]),
    ).values(),
  ],
  types: [{ name: "Options" }, { name: "Events" }],
  capabilities: [],
  producers: [
    { name: "empty", inputs: [], outputs: [port("events", events)], needs: [] },
    {
      name: "append",
      inputs: [
        port("timeline", timelineTypes.track),
        port("events", events),
        port("options", options),
        port("at", temporalTypes.instant),
      ],
      outputs: [port("events", events)],
      needs: [],
    },
    ...Object.keys(tags).map((tag) => ({
      name: tags[tag].name,
      inputs: ins(tag),
      outputs: [port("track", compositionTypes.visualTrack)],
      needs: [],
    })),
  ],
};
const inline = (r) => {
    if (r?.value.kind !== "inline") throw Error("Expected inline scene value");
    return r.value.value;
  },
  value = (v) => ({ kind: "inline", value: canonicalize(v) }),
  out = (n, v) => ({ outputs: { [n]: value(v) }, needs: {} });
const component = {
  producers: [
    { producer: producer("empty"), handler: () => out("events", []) },
    {
      producer: producer("append"),
      handler: ({ inputs: i }) => {
        const o = inline(i.options),
          at = inline(i.at),
          list = inline(i.events);
        assertTemporalInstantFor(at, {
          subjectId: o.id,
          space: inline(i.timeline),
        });
        if (list.some((e) => e.name === o.name)) throw Error("Beat names must be unique");
        return out("events", [...list, { ...o, at }]);
      },
    },
    ...Object.keys(tags).map((tag) => ({
      producer: producer(tags[tag].name),
      handler: ({ inputs: i }) =>
        out(
          "track",
          tags[tag].render(
            inline(i.timeline),
            inline(i.canvas),
            inline(i.window),
            inline(i.font),
            inline(i.options),
            inline(i.events),
            Object.fromEntries(tags[tag].assets.map((n) => [n, i[n].value])),
          ),
        ),
    })),
  ],
};
function decode(tag) {
  return ({ element, resolveReference }) => {
    const spec = tags[tag];
    assertAttributes(element, [
      "id",
      "timeline",
      "canvas",
      "font",
      ...spec.assets,
      ...Object.keys(spec.defaults),
      ...temporalWindowAttributeNames,
    ]);
    const id = textAttribute(element, "id"),
      context = resolveTemporalContext({ element, resolveReference }),
      window = createTemporalWindowProjection({
        id: id + ".window",
        subjectId: id,
        element,
        ...context,
        resolveReference,
      });
    const ref = (el, n, t) => {
      const raw = el.attributes[n];
      if (typeof raw !== "object" || raw.kind !== "reference")
        throw Error(n + " must be a reference");
      const r = resolveReference(raw.path);
      if (!r || !sameType(r.type, t)) throw Error(n + " has wrong type");
      return r.ref;
    };
    const opts = { id };
    for (const [n, d] of Object.entries(spec.defaults)) {
      const v = element.attributes[n];
      if (v !== undefined && typeof v !== "string") throw Error(n + " must be literal");
      opts[n] = typeof d === "number" ? Number(v ?? d) : (v ?? d);
    }
    if (!Number.isSafeInteger(opts.z)) throw Error("z must be integer");
    const records = [
        ...window.records,
        {
          id: id + ".options",
          type: options,
          value: value(opts),
          range: element.range,
        },
      ],
      components = [...window.components],
      fragments = [...window.fragments];
    const inputs = ins(tag).filter((p) => p.name !== "events"),
      bindings = {
        timeline: context.timeline.ref,
        canvas: ref(element, "canvas", spatialTypes.canvas),
        window: window.ref,
        font: ref(element, "font", mediaTypes.fontArtifact),
        options: { kind: "record", id: id + ".options" },
      };
    for (const n of spec.assets) bindings[n] = ref(element, n, mediaTypes.blobArtifact);
    const input = (name) => ({ kind: "fragment-input", name }),
      op = (operation) => ({ kind: "fragment-operation", operation }),
      operations = [
        {
          id: "empty",
          producer: producer("empty"),
          inputs: {},
          result: { kind: "output", name: "events" },
        },
      ];
    let prev = "empty",
      count = 0;
    for (const ch of element.children) {
      if (ch.kind === "text") {
        if (ch.value.trim()) throw Error("Expected Beat");
        continue;
      }
      if (ch.name.split(":").at(-1) !== "Beat") throw Error("Expected Beat");
      assertAttributes(ch, ["name", ...temporalInstantAttributeNames]);
      assertEmptyElement(ch);
      const name = textAttribute(ch, "name"),
        key = "beat" + ++count,
        eid = id + "." + key,
        at = createTemporalInstantProjection({
          id: eid,
          subjectId: eid,
          element: ch,
          ...context,
          resolveReference,
        });
      records.push(...at.records, {
        id: eid + ".options",
        type: options,
        value: value({ id: eid, name }),
        range: ch.range,
      });
      components.push(...at.components);
      fragments.push(...at.fragments);
      inputs.push(port(key, options), port(key + "-at", temporalTypes.instant));
      bindings[key] = { kind: "record", id: eid + ".options" };
      bindings[key + "-at"] = at.ref;
      operations.push({
        id: key,
        producer: producer("append"),
        inputs: {
          timeline: input("timeline"),
          events: op(prev),
          options: input(key),
          at: input(key + "-at"),
        },
        result: { kind: "output", name: "events" },
      });
      prev = key;
    }
    operations.push({
      id: "render",
      producer: producer(spec.name),
      inputs: {
        ...Object.fromEntries(
          ins(tag)
            .filter((p) => p.name !== "events")
            .map((p) => [p.name, input(p.name)]),
        ),
        events: op(prev),
      },
      result: { kind: "output", name: "track" },
    });
    const fragment = sealGraphFragment({
      inputs,
      operations,
      exports: [
        {
          name: "track",
          type: compositionTypes.visualTrack,
          root: op("render"),
        },
      ],
    });
    return {
      records,
      fragments: [...fragments, fragment],
      components: [
        ...components,
        {
          id,
          fragment: fragment.id,
          inputs: bindings,
          outputs: { track: id + ".track" },
          range: element.range,
        },
      ],
      exports: [id + ".track"],
    };
  };
}
export const qflowPackage = {
  format: "qflow.node-package@1",
  modules: [{ manifest }],
  components: [component],
  hostFacets: [
    createStudioTrackCompanionHostFacet(sceneCompanions(module, tags)),
    ...Object.keys(tags).map((tag) =>
      createMarkupSurfaceHostFacet({
        module,
        declaration: {
          name: tags[tag].name,
          tag,
          mode: "structured",
          outputs: [
            options,
            events,
            compositionTypes.visualTrack,
            temporalTypes.window,
            temporalTypes.instant,
            temporalTypes.windowSpec,
            temporalTypes.instantSpec,
          ],
          vocabulary: {
            summary: "Project launch scene with phrase-driven visual beats.",
            attributes: [
              ...temporalContextAttributeVocabulary,
              ...temporalWindowAttributeVocabulary,
              ...["id", "canvas", "font", ...tags[tag].assets].map((name) => ({
                name,
                kind: "expression",
                required: true,
                summary: name,
              })),
              ...Object.keys(tags[tag].defaults).map((name) => ({
                name,
                kind: "literal",
                required: false,
                summary: name,
              })),
            ],
            children: [
              {
                tag: "Beat",
                cardinality: "many",
                summary: "Named event in the scene, projected from a Moment or authored time.",
                attributes: [
                  {
                    name: "name",
                    kind: "literal",
                    required: true,
                    summary: "Behavioral event name",
                  },
                  ...temporalInstantAttributeVocabulary,
                ],
              },
            ],
            ports: [
              {
                name: "track",
                type: compositionTypes.visualTrack,
                summary: "Visual contribution",
              },
            ],
          },
        },
        handler: decode(tag),
      }),
    ),
  ],
};
export default qflowPackage;
