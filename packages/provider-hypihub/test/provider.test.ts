import assert from "node:assert/strict";
import test from "node:test";

import { EndpointRegistry, MemoryArtifactStore } from "@qflow/driver-node";
import type { AsyncEndpoint } from "@qflow/endpoint-kit";
import { geminiCapabilities, sealGeminiRequest } from "@qflow/gemini";
import type { CanonicalValue, Need } from "@qflow/protocol";
import { mimoTtsEndpoints } from "@qflow/mimo-tts";
import { textTypes } from "@qflow/text";
import { sealSeedanceRequest, seedanceEndpoints } from "@qflow/seedance";

import { createQflowHubProvider } from "../src/provider.js";

function need(constraints: CanonicalValue): Need {
  return {
    id: "need:qflowhub-test",
    capability: seedanceEndpoints.mini!.capability,
    returns: seedanceEndpoints.mini!.returns,
    constraints,
    result: "record:qflowhub-test",
  };
}

async function endpointFor(request: Need, fetch: typeof globalThis.fetch): Promise<AsyncEndpoint> {
  const registry = new EndpointRegistry();
  await createQflowHubProvider({ fetch, pollIntervalMs: 0, requestTimeoutMs: 1_000 }).install(registry);
  const resolution = registry.resolve(request);
  assert.equal(resolution.status, "resolved");
  assert.equal(resolution.registration.kind, "asynchronous");
  return resolution.registration.endpoint;
}

test("QflowHub exposes VoiceDesign by default and permits an explicit alternate audio Provider", async () => {
  const registry = new EndpointRegistry();
  await createQflowHubProvider({ fetch: async () => { throw new Error("audio must not call fetch"); } }).install(registry);
  assert.equal(registry.resolve({
    id: "need:qflowhub-audio-default",
    capability: mimoTtsEndpoints.voiceDesign.capability,
    returns: mimoTtsEndpoints.voiceDesign.returns,
    constraints: { ports: {} },
    result: "record:qflowhub-audio-default",
  }).status, "resolved");

  const optedOut = new EndpointRegistry();
  await createQflowHubProvider({ audio: false, fetch: async () => { throw new Error("not reached"); } }).install(optedOut);
  assert.equal(optedOut.resolve({
    id: "need:qflowhub-audio-opt-in",
    capability: mimoTtsEndpoints.voiceDesign.capability,
    returns: mimoTtsEndpoints.voiceDesign.returns,
    constraints: { ports: {} },
    result: "record:qflowhub-audio-opt-in",
  }).status, "missing");
});

test("QflowHub uploads referenced Artifacts once, submits their HTTPS URLs, and persists the result", async () => {
  const artifacts = new MemoryArtifactStore();
  const reference = await artifacts.put(new Uint8Array([1, 2, 3]), "image/png");
  const request = need(sealSeedanceRequest("seedance-2-mini", {
    prompt: ["A presenter turns toward camera."],
    referenceImage: [
      { role: "image", artifact: reference },
      { role: "image", artifact: reference },
    ],
    resolution: ["720p"], aspectRatio: ["16:9"], duration: [5],
    generateAudio: [false], webSearch: [false],
  }) as unknown as CanonicalValue);
  const calls: string[] = [];
  const fakeFetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/v1/files")) {
      assert.equal(init?.method, "POST");
      assert.equal((init?.headers as Record<string, string>).authorization, "Bearer test-key");
      assert.ok(init?.body instanceof FormData);
      assert.equal(init.body.get("purpose"), "reference");
      const file = init.body.get("file");
      assert.ok(file instanceof File);
      assert.equal(file.type, "image/png");
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array([1, 2, 3]));
      return Response.json({ url: "https://qflow.ai/files/as_reference.png" });
    }
    if (url.endsWith("/v1/models/bytedance%2Fseedance-2-mini")) {
      return Response.json({ endpoints: ["videos"] });
    }
    if (url.endsWith("/v1/videos")) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal(body.model, "bytedance/seedance-2-mini");
      assert.deepEqual(body.reference_image_urls, [
        "https://qflow.ai/files/as_reference.png",
        "https://qflow.ai/files/as_reference.png",
      ]);
      return Response.json({ id: "job_qflowhub_test", status: "queued" });
    }
    if (url.endsWith("/v1/jobs/job_qflowhub_test")) {
      return Response.json({ id: "job_qflowhub_test", status: "succeeded" });
    }
    if (url.endsWith("/v1/jobs/job_qflowhub_test/assets")) {
      return Response.json({ items: [{ url: "https://download.qflow.test/result.mp4" }] });
    }
    if (url === "https://download.qflow.test/result.mp4") {
      return new Response(new Uint8Array([9, 8, 7]), { headers: { "content-type": "video/mp4" } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  const endpoint = await endpointFor(request, fakeFetch);
  const common = {
    command: { kind: "fulfill-need", id: "command:qflowhub-test", need: request } as const,
    need: request, artifacts, credentials: { apiKey: { secret: "test-key" } },
    operation: "operation:qflowhub-test",
  };
  const started = await endpoint.start(common);
  assert.equal(started.status, "pending");
  assert.equal(calls.filter((url) => url.endsWith("/v1/files")).length, 1);
  if (started.status !== "pending") return;
  const completed = await endpoint.poll({ ...common, handle: started.handle });
  assert.equal(completed.status, "completed");
  assert.equal(calls.length, 6);
});

test("QflowHub fulfills Gemini through the Runtime endpoint and uploads every media Artifact", async () => {
  const artifacts = new MemoryArtifactStore();
  const image = await artifacts.put(new Uint8Array([1, 2, 3]), "image/png");
  const video = await artifacts.put(new Uint8Array([4, 5, 6]), "video/mp4");
  const request: Need = {
    id: "need:qflowhub-gemini",
    capability: geminiCapabilities["gemini-3.1-pro"],
    returns: textTypes.text,
    constraints: sealGeminiRequest({
      instruction: "Answer briefly.", prompt: "Inspect both references.",
      media: [{ artifact: image }, { artifact: video }],
    }) as unknown as CanonicalValue,
    result: "record:qflowhub-gemini",
  };
  const uploads: string[] = [];
  let generationBody: Record<string, unknown> | undefined;
  const registry = new EndpointRegistry();
  await createQflowHubProvider({ fetch: async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/files")) {
      assert.ok(init?.body instanceof FormData);
      const file = init.body.get("file");
      assert.ok(file instanceof File);
      uploads.push(file.type);
      return Response.json({ url: `https://qflow.ai/files/${uploads.length}` });
    }
    if (url.includes(":generateContent")) {
      generationBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ candidates: [{ content: { parts: [{ text: "provider works" }] } }] });
    }
    throw new Error(`Unexpected URL ${url}`);
  } }).install(registry);
  const resolution = registry.resolve(request);
  assert.equal(resolution.status, "resolved");
  assert.equal(resolution.registration.kind, "immediate");
  const result = await resolution.registration.handler({
    command: { kind: "fulfill-need", id: "command:qflowhub-gemini", need: request },
    need: request, artifacts, credentials: { apiKey: { secret: "test-key" } },
  });
  assert.deepEqual(result.value, { kind: "inline", value: { value: "provider works" } });
  assert.deepEqual(uploads, ["image/png", "video/mp4"]);
  assert.deepEqual((generationBody?.contents as readonly unknown[]), [{ role: "user", parts: [
    { text: "Inspect both references." },
    { fileData: { mimeType: "image/png", fileUri: "https://qflow.ai/files/1" } },
    { fileData: { mimeType: "video/mp4", fileUri: "https://qflow.ai/files/2" } },
  ] }]);
});
