import { sealTimeline, timelineDependency, timelineTypes, timelineComponent } from "@qflow/timeline";
import { compositionComponent, videoContractManifests } from "../../../test/support/video-domain.js";
import { blobTypes } from "@qflow/blob";
import {
  registerProducerFacets,
} from "@qflow/producer";
import { registerTypeValidatorFacets } from "@qflow/admission";
import { mediaTypes, sealMuxedMedia, sealTimelineVisual, sealTimelineAudio } from "@qflow/media";
import { compositionDependency, compositionTypes, sealComposition } from "@qflow/composition";
import type { Composition } from "@qflow/composition";
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
} from "@qflow/kernel";
import {
  ProducerRegistry,
  Executor,
  EndpointRegistry,
} from "@qflow/executor";
import {
  AuthorFrontendRegistry,
  bindAuthorFragment,
  elaborateGraphFragment,
  resolveCompiledSourceExport,
} from "@qflow/author";
import { compileSourceClosure } from "@qflow/compiler";
import type { ResolvedSource } from "@qflow/source";
import { resolveSelfDescribedTextSource } from "@qflow/source/text";
import {
  compileHtmlProgram,
  htmlProgramComponent,
  htmlProgramManifest,
  htmlProgramProducers,
  htmlProgramCapabilities,
  htmlRasterRequest,
} from "@qflow/html-program";
import {
  decodeHtmlVideoSurface,
  htmlVideoFragment,
  createHtmlVideoFragment,
  htmlVideoManifest,
  htmlVideoMarkupSurfaces,
  htmlVideoModuleRef,
} from "@qflow/html-video";
import {
  compileAudioProgramPlan,
  decodeExtractFrameSurface,
  mediaOperationsComponent,
  mediaOperationsComponents,
  mediaOperationsCapabilities,
  mediaOperationsManifest,
  mediaOperationsMarkupSurfaces,
  mediaOperationsModuleRef,
  mediaOperationsProducers,
} from "@qflow/media-operations";
import {
  admitRecord,
  createRecordAdmitter,
  TypeValidatorRegistry,
} from "@qflow/admission";
import type {
  CanonicalValue,
  ModuleManifest,
  StoredValue,
  TypedRecord,
} from "@qflow/protocol";
import {
  createMarkupAuthorFrontend,
  MarkupSurfaceRegistry,
} from "@qflow/markup";

const space = sealTimeline({ id: "test-space", frameCount: 60, frameRate: { numerator: 30, denominator: 1 },
});
const semantic = timelineFixture(space);
const composition = sealComposition({
  id: "render-test",
  canvas: { width: 1080, height: 1920, clearColor: "#000000" },
  tracks: [],
});

const stored = (value: CanonicalValue): StoredValue => ({ kind: "inline", value });
function inline(record: TypedRecord | undefined): CanonicalValue {
  assert(record, "missing Producer input");
  assert.equal(record.value.kind, "inline");
  return record.value.value;
}

const closure = createResolvedClosure([
  ...videoContractManifests,
  htmlProgramManifest,
  mediaOperationsManifest,
  htmlVideoManifest,
]);
const compositionRecord = await admitRecord(closure, sealRecord({
  id: "composition",
  type: compositionTypes.composition,
  value: stored(composition),
}), validatorRegistry());
const spaceRecord = await admitRecord(closure, sealRecord({
  id: "space",
  type: timelineTypes.timeline,
  value: stored(space),
}), validatorRegistry());
const linked = link(closure, [compositionRecord, spaceRecord]);
const instance = elaborateGraphFragment(linked, htmlVideoFragment, {
  id: "final",
  fragment: htmlVideoFragment.id,
  inputs: {
    composition: { kind: "record", id: compositionRecord.id },
    timeline: { kind: "record", id: spaceRecord.id },
  },
});
const contribution = bindAuthorFragment(instance, { video: "final.video" });
const graph = sealCompiledGraph({ ...contribution });

function build() {
  return start(linked, graph, sealBuildRequest({
    targets: [{ output: "final.video" }],
  }));
}

function producerRegistry(): ProducerRegistry {
  const registry = new ProducerRegistry();
  registerProducerFacets(registry, mediaOperationsComponent.producers);
  registerProducerFacets(registry, htmlProgramComponent.producers);
  registerProducerFacets(registry, timelineComponent.producers);
  return registry;
}

function validatorRegistry(): TypeValidatorRegistry {
  const registry = new TypeValidatorRegistry();
  registerTypeValidatorFacets(registry, compositionComponent.validators);
  for (const component of mediaOperationsComponents) {
    registerTypeValidatorFacets(registry, component.validators);
  }
  return registry;
}

test("HTML renderer rendering is an explicit exact Need after ordinary document compilation", async () => {
  assert.deepEqual(build().plan.steps.map((step) => step.producer.name).sort(), [
    htmlProgramProducers.compile.name,
    htmlProgramProducers.requestVisual.name,
    mediaOperationsProducers.planAudio.name,
    mediaOperationsProducers.renderAudio.name,
    mediaOperationsProducers.mux.name,
    mediaOperationsProducers.projectMuxed.name,
  ].sort());

  const result = await new Executor({ producers: producerRegistry(), validators: validatorRegistry() }).run(build());
  assert.equal(result.status, "paused");
  assert.equal(result.state.needs.length, 2);
  const visual = result.state.needs.find((need) => need.capability.name === htmlProgramCapabilities.rasterizeVisual.name)!;
  assert.equal(visual.returns.name, mediaTypes.timelineVisual.name);
  assert.deepEqual(visual.constraints, htmlRasterRequest(compileHtmlProgram(composition, space)));
  const audio = result.state.needs.find((need) => need.capability.name === "render-timeline-audio")!;
  assert.equal(audio.returns.name, mediaTypes.timelineAudio.name);
  assert.equal(result.blocked.every((item) => item.reason === "missing-endpoint"), true);
});

test("separate visual, audio and mux Endpoints complete one author-visible render", async () => {
  const visualArtifact = {
    kind: "blob" as const,
    resource: fixtureResource("html-video:visual"),
    size: 12_345,
    mediaType: "video/mp4",
  };
  const audioArtifact = {
    kind: "blob" as const,
    resource: fixtureResource("html-video:audio"),
    size: 4_096,
    mediaType: "audio/wav",
  };
  const finalArtifact = {
    kind: "blob" as const,
    resource: fixtureResource("html-video:final-video"),
    size: 16_441,
    mediaType: "video/mp4",
  };
  const endpoints = new EndpointRegistry();
  endpoints.registerImmediateEndpoint(
    "example.html.local",
    htmlProgramCapabilities.rasterizeVisual,
    mediaTypes.timelineVisual,
    ({ need }) => {
      const request = need.constraints as {
        readonly program: ReturnType<typeof compileHtmlProgram>;
      };
      return {
        value: stored(sealTimelineVisual({
          frameRate: request.program.frameRate,
          frameCount: request.program.frameCount,
          canvas: request.program.canvas,
          artifact: visualArtifact,
        })),
      };
    },
  );
  endpoints.registerImmediateEndpoint(
    "example.media.audio-real",
    mediaOperationsCapabilities.renderAudio,
    mediaTypes.timelineAudio,
    ({ need }) => {
      const request = need.constraints as { contract: string; plan: ReturnType<typeof compileAudioProgramPlan> };
      return {
        value: stored(sealTimelineAudio({
          artifact: audioArtifact,
          sampleFrames: request.plan.sampleFrames,
        })),
      };
    },
  );
  endpoints.registerImmediateEndpoint(
    "example.media.mux",
    mediaOperationsCapabilities.mux,
    mediaTypes.muxed,
    ({ need }) => {
      const request = need.constraints as { visual: ReturnType<typeof sealTimelineVisual>; audio: ReturnType<typeof sealTimelineAudio> };
      return {
        value: stored(sealMuxedMedia({
          frameRate: request.visual.frameRate,
          frameCount: request.visual.frameCount,
          canvas: request.visual.canvas,
          presentationSampleFrames: request.audio.sampleFrames,
          artifact: finalArtifact,
        })),
      };
    },
  );
  const result = await new Executor({
    producers: producerRegistry(),
    endpoints,
    validators: validatorRegistry(),
  }).run(build());
  assert.equal(result.status, "complete");
  const video = result.state.records.find((record) =>
    record.type.module.name === blobTypes.blob.module.name
    && record.type.name === blobTypes.blob.name
    && record.value.kind === "blob"
    && record.value.resource === finalArtifact.resource);
  assert(video, "missing final Blob");
  assert.deepEqual(video.value, finalArtifact);
});

test("a render Product with another frame domain is rejected by the explicit downstream join", async () => {
  const document = compileHtmlProgram(composition, space);
  const endpoints = new EndpointRegistry();
  endpoints.registerImmediateEndpoint(
    "example.html.wrong-domain",
    htmlProgramCapabilities.rasterizeVisual,
    mediaTypes.timelineVisual,
    () => ({
      value: stored(sealTimelineVisual({
        frameRate: document.frameRate,
        frameCount: document.frameCount + 1,
        canvas: document.canvas,
        artifact: {
          kind: "blob",
          resource: fixtureResource("html-video:wrong-domain"),
          size: 1,
          mediaType: "video/mp4",
          },
      })),
    }),
  );
  endpoints.registerImmediateEndpoint(
    "example.media.audio-for-domain-check",
    mediaOperationsCapabilities.renderAudio,
    mediaTypes.timelineAudio,
    ({ need }) => {
      const request = need.constraints as { readonly plan: ReturnType<typeof compileAudioProgramPlan> };
      return {
        value: stored(sealTimelineAudio({
          artifact: {
            kind: "blob",
            resource: fixtureResource("html-video:domain-check-audio"),
            size: 1,
            mediaType: "audio/wav",
          },
          sampleFrames: request.plan.sampleFrames,
        })),
      };
    },
  );
  const result = await new Executor({
    producers: producerRegistry(),
    endpoints,
    validators: validatorRegistry(),
  }).run(build());
  assert.equal(result.status, "failed");
  assert.match(result.outcomes.at(-1)?.message ?? "", /different presentation durations/u);
});

const fixtureModule = { name: "example.composition-fixture", version: "1" } as const;
const fixtureSurfaceDigest = fixtureResource("example.composition-fixture/surface@1");
const fixtureSurface = {
  name: "composition", tag: "Composition", mode: "structured",
  outputs: [compositionTypes.composition, timelineTypes.timeline],
} as const;
const fixtureManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: fixtureModule.name,
  version: fixtureModule.version,
  dependencies: [compositionDependency, timelineDependency],
  types: [],
  capabilities: [],
  producers: [],
};

function source(text: string): ResolvedSource {
  return resolveSelfDescribedTextSource({
    id: "/project/main.svml",
    name: "main.svml",
    text: `<?svml using="@qflow/markup@1"?>\n${text}`,
  });
}

for (const selectedRange of [false, true]) {
test(`the ${selectedRange ? "selected" : "full"} rendered video remains an ordinary Blob for downstream components`, async () => {
  const sourceClosure = createResolvedClosure([
    ...videoContractManifests,
    htmlProgramManifest,
    mediaOperationsManifest,
    htmlVideoManifest,
    fixtureManifest,
  ]);
  const surfaces = new MarkupSurfaceRegistry();
  surfaces.registerStructured({ module: fixtureModule, declaration: fixtureSurface, handler: ({ element }) => ({
    records: [
      { id: "composition", type: compositionTypes.composition, value: stored(composition), range: element.range },
      { id: "semantic", type: timelineTypes.timeline, value: stored(semantic), range: element.range },
    ],
    components: [],
    fragments: [],
  }) });
  surfaces.registerStructured({
    module: htmlVideoModuleRef,
    declaration: htmlVideoMarkupSurfaces.find((item) => item.name === "video")!,
    handler: decodeHtmlVideoSurface,
  });
  surfaces.registerStructured({
    module: mediaOperationsModuleRef,
    declaration: mediaOperationsMarkupSurfaces.find((item) => item.name === "extract-frame")!,
    handler: decodeExtractFrameSurface,
  });
  const frontends = new AuthorFrontendRegistry();
  frontends.register(createMarkupAuthorFrontend({
    registry: surfaces,
    resolveModule(request) {
      if (request.from.startsWith("@qflow/html-video")) return htmlVideoModuleRef;
      if (request.from.startsWith("@qflow/media-operations")) return mediaOperationsModuleRef;
      return fixtureModule;
    },
  }));
  const compiled = await compileSourceClosure({
    entry: source(`<svml>
      <import as="fixture" from="example.composition-fixture@1"/>
      <import as="html" from="@qflow/html-video@1"/>
      <import as="media" from="@qflow/media-operations@1"/>
      <fixture:Composition/>
      <html:Video id="final" composition={composition} timeline={semantic} ${selectedRange ? 'start-frame="15" end-frame-exclusive="45"' : ""}/>
      <media:ExtractFrame id="poster" source={final.video} video="primary-moving" at="last"/>
    </svml>`),
    closure: sourceClosure,
    frontends,
    resolveSource() {
      throw new Error("the fixture has no source imports");
    },
    admitRecord: createRecordAdmitter(validatorRegistry()),
  });
  const target = resolveCompiledSourceExport(compiled, "poster.image", blobTypes.blob);
  assert.equal(target.ref.kind, "logical-output");
  const state = start(compiled.program, compiled.graph, sealBuildRequest({
    targets: [{ output: target.ref.kind === "logical-output" ? target.ref.id : "" }],
  }));
  assert.deepEqual(state.plan.steps.map((step) => step.producer.name).sort(), [
    htmlProgramProducers.compile.name,
    selectedRange ? htmlProgramProducers.requestVisualRange.name : htmlProgramProducers.requestVisual.name,
    mediaOperationsProducers.planAudio.name,
    selectedRange ? mediaOperationsProducers.renderAudioRange.name : mediaOperationsProducers.renderAudio.name,
    mediaOperationsProducers.mux.name,
    mediaOperationsProducers.projectMuxed.name,
    mediaOperationsProducers.inspect.name,
    mediaOperationsProducers.extractFrame.name,
  ].sort());
});
}


test("selected render frames reach both visual and audio Needs through the ordinary Build graph", async () => {
  const range = { startFrame: 15, endFrameExclusive: 45 };
  const rangeRecord = await admitRecord(closure, sealRecord({ id: "selection", type: mediaTypes.frameRange,
    value: stored(range) }), validatorRegistry());
  const program = link(closure, [compositionRecord, spaceRecord, rangeRecord]);
  const fragment = createHtmlVideoFragment(true);
  const selected = elaborateGraphFragment(program, fragment, {
    id: "selected", fragment: fragment.id, inputs: {
      composition: { kind: "record", id: compositionRecord.id },
      timeline: { kind: "record", id: spaceRecord.id },
      range: { kind: "record", id: rangeRecord.id },
    },
  });
  const selectedGraph = sealCompiledGraph(bindAuthorFragment(selected, { video: "selected.video" }));
  const result = await new Executor({ producers: producerRegistry(), validators: validatorRegistry() }).run(
    start(program, selectedGraph, sealBuildRequest({ targets: [{ output: "selected.video" }] })),
  );
  assert.equal(result.state.needs.length, 2);
  for (const need of result.state.needs) assert.deepEqual((need.constraints as { range: unknown }).range, range);
  assert.throws(() => htmlRasterRequest(compileHtmlProgram(composition, space),
    { range: { startFrame: 0, endFrameExclusive: 61 } }), /frame range/);
});
