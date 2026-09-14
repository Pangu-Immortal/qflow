import { canonicalize, defineEndpointPackage, wakeAfter } from "@qflow/qflow/endpoint-kit";
import type { AsyncEndpoint, CredentialRef, EndpointRequest } from "@qflow/qflow/endpoint-kit";
import { compileWireRequest, generationTypes, sealGeneratedImageSet } from "@qflow/qflow/generation";
import type { GenerationRequest, GenerationWireMapping } from "@qflow/qflow/generation";

export const providerModule = { name: "@example/provider-images", version: "1" } as const;
export const capability = { module: { name: "@qflow/gpt-image", version: "1" }, name: "gpt-image-2" } as const;

// This example service implements only this subset of the model. Its API is described in README.
const mapping: GenerationWireMapping = {
  capability, result: "image", routes: [{ model: "gpt-image-2" }],
  fields: {
    prompt: { as: "value", field: "prompt" },
    aspectRatio: { as: "value", field: "ratio" },
    resolution: { as: "value", field: "size" },
    images: { as: "urlArray", field: "references" },
  },
};

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected service object");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("Expected nonempty service text");
  return value;
}
function address(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Service URLs require HTTPS or loopback HTTP");
  }
  return url.href;
}

function support(request: EndpointRequest) {
  const ports = (request.constraints as unknown as GenerationRequest).ports;
  const unsupported = ports.resolution?.[0] !== "1K"
    || !["1:1", "9:16", "16:9"].includes(String(ports.aspectRatio?.[0]))
    || Object.keys(ports).some((port) => !(port in mapping.fields))
    || request.pendingInputs?.some((slot) => !(slot.input in mapping.fields));
  return unsupported
    ? { status: "unsupported" as const, reason: "This service offers 1K at 1:1, 9:16 or 16:9, without background control" }
    : { status: "supported" as const };
}

export function createImageProvider(options: {
  instance: string; pool: string; baseUrl: string; apiKey: CredentialRef;
  concurrency?: number; pollIntervalMs?: number; fetch?: typeof globalThis.fetch;
}) {
  const base = address(options.baseUrl).replace(/\/$/u, "");
  const fetcher = options.fetch ?? globalThis.fetch;
  const interval = options.pollIntervalMs ?? 2_000;
  const key = (credentials: Readonly<Record<string, { secret: string }>>) => text(credentials.apiKey?.secret);
  async function json(path: string, secret: string, init: RequestInit = {}) {
    const response = await fetcher(`${base}${path}`, {
      ...init, headers: { ...init.headers, authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Image service ${path} returned HTTP ${response.status}`);
    return object(await response.json());
  }
  const endpoint: AsyncEndpoint = {
    async start(context) {
      const supported = support(context.need);
      if (supported.status === "unsupported") throw new Error(supported.reason);
      const secret = key(context.credentials);
      const request = await compileWireRequest(mapping, context.need.constraints as unknown as GenerationRequest,
        async (artifact) => {
          const bytes = await context.resources.get(artifact.resource);
          if (bytes === undefined) throw new Error("Reference image is unavailable");
          const upload = await json("/uploads", secret, {
            method: "POST", headers: { "content-type": artifact.mediaType }, body: new Blob([new Uint8Array(bytes)]),
          });
          return address(text(upload.url));
        });
      const task = await json("/tasks", secret, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request),
      });
      const id = text(task.id), handle = { id }, receipt = { id };
      await context.checkpoint?.({ handle, receipt });
      return { ...wakeAfter(handle, interval), receipt };
    },
    async poll(context) {
      const id = text(object(context.handle).id);
      const task = await json(`/tasks/${encodeURIComponent(id)}`, key(context.credentials));
      if (task.state === "queued" || task.state === "running") {
        return wakeAfter({ id }, interval, Date.now(), { phase: task.state });
      }
      if (task.state === "failed") return {
        status: "failed", failure: { code: "IMAGE_SERVICE_FAILED", message: "Image service task failed" },
      };
      if (task.state !== "succeeded") throw new Error("Image service returned an unknown task state");
      return { status: "ready", handle: { id, url: address(text(task.url)) } };
    },
    async collect(context) {
      // The service returns a signed asset URL; account credentials go only to its API.
      const url = address(text(object(context.handle).url));
      const response = await fetcher(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`Image download returned HTTP ${response.status}`);
      const mediaType = response.headers.get("content-type")?.split(";")[0]?.trim();
      if (!mediaType?.startsWith("image/")) throw new Error("Image service returned a non-image result");
      const artifact = await context.resources.put(new Uint8Array(await response.arrayBuffer()), mediaType);
      return { status: "completed", result: { value: {
        kind: "inline", value: canonicalize(sealGeneratedImageSet({ images: [artifact] })),
      } } };
    },
  };
  return defineEndpointPackage({
    module: providerModule, facet: "images", instance: options.instance, pool: options.pool,
    credentials: { apiKey: options.apiKey }, credentialInputs: { apiKey: { label: "Image service API key" } },
    defaultConcurrency: options.concurrency ?? 1,
    actionLimits: { submit: { concurrency: 1 }, poll: { concurrency: 4 }, collect: { concurrency: 1 } },
    pricing: { kind: "page", url: `${base}/pricing` },
    async readPricing(context) {
      const source = `${base}/rates?model=gpt-image-2`;
      const rates = await json("/rates?model=gpt-image-2", key(await context.credentials()));
      return [{ source, data: canonicalize(rates), summary: text(rates.description) }];
    },
    capabilities: [{ capability, returns: generationTypes.imageSet, lifecycle: "asynchronous", supports: support, endpoint }],
  });
}
