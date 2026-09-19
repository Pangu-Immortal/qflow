import assert from "node:assert/strict";
import test from "node:test";
import { sealGenerationRequestDraft } from "@qflow/generation";
import type { GenerationRequest } from "@qflow/generation";
import { plannedExactModelRequest } from "@qflow/model-kit";
import type { ExactModelEndpoint } from "@qflow/model-kit";
import { canonicalize } from "@qflow/protocol";
import type { BlobRef, BuildState, ProducerRef, StoredValue } from "@qflow/protocol";
import { fixtureResource } from "../../../test/fixture-resource.js";
import {
  seedanceComponent, seedanceDefinition, seedanceEndpointsByModel, sealSeedanceRequest,
} from "../src/index.js";

const audio = (mediaType: string): BlobRef => ({
  kind: "blob", resource: fixtureResource("reference-audio"), size: 4, mediaType,
});
const settings = {
  prompt: ["A presenter explains the scene"], resolution: ["720p"], aspectRatio: ["9:16"],
  duration: [5], generateAudio: [true], webSearch: [false],
  referenceImage: [{ role: "image" as const, fields: { personReference: true }, artifact: {
    kind: "blob" as const, resource: fixtureResource("reference-image"), size: 4, mediaType: "image/png",
  } }],
};
const inline = (value: unknown): StoredValue => ({ kind: "inline", value: canonicalize(value) });
const input = (value: StoredValue) => ({ value });
async function produce(producer: ProducerRef, inputs: Record<string, { value: StoredValue }>) {
  const facet = seedanceDefinition.component.producers.find((item) => item.producer.name === producer.name);
  assert.ok(facet);
  return await facet.handler({ inputs } as never);
}

function assembly(endpoint: ExactModelEndpoint, artifact?: BlobRef): BuildState {
  return {
    records: [
      { id: "draft", type: endpoint.draftType, value: inline(sealGenerationRequestDraft(endpoint.ports, settings)) },
      { id: "binding", type: endpoint.mediaBindings.referenceAudio!.type, value: inline({ role: "audio" }) },
      ...(artifact === undefined ? [] : [{ id: "audio", value: artifact }]),
    ],
    needs: [],
    plan: { steps: [
      { id: "upstream", producer: { module: { name: "@test/audio", version: "1" }, name: "generate" }, inputs: {}, outputs: { audio: "audio" }, needs: {} },
      { id: "bind", producer: endpoint.mediaBindings.referenceAudio!.producer, inputs: { draft: "draft", binding: "binding", artifact: "audio" }, outputs: { draft: "bound" }, needs: {} },
      { id: "finalize", producer: endpoint.finalizeProducer, inputs: { draft: "bound" }, outputs: { request: "request" }, needs: {} },
      { id: "generate", producer: endpoint.producer, inputs: { request: "request" }, outputs: {}, needs: { generation: { id: "need" } } },
    ] },
  } as unknown as BuildState;
}

test("Seedance activation and public definition share their component implementation", () => {
  assert.equal(seedanceComponent, seedanceDefinition.component);
});

for (const [model, endpoint] of Object.entries(seedanceEndpointsByModel)) {
  test(`${model}: visual classification survives runtime binding, finalization and generation`, async () => {
    const { referenceImage, ...scalars } = settings;
    for (const port of ["referenceImage", "referenceVideo", "firstFrame", "lastFrame"] as const) {
      const role = port === "referenceVideo" ? "video" : "image";
      const artifact = { ...referenceImage[0]!.artifact, mediaType: role === "video" ? "video/mp4" : "image/png" };
      const initial = { ...scalars, ...(port === "lastFrame" ? { firstFrame: referenceImage } : {}) };
      for (const fields of [undefined, {}, { personReference: "true" }]) {
        const binding = { role, ...(fields === undefined ? {} : { fields }) };
        assert.throws(() => endpoint.sealRequest({ ...initial, [port]: [{ ...binding, artifact }] }), /personReference/);
        await assert.rejects(produce(endpoint.mediaBindings[port]!.producer, {
          draft: input(inline(sealGenerationRequestDraft(endpoint.ports, initial))),
          binding: input(inline(binding)), artifact: input(artifact),
        }), /personReference/);
      }
      for (const flag of [true, false]) {
        const binding = { role, fields: { personReference: flag } };
        const bound = await produce(endpoint.mediaBindings[port]!.producer, {
          draft: input(inline(sealGenerationRequestDraft(endpoint.ports, initial))),
          binding: input(inline(binding)), artifact: input(artifact),
        });
        const finalized = await produce(endpoint.finalizeProducer, { draft: input(bound.outputs.draft!) });
        const generated = await produce(endpoint.producer, { request: input(finalized.outputs.request!) });
        const request = generated.needs.generation as unknown as GenerationRequest;
        assert.deepEqual(request.ports[port], [{ ...binding, artifact }]);
      }
    }
    assert.throws(() => endpoint.sealRequest({ ...settings,
      referenceAudio: [{ role: "audio", artifact: audio("audio/wav"), fields: { personReference: true } }],
    }));
  });

  test(`${model}: M4A is rejected through runtime binding and complete request entry points`, async () => {
    for (const mediaType of ["audio/mp4", "audio/x-m4a"]) {
      const artifact = audio(mediaType);
      const ports = { ...settings, referenceAudio: [{ role: "audio" as const, artifact }] };
      // The generic envelope can represent this media; the exact model owns its restriction.
      const request = sealGenerationRequestDraft(endpoint.ports, ports);
      assert.throws(() => sealSeedanceRequest(endpoint.ports.model as keyof typeof seedanceEndpointsByModel, ports), /m4a/);
      assert.throws(() => endpoint.sealRequest(ports), /m4a/);
      const validator = seedanceComponent.validators.find((item) => item.type.name === endpoint.requestType.name)!;
      await assert.rejects(async () => validator.handler({ value: inline(request) } as never), /m4a/);
      await assert.rejects(produce(endpoint.finalizeProducer, { draft: input(inline(request)) }), /m4a/);
      await assert.rejects(produce(endpoint.producer, { request: input(inline(request)) }), /m4a/);
      await assert.rejects(produce(endpoint.mediaBindings.referenceAudio!.producer, {
        draft: input(inline(sealGenerationRequestDraft(endpoint.ports, settings))),
        binding: input(inline({ role: "audio" })), artifact: input(artifact),
      }), /m4a/);
    }
  });

  test(`${model}: supported audio still binds, finalizes and becomes a generation request`, async () => {
    for (const mediaType of ["audio/wav", "audio/mpeg"]) {
      const artifact = audio(mediaType);
      const bound = await produce(endpoint.mediaBindings.referenceAudio!.producer, {
        draft: input(inline(sealGenerationRequestDraft(endpoint.ports, settings))),
        binding: input(inline({ role: "audio" })), artifact: input(artifact),
      });
      const finalized = await produce(endpoint.finalizeProducer, { draft: input(bound.outputs.draft!) });
      const generated = await produce(endpoint.producer, { request: input(finalized.outputs.request!) });
      assert.deepEqual(generated.needs.generation, endpoint.sealRequest({
        ...settings, referenceAudio: [{ role: "audio", artifact }],
      }));
    }
  });

  test(`${model}: planning preserves future audio and rejects it when the actual unsupported value exists`, () => {
    const pending = plannedExactModelRequest(assembly(endpoint), "generate", "generation", endpoint)!;
    assert.equal(pending.complete, false);
    assert.equal(pending.ports.referenceAudio, undefined);
    assert.deepEqual(pending.pendingMedia, [{
      port: "referenceAudio", role: "audio", record: "audio", sourceStep: "upstream", available: false,
    }]);
    assert.throws(() => plannedExactModelRequest(assembly(endpoint, audio("audio/mp4")), "generate", "generation", endpoint), /m4a/);
    const known = plannedExactModelRequest(assembly(endpoint, audio("audio/wav")), "generate", "generation", endpoint)!;
    assert.deepEqual(known.pendingMedia, []);
    assert.deepEqual(known.ports.referenceAudio, [{ role: "audio", artifact: audio("audio/wav") }]);
  });

  test(`${model}: planning validates directly supplied requests and already formed Needs`, () => {
    for (const mediaType of ["audio/mp4", "audio/wav"]) {
      const request = { ports: { ...settings, referenceAudio: [{ role: "audio", artifact: audio(mediaType) }] } };
      const state = assembly(endpoint);
      const direct = { ...state, records: [...state.records, { id: "request", type: endpoint.requestType, value: inline(request) }] } as BuildState;
      const withNeed = { ...state, needs: [{ id: "need", constraints: request }] } as unknown as BuildState;
      for (const candidate of [direct, withNeed]) {
        const plan = () => plannedExactModelRequest(candidate, "generate", "generation", endpoint);
        if (mediaType === "audio/mp4") assert.throws(plan, /m4a/);
        else assert.deepEqual(plan()!.ports, request.ports);
      }
    }
  });
}
