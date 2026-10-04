import { sealTimeline, timelineTypes } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";
import { compositionComponent, spatialComponent, videoContractManifests } from "../../../test/support/video-domain.js";
import { registerTypeValidatorFacets } from "@qflow/component-kit";
import { compositionTypes, sealAudioTrack, sealVisualTrack } from "@qflow/composition";
import type { Composition, Track } from "@qflow/composition";
import type { FontArtifactRef } from "@qflow/media";
import { sealCanvas, spatialTypes } from "@qflow/spatial";
import assert from "node:assert/strict";
import test from "node:test";
import { fixtureResource } from "../../../test/fixture-resource.js";
import { timelineFixture } from "../../../test/timeline-fixture.js";

import {
  createResolvedClosure,
  link,
  sealBuildRequest,
  sealCompiledGraph,
  sealRecord,
  start,
} from "@qflow/core";
import { ProducerRegistry, NodeDriver } from "@qflow/driver-node";
import {
  bindAuthorFragment,
  elaborateGraphFragment,
  mergeFragmentContributions,
} from "@qflow/elaborator";
import { appendFilmAudioTrack, appendFilmVisualTrack, compileFilmComposition, createFilmAssemblyFragment, createFilmTrackSet, filmManifest, filmProducers, filmTypes, sealFilmProgram } from "@qflow/film";
import { compileHyperframesDocument, hyperframesDocumentFragment, hyperframesManifest, hyperframesProducers, hyperframesTypes } from "@qflow/hyperframes";
import type { CanonicalValue, CompiledGraph, StoredValue, TypedRecord } from "@qflow/protocol";
import { renderFineTextOccurrence, stillTextMotion } from "@qflow/text-fine";
import type { TextStyle } from "@qflow/text-fine";
import { admitRecord, TypeValidatorRegistry } from "@qflow/validation";

const space = sealTimeline({ id: "test-space", frameCount: 120, frameRate: { numerator: 30, denominator: 1 },
});
const semantic = timelineFixture(space);

function validatorRegistry(): TypeValidatorRegistry {
  const registry = new TypeValidatorRegistry();
  registerTypeValidatorFacets(registry, compositionComponent.validators);
  registerTypeValidatorFacets(registry, spatialComponent.validators);
  return registry;
}
const canvas = sealCanvas({
  widthPx: 1080,
  heightPx: 1920,
});
const filmProgram = sealFilmProgram({

  id: "main-film",
  clearColor: "#000000",
});
const titleFont: FontArtifactRef = {
  sources: [{ artifact: {
    kind: "blob", resource: fixtureResource("film-test-title-font"), size: 1, mediaType: "font/woff2",
  } }],
  weight: 800,
  style: "normal",
};
const titleStyle: TextStyle = {

  id: "title-style",
  typography: {
    fonts: [titleFont], sizePx: 56, weight: 800, style: "normal",
    axes: [], features: [], synthesis: "none", kerning: "auto", trackingPx: 0,
    wordSpacingPx: 0, lineHeight: 1.2, direction: "auto", writingMode: "horizontal-tb",
    baselineShiftPx: 0, tabSize: 4, indentationPx: 0, paragraphBeforePx: 0,
    paragraphAfterPx: 0, transform: "none", variantCaps: "normal", verticalAlign: "baseline", decorations: [],
    cjk: { textSpacing: "normal", punctuationTrim: "none" },
  },
  paints: [{ kind: "fill", paint: { kind: "solid", color: "#ffffff" } }],
};
const titleVisual = renderFineTextOccurrence(space, {
    timelineId: space.id,
    id: "title",
    span: { startFrame: 10, endFrameExclusive: 100 },
    placement: {
      kind: "flow", z: 60, frame: { xPx: 86.4, yPx: 192, widthPx: 907.2, heightPx: 384 },
      flow: {
        inlineSize: "fixed", blockSize: "fixed",
        paddingPx: { inlineStart: 0, inlineEnd: 0, blockStart: 0, blockEnd: 0 },
        inlineAlign: "center", blockAlign: "center", wrap: "word", overflow: "visible",
        clipToFrame: false, columns: 1, columnGapPx: 0, metricEdge: "line-box",
      },
    },
    document: { paragraphs: [{ id: "title", inlines: [{ kind: "text", id: "title-text", text: "Semantic Video Markup Language" }] }] },
    style: titleStyle,
    motion: stillTextMotion(),
});
const background = sealVisualTrack({ timelineId: "test-space",
  visualIr: "qflow.visual-ir@1",
  id: "background-track",
  presents: [{
    id: "background",
    order: 0,
    z: 0,
    span: { startFrame: 0, endFrameExclusive: 120 },
    elements: [{ id: "root", kind: "box", order: 0, style: [{ name: "background-color", value: "#223344" }] }],
  }],
});
const audio = sealAudioTrack({ timelineId: "test-space",
  id: "empty-audio-track",
  clips: [],
});

function inline(record: TypedRecord | undefined): CanonicalValue {
  assert(record, "missing Producer input");
  assert.equal(record.value.kind, "inline");
  return record.value.value;
}

function stored(value: CanonicalValue): StoredValue {
  return { kind: "inline", value };
}

const closure = createResolvedClosure([
  ...videoContractManifests,
  hyperframesManifest,
  filmManifest,
]);
const records = await Promise.all([
  sealRecord({ id: "timeline", type: timelineTypes.timeline, value: stored(space) }),
  sealRecord({ id: "semantic", type: timelineTypes.timeline, value: stored(semantic) }),
  sealRecord({ id: "canvas", type: spatialTypes.canvas, value: stored(canvas) }),
  sealRecord({ id: "film-program", type: filmTypes.program, value: stored(filmProgram) }),
  sealRecord({ id: "title", type: compositionTypes.visualTrack, value: stored(titleVisual) }),
  sealRecord({ id: "background", type: compositionTypes.visualTrack, value: stored(background) }),
  sealRecord({ id: "audio", type: compositionTypes.audioTrack, value: stored(audio) }),
].map(async (record) => await admitRecord(closure, record, validatorRegistry())));
const linked = link(closure, records);

const filmFragment = createFilmAssemblyFragment({
  name: "example/main-film",
  tracks: [
    { name: "title", kind: "visual" },
    { name: "background", kind: "visual" },
    { name: "audio", kind: "audio" },
  ],
});
const filmInstance = elaborateGraphFragment(linked, filmFragment, {
  id: "main-film",
  fragment: filmFragment.id,
  inputs: {
    program: { kind: "record", id: "film-program" },
    canvas: { kind: "record", id: "canvas" },
    timeline: { kind: "record", id: "timeline" },
    title: { kind: "record", id: "title" },
    background: { kind: "record", id: "background" },
    audio: { kind: "record", id: "audio" },
  },
});
const filmContribution = bindAuthorFragment(filmInstance, {
  composition: "main.composition",
});
const hyperframesInstance = elaborateGraphFragment(linked, hyperframesDocumentFragment, {
  id: "main-render",
  fragment: hyperframesDocumentFragment.id,
  inputs: {
    composition: { kind: "logical-output", id: "main.composition" },
    timeline: { kind: "record", id: "timeline" },
  },
});
const hyperframesContribution = bindAuthorFragment(hyperframesInstance, {
  document: "main.document",
});
const merged = mergeFragmentContributions(
  { outputs: [], candidates: [], operations: [] },
  filmContribution,
  hyperframesContribution,
);
const graph: CompiledGraph = sealCompiledGraph({ ...merged });

function build(target: string) {
  return start(linked, graph, sealBuildRequest({
    targets: [{ output: target }],
  }));
}

function producerNames(target: string): string[] {
  return build(target).plan.steps.map((step) => step.producer.name);
}

function producerModules(target: string): string[] {
  return build(target).plan.steps.map((step) => step.producer.module.name);
}

test("Film stops at Composition and Hyperframes remains an ordinary downstream Fragment", () => {
  assert.equal(producerModules("main.composition").includes(hyperframesProducers.compile.module.name), false);
  assert.deepEqual(producerNames("main.composition").filter((name) => name.startsWith("append-")).sort(), [
    filmProducers.appendAudioTrack.name,
    filmProducers.appendVisualTrack.name,
    filmProducers.appendVisualTrack.name,
  ].sort());
  assert.equal(
    producerModules("main.document").filter((name) => name === hyperframesProducers.compile.module.name).length,
    1,
  );
});

test("the Driver folds peer Tracks, then independently compiles the Composition", async () => {
  const registry = new ProducerRegistry();
  registry.registerProducer(filmProducers.createTrackSet, () => ({
    outputs: { set: stored(createFilmTrackSet()) },
    needs: {},
  }));
  registry.registerProducer(filmProducers.appendVisualTrack, ({ inputs }) => ({
    outputs: { set: stored(appendFilmVisualTrack(
      inline(inputs.set) as never,
      inline(inputs.timeline) as typeof space,
      inline(inputs.track) as never,
    )) },
    needs: {},
  }));
  registry.registerProducer(filmProducers.appendAudioTrack, ({ inputs }) => ({
    outputs: { set: stored(appendFilmAudioTrack(
      inline(inputs.set) as never,
      inline(inputs.timeline) as typeof space,
      inline(inputs.track) as never,
    )) },
    needs: {},
  }));
  registry.registerProducer(filmProducers.compileComposition, ({ inputs }) => ({
    outputs: { composition: stored(compileFilmComposition(
      inline(inputs.program) as never,
      inline(inputs.canvas) as typeof canvas,
      inline(inputs.timeline) as typeof space,
      inline(inputs.set) as never,
    )) },
    needs: {},
  }));
  registry.registerProducer(hyperframesProducers.compile, ({ inputs }) => ({
    outputs: { document: stored(compileHyperframesDocument(
      inline(inputs.composition) as never,
      inline(inputs.timeline) as typeof space,
    )) },
    needs: {},
  }));

  const result = await new NodeDriver({ producers: registry, validators: validatorRegistry() }).run(build("main.document"));
  assert.equal(result.status, "complete");
  const documentRecord = result.state.records.find((record) => record.type.module.name === hyperframesTypes.document.module.name);
  assert(documentRecord);
  const document = inline(documentRecord) as { readonly html: string };
  assert.match(document.html, /data-qflow-text-run="title-text"/u);
  assert.match(document.html, /background-track/u);
  assert.equal(result.state.records.filter((record) => record.type.name === filmTypes.trackSet.name).length, 4);
});

test("Film rejects duplicate Track ids before Composition", () => {
  const set = appendFilmVisualTrack(createFilmTrackSet(), space, background);
  const duplicate = sealVisualTrack({...background });
  assert.throws(() => appendFilmVisualTrack(set, space, duplicate), /already contains Track id/u);
});
