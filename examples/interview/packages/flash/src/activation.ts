import { assertAttributes, assertEmptyElement, createMarkupSurfaceFacet, textAttribute } from "@qflow/qflow/markup";
import { canonicalize, sameType } from "@qflow/qflow/protocol";
import { sealGraphFragment } from "@qflow/qflow/author";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import type { ProducerPackage } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import type { ModuleManifest } from "@qflow/qflow/protocol";
import type { StructuredSurfaceHandler, SurfaceResolvedReference } from "@qflow/qflow/markup";
import {
  assertVisualTrackIdentity,
  compositionTypes,
  sealVisualTrack,
} from "@qflow/qflow/composition";
import type {
  VisualElement,
  VisualStyleDeclaration,
} from "@qflow/qflow/composition";
import { assertSpatialFrame, spatialTypes } from "@qflow/qflow/spatial";
import type { SpatialFrame } from "@qflow/qflow/spatial";
import {
  assertTemporalWindowFor,
  temporalTypes,
} from "@qflow/qflow/temporal";
import type { TemporalWindow } from "@qflow/qflow/temporal";
import {
  createTemporalWindowConstruction,
  resolveTemporalContext,
  temporalContextAttributeVocabulary,
  temporalWindowAttributeNames,
  temporalWindowAttributeVocabulary,
} from "@qflow/qflow/temporal/markup";
import {
  assertTimelineIdentity,
  timelineTypes,
} from "@qflow/qflow/timeline";
import type { Timeline } from "@qflow/qflow/timeline";

const moduleRef = { name: "@interview/flash", version: "1" } as const;
const optionsType = { module: moduleRef, name: "FlashOptions" } as const;
const renderProducer = { module: moduleRef, name: "render" } as const;

type FlashOptions = {
  readonly id: string;
  readonly color: string;
  readonly intensity: number;
  readonly attackFrames: number;
  readonly holdFrames: number;
  readonly decayFrames: number;
  readonly stackingOrder: number;
};

const manifest: ModuleManifest = {
  format: "qflow.module@1",
  name: moduleRef.name,
  version: moduleRef.version,
  dependencies: [timelineTypes.timeline, temporalTypes.window, spatialTypes.frame, compositionTypes.visualTrack]
    .map((type) => ({ module: type.module })),
  types: [{ name: optionsType.name }],
  capabilities: [],
  producers: [{
    name: renderProducer.name,
    inputs: [
      { name: "timeline", type: timelineTypes.timeline },
      { name: "within", type: spatialTypes.frame },
      { name: "window", type: temporalTypes.window },
      { name: "options", type: optionsType },
    ],
    outputs: [{ name: "visual", type: compositionTypes.visualTrack }],
    needs: [],
  }],
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertOptions(value: FlashOptions): void {
  assert(/^[A-Za-z][A-Za-z0-9_.:#-]{0,191}$/u.test(value.id), "Flash id is invalid.");
  assert(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(value.color), "Flash color must be hexadecimal.");
  assert(Number.isFinite(value.intensity) && value.intensity >= 0 && value.intensity <= 1,
    "Flash intensity must be between 0 and 1.");
  for (const [name, frames] of [
    ["attack", value.attackFrames],
    ["hold", value.holdFrames],
    ["decay", value.decayFrames],
  ] as const) {
    assert(Number.isSafeInteger(frames) && frames >= 0, `Flash ${name} must be a non-negative frame count.`);
  }
  assert(Number.isSafeInteger(value.stackingOrder), "Flash z must be an integer.");
}

function px(value: number): string {
  return `${Number(value.toFixed(6))}px`;
}

function renderFlash(
  timeline: Timeline,
  within: SpatialFrame,
  window: TemporalWindow,
  options: FlashOptions,
) {
  assertTimelineIdentity(timeline);
  assertSpatialFrame(within);
  assertOptions(options);
  assertTemporalWindowFor(window, { subjectId: options.id, timeline });
  const duration = window.span.endFrameExclusive - window.span.startFrame;
  const total = options.attackFrames + options.holdFrames + options.decayFrames;
  assert(total <= duration, "Flash envelope cannot outlive its Window.");

  const style: readonly VisualStyleDeclaration[] = [
    { name: "background-color", value: options.color },
    { name: "height", value: px(within.heightPx) },
    { name: "left", value: px(within.xPx) },
    { name: "overflow", value: "hidden" },
    { name: "position", value: "absolute" },
    { name: "top", value: px(within.yPx) },
    { name: "width", value: px(within.widthPx) },
  ];
  const marks = new Map<number, number>();
  marks.set(0, options.attackFrames === 0 ? options.intensity : 0);
  marks.set(options.attackFrames, options.intensity);
  marks.set(options.attackFrames + options.holdFrames, options.intensity);
  marks.set(total, 0);
  marks.set(duration, 0);
  const element: VisualElement = total === 0 ? {
    id: "root",
    order: 0,
    kind: "box",
    style: [...style, { name: "opacity", value: options.intensity }],
  } : {
    id: "root",
    order: 0,
    kind: "box",
    style,
    animation: {
      keyframes: [...marks]
        .sort(([left], [right]) => left - right)
        .map(([atFrame, opacity]) => ({ atFrame, style: [{ name: "opacity", value: opacity }] })),
    },
  };
  const track = sealVisualTrack({
    id: options.id,
    timelineId: timeline.id,
    visualIr: "qflow.visual-ir@1",
    presents: [{
      id: options.id,
      subjectId: options.id,
      order: 0,
      z: options.stackingOrder,
      span: { ...window.span },
      elements: [element],
    }],
  });
  assertVisualTrackIdentity(track, timeline);
  return track;
}

const component: ProducerPackage & AdmissionPackage = {
  producers: [{
    producer: renderProducer,
    handler: ({ inputs }) => {
      const inline = <T>(name: string): T => {
        const input = inputs[name]?.value;
        if (input?.kind !== "inline") throw new Error(`Flash ${name} must be inline.`);
        return input.value as T;
      };
      return {
        outputs: {
          visual: {
            kind: "inline",
            value: renderFlash(
              inline<Timeline>("timeline"),
              inline<SpatialFrame>("within"),
              inline<TemporalWindow>("window"),
              inline<FlashOptions>("options"),
            ),
          },
        },
        needs: {},
      };
    },
  }],
};

function numberAttribute(element: Parameters<StructuredSurfaceHandler>[0]["element"], name: string): number {
  const value = Number(textAttribute(element, name));
  if (!Number.isFinite(value)) throw new Error(`${element.name}.${name} must be numeric.`);
  return value;
}

function integerAttribute(element: Parameters<StructuredSurfaceHandler>[0]["element"], name: string): number {
  const value = numberAttribute(element, name);
  if (!Number.isSafeInteger(value)) throw new Error(`${element.name}.${name} must be an integer.`);
  return value;
}

const decodeFlash: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, [
    "id", "timeline", "within", "color", "intensity", "attack", "hold", "decay", "z",
    ...temporalWindowAttributeNames,
  ]);
  assertEmptyElement(element);
  const id = textAttribute(element, "id");
  const context = resolveTemporalContext({ element, resolveReference });
  const withinRaw = element.attributes.within;
  if (typeof withinRaw !== "object" || withinRaw.kind !== "reference") {
    throw new Error("Flash.within must be a Frame reference.");
  }
  const within = resolveReference(withinRaw.path);
  if (within === undefined || !sameType(within.type, spatialTypes.frame)) {
    throw new Error("Flash.within has the wrong Type.");
  }
  const window = createTemporalWindowConstruction({
    id: `${id}.window`, subjectId: id, element, ...context, resolveReference,
  });
  const options: FlashOptions = {
    id,
    color: textAttribute(element, "color"),
    intensity: numberAttribute(element, "intensity"),
    attackFrames: integerAttribute(element, "attack"),
    holdFrames: integerAttribute(element, "hold"),
    decayFrames: integerAttribute(element, "decay"),
    stackingOrder: integerAttribute(element, "z"),
  };
  assertOptions(options);
  const optionsId = `${id}.options`;
  const fragment = sealGraphFragment({
    inputs: [
      { name: "timeline", type: timelineTypes.timeline },
      { name: "within", type: spatialTypes.frame },
      { name: "window", type: temporalTypes.window },
      { name: "options", type: optionsType },
    ],
    operations: [{
      id: "render",
      producer: renderProducer,
      inputs: {
        timeline: { kind: "fragment-input", name: "timeline" },
        within: { kind: "fragment-input", name: "within" },
        window: { kind: "fragment-input", name: "window" },
        options: { kind: "fragment-input", name: "options" },
      },
      result: { kind: "output", name: "visual" },
    }],
    exports: [{
      name: "visual",
      type: compositionTypes.visualTrack,
      root: { kind: "fragment-operation", operation: "render" },
    }],
  });
  return {
    records: [
      ...window.records,
      { id: optionsId, type: optionsType, value: { kind: "inline", value: canonicalize(options) }, range: element.range },
    ],
    fragments: [...window.fragments, fragment],
    components: [
      ...window.components,
      {
        id,
        fragment: fragment.id,
        inputs: {
          timeline: context.timeline.ref,
          within: within.ref,
          window: window.ref,
          options: { kind: "record", id: optionsId },
        },
        outputs: { visual: `${id}.visual` },
        range: element.range,
      },
    ],
    exports: [`${id}.visual`],
  };
};

const declaration = {
  name: "flash",
  tag: "Flash",
  mode: "structured" as const,
  outputs: [
    compositionTypes.visualTrack,
    temporalTypes.window,
    temporalTypes.duration,
    temporalTypes.extent,
    temporalTypes.shiftSpec,
    temporalTypes.windowSpec,
    optionsType,
  ],
  vocabulary: {
    summary: "Paints one project-owned color flash over an explicit Window.",
    attributes: [
      { name: "id", kind: "identifier" as const, required: true, summary: "Names the flash." },
      ...temporalContextAttributeVocabulary,
      { name: "within", kind: "reference" as const, required: true, accepts: [spatialTypes.frame], summary: "Sets the painted Frame." },
      ...temporalWindowAttributeVocabulary,
      ...["color", "intensity", "attack", "hold", "decay", "z"].map((name) => ({
        name, kind: "literal" as const, required: true, summary: `Sets ${name}.`,
      })),
    ],
    ports: [{ name: "visual", type: compositionTypes.visualTrack, summary: "The flash as an ordinary VisualTrack." }],
    example: '<flash:Flash id="hit" timeline={speech.timeline} within={vertical.bounds} from={cue} for="8f" z="80" color="#FFFFFF" intensity="0.28" attack="2" hold="1" decay="5"/>',
  },
};

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest }],
  facets: [
    createProducerPackageFacet(component),
    createAdmissionPackageFacet(component),
    createMarkupSurfaceFacet({ module: moduleRef, declaration, handler: decodeFlash }),
  ],
};

export default qflowPackage;
