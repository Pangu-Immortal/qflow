import assert from "node:assert/strict";
import test from "node:test";
import { EndpointRegistry, MemoryResourceStore } from "@qflow/driver-node";
import { sealGptImage2Request } from "@qflow/gpt-image";
import type { BlobRef, EndpointStartContext } from "@qflow/qflow/endpoint-kit";
import { canonicalize } from "@qflow/qflow/endpoint-kit";
import { generationTypes } from "@qflow/qflow/generation";
import { capability, createImageProvider } from "../src/provider.js";

test("project Provider maps a reference, retains its receipt and collects through the public resource port", async () => {
  const resources = new MemoryResourceStore();
  const source = await resources.put(new Uint8Array([1, 2, 3]), "image/png");
  const calls: string[] = [];
  let checkpoint: unknown;
  const provider = createImageProvider({
    instance: "images.personal", pool: "images.personal", baseUrl: "https://images.example",
    apiKey: { store: "os", key: "images.personal" }, pollIntervalMs: 0,
    fetch: async (input, init) => {
      const url = new URL(String(input)); calls.push(url.pathname);
      if (url.hostname === "assets.example") {
        assert.equal(init?.headers, undefined);
        return new Response(new Uint8Array([4, 5, 6]), { headers: { "content-type": "image/webp" } });
      }
      assert.equal((init?.headers as Record<string, string>).authorization, "Bearer test-key");
      if (url.pathname === "/rates") return Response.json({ description: "$0.05 per 1K image", unit: "image", usd: 0.05 });
      if (url.pathname === "/uploads") {
        assert.deepEqual(new Uint8Array(await (init?.body as Blob).arrayBuffer()), new Uint8Array([1, 2, 3]));
        return Response.json({ url: "https://assets.example/reference.png" });
      }
      if (url.pathname === "/tasks") {
        assert.deepEqual(JSON.parse(String(init?.body)), {
          model: "gpt-image-2", input: { prompt: "A portrait", ratio: "9:16", size: "1K", references: ["https://assets.example/reference.png"] },
        });
        return Response.json({ id: "received-task" });
      }
      if (url.pathname === "/tasks/received-task") {
        assert.deepEqual(checkpoint, { handle: { id: "received-task" }, receipt: { id: "received-task" } });
        return Response.json({ state: "succeeded", url: "https://assets.example/output.webp" });
      }
      throw new Error(`Unexpected path ${url.pathname}`);
    },
  });
  const constraints = canonicalize(sealGptImage2Request({
    prompt: ["A portrait"], aspectRatio: ["9:16"], resolution: ["1K"], images: [{ role: "image", artifact: source }],
  }));
  const need = { id: "need:example", capability, returns: generationTypes.imageSet, constraints, result: "record:example" } as const;
  const registry = new EndpointRegistry(); await provider.install(registry);
  const resolution = registry.resolve(need);
  assert.equal(resolution.status, "resolved");
  assert.equal(resolution.registration.kind, "asynchronous");
  const endpoint = resolution.registration.endpoint;
  const context: EndpointStartContext = {
    need, command: { kind: "fulfill-need", id: "command:example", need }, operation: "operation:example",
    resources, credentials: { apiKey: { secret: "test-key" } },
    checkpoint: async (value) => { checkpoint = value; },
  };
  const pricing = await provider.readPricing!({ request: need, credentials: async () => context.credentials });
  assert.equal(pricing[0]?.summary, "$0.05 per 1K image");
  const start = await endpoint.start(context); assert.equal(start.status, "pending");
  const ready = await endpoint.poll({ ...context, handle: start.handle }); assert.equal(ready.status, "ready");
  const collected = await endpoint.collect!({ ...context, handle: ready.handle }); assert.equal(collected.status, "completed");
  assert.equal(collected.result.value.kind, "inline");
  const images = (collected.result.value.value as unknown as { images: BlobRef[] }).images;
  assert.equal(images[0]?.mediaType, "image/webp");
  assert.deepEqual(await resources.get(images[0]!.resource), new Uint8Array([4, 5, 6]));
  assert.deepEqual(calls, ["/rates", "/uploads", "/tasks", "/tasks/received-task", "/output.webp"]);
  assert.equal(provider.offers[0]!.supports!({ ...need, constraints: canonicalize(sealGptImage2Request({
    prompt: ["A portrait"], aspectRatio: ["9:16"], resolution: ["2K"],
  })) }).status, "unsupported");
});
