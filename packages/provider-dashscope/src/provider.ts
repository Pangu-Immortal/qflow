import type { AsyncEndpoint, EndpointCredential, EndpointInvocationContext, EndpointOutcome } from "@qflow/qflow/endpoint";
import { EndpointServiceError, defineEndpoint, wakeAfter } from "@qflow/qflow/endpoint";
import { EndpointHttpError, EndpointResponseError, EndpointTransportError, withRequestDeadline } from "@qflow/qflow/endpoint/http";
import type { GenerationArtifactUrlResolver } from "@qflow/generation";
import { canonicalize } from "@qflow/qflow/protocol";
import type { BlobRef, CanonicalValue, CapabilityRef } from "@qflow/qflow/protocol";
import { credentialRef } from "@qflow/qflow/endpoint";
import type { CredentialRef, ResourceStore } from "@qflow/qflow/endpoint";
import { dashScopeRouteForCapability, dashScopeRoutes, dashScopeMediaLimits } from "./routes.js";
import type { DashScopeRoute } from "./routes.js";
import { DashScopeHttpError, DashScopeServiceError, dashScopeTaskFailure } from "./errors.js";

export const dashScopeProviderModuleRef = { name: "@qflow/provider-dashscope", version: "1" } as const;

export type CreateDashScopeProviderOptions = {
  readonly instance?: string;
  readonly pool?: string;
  readonly baseUrl?: string;
  /** Defaults to the environment store so the secret itself never enters any file. */
  readonly apiKey?: CredentialRef;
  readonly defaultConcurrency?: number;
  readonly actionLimits?: import("@qflow/qflow/endpoint").EndpointActionLimits;
  readonly pollIntervalMs?: number;
  readonly requestTimeoutMs?: number;
  readonly operationTimeoutMs?: number;
  readonly fetch?: typeof globalThis.fetch;
};

type Handle = {
  readonly contract: "qflow.dashscope-operation@1";
  readonly taskId: string;
  readonly route: string;
  readonly startedAt: number;
  readonly url?: string;
};

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function object(value: unknown, subject: string): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${subject} must be an object`);
  return value as Record<string, unknown>;
}
function capabilityKey(capability: CapabilityRef): string { return `${capability.module.name}@${capability.module.version}#${capability.name}`; }
function apiBaseUrl(value: string): string {
  let trimmed = value.trim();
  while (trimmed.endsWith("/")) trimmed = trimmed.slice(0, -1);
  assert(trimmed.length > 0, "DashScope base URL is empty");
  return trimmed;
}
function apiKey(credentials: Readonly<Record<string, EndpointCredential>>): string {
  const value = credentials.apiKey?.secret;
  if (typeof value !== "string" || value.length === 0) {
    throw new DashScopeServiceError("DASHSCOPE_CREDENTIAL_UNAVAILABLE",
      "DashScope apiKey credential is unavailable; export the environment variable this Endpoint's CredentialRef names");
  }
  return value;
}
function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function failure(error: unknown): EndpointOutcome {
  if (!(error instanceof EndpointServiceError || error instanceof EndpointHttpError
    || error instanceof EndpointTransportError || error instanceof EndpointResponseError)) throw error;
  const code = error instanceof EndpointServiceError || error instanceof EndpointHttpError ? error.code : "DASHSCOPE_ERROR";
  return { status: "failed", failure: { code, message: failureMessage(error) } };
}
function retrying(error: unknown, handle: CanonicalValue, pollIntervalMs: number, deadlineAt?: number): EndpointOutcome | undefined {
  const delay = error instanceof EndpointTransportError ? pollIntervalMs
    : error instanceof EndpointHttpError && (error.status === 429 || error.status >= 500)
      ? error.retryAfterMs ?? pollIntervalMs : undefined;
  if (delay === undefined) return undefined;
  const now = Date.now();
  return { status: "pending", handle, wakeAt: Math.min(now + delay, deadlineAt ?? Number.MAX_SAFE_INTEGER), progress: { phase: "retrying" } };
}
function unknownSubmission(error: unknown): EndpointOutcome | undefined {
  return error instanceof EndpointTransportError ? { status: "failed", failure: {
    code: "DASHSCOPE_SUBMISSION_UNKNOWN",
    message: `DashScope submission transport failed; remote outcome is unknown: ${error.message}`,
  } } : undefined;
}
function httpsUrl(value: unknown, subject: string): string {
  assert(typeof value === "string" && /^https?:\/\//u.test(value), `${subject} has no download URL`);
  return value;
}

const SUBMIT_PATH = "/api/v1/services/aigc/video-generation/video-synthesis";
const taskPath = (id: string) => `/api/v1/tasks/${encodeURIComponent(id)}`;

class DashScopeClient {
  constructor(readonly baseUrl: string, readonly timeout: number, readonly fetcher: typeof globalThis.fetch) {}
  async json(path: string, key: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    return await withRequestDeadline(this.timeout, async ({ signal, wait }) => {
      const response = await wait(this.fetcher(`${this.baseUrl}${path}`, {
        ...init, signal, headers: { authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
      }));
      const text = await response.text();
      if (!response.ok) {
        const input = typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
        throw new DashScopeHttpError(response.status, response, text, {
          method: init.method ?? "GET", path, ...(typeof input?.model === "string" ? { model: input.model } : {}),
        });
      }
      let body: unknown;
      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new EndpointResponseError(`DashScope returned invalid JSON (${response.status})`); }
      return object(body, "DashScope response");
    }, () => new EndpointTransportError("DashScope request timed out", { timeout: true }));
  }
  async download(url: string): Promise<{ readonly bytes: Uint8Array; readonly mediaType: string }> {
    return await withRequestDeadline(this.timeout, async ({ signal, wait }) => {
      const response = await wait(this.fetcher(url, { signal }));
      if (!response.ok) throw new DashScopeHttpError(response.status, response, "", { method: "GET", path: url });
      return { bytes: new Uint8Array(await wait(response.arrayBuffer())), mediaType: response.headers.get("content-type")?.split(";", 1)[0] ?? "video/mp4" };
    });
  }
}

function mediaKind(mediaType: string): "image" | "audio" | undefined {
  return mediaType.startsWith("image/") ? "image" : mediaType.startsWith("audio/") ? "audio" : undefined;
}

/** DashScope takes inline media as data URLs; the resolver caches one upload per Resource. */
function resolverFor(context: EndpointInvocationContext): GenerationArtifactUrlResolver {
  const resolved = new Map<string, Promise<string>>();
  return (artifact) => {
    const existing = resolved.get(artifact.resource);
    if (existing !== undefined) return existing;
    const promise = (async () => {
      const kind = mediaKind(artifact.mediaType);
      const limit = kind === undefined ? undefined : dashScopeMediaLimits[kind];
      assert(limit !== undefined,
        `DashScope video accepts ${artifact.mediaType} references only by public URL`);
      assert(artifact.size <= limit,
        `DashScope video accepts ${kind} references up to ${limit / 1_000_000} MB; ${artifact.resource} is ${artifact.size} bytes`);
      const bytes = await context.resources.get(artifact.resource);
      assert(bytes !== undefined && bytes.byteLength === artifact.size, `Reference Resource ${artifact.resource} is unavailable or has changed`);
      return `data:${artifact.mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
    })();
    resolved.set(artifact.resource, promise);
    return promise;
  };
}

async function prepare(context: EndpointInvocationContext) {
  const route = dashScopeRouteForCapability(context.need.capability);
  assert(route !== undefined, "DashScope does not implement this exact capability");
  const request = route.prepare(context.need.constraints);
  await context.reportProgress?.({ phase: `Preparing DashScope request: ${request.model}` });
  const body = JSON.stringify(await request.compile(resolverFor(context)));
  assert(Buffer.byteLength(body) <= dashScopeMediaLimits.body,
    `DashScope accepts request bodies up to ${dashScopeMediaLimits.body / 1_000_000} MB; inline references make this one ${Buffer.byteLength(body)} bytes`);
  return { route, model: request.model, body };
}

async function store(client: DashScopeClient, urls: readonly string[], resources: ResourceStore): Promise<BlobRef[]> {
  const blobs: BlobRef[] = [];
  for (const url of urls) {
    const downloaded = await client.download(url);
    blobs.push(await resources.put(downloaded.bytes, downloaded.mediaType));
  }
  return blobs;
}

function taskVideoUrl(output: Record<string, unknown>): string {
  const direct = output.video_url;
  if (typeof direct === "string" && direct.length > 0) return httpsUrl(direct, "DashScope task");
  const results = output.results;
  assert(Array.isArray(results) && results.length > 0, "DashScope task succeeded with no video URL");
  return httpsUrl(object(results[0], "DashScope task result").url, "DashScope task");
}

function endpoint(client: DashScopeClient, pollIntervalMs: number, maxOperationMs: number): AsyncEndpoint {
  return {
    async start(context) {
      try {
        const { route, model, body } = await prepare(context);
        await context.reportProgress?.({ phase: `Submitting DashScope request: ${model}` });
        let response: Record<string, unknown>;
        try {
          response = await client.json(SUBMIT_PATH, apiKey(context.credentials), {
            method: "POST",
            headers: { "content-type": "application/json", "X-DashScope-Async": "enable" },
            body,
          });
        } catch (error) {
          const unknown = unknownSubmission(error);
          if (unknown !== undefined) return unknown;
          throw error;
        }
        const output = object(response.output, "DashScope submission output");
        const taskId = output.task_id;
        assert(typeof taskId === "string" && taskId.length > 0, "DashScope submission returned no task_id");
        const handle: Handle = { contract: "qflow.dashscope-operation@1", taskId, route: route.key, startedAt: Date.now() };
        const receipt = { id: taskId };
        await context.checkpoint?.({ handle: canonicalize(handle), receipt });
        return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "submitted" }), receipt };
      } catch (error) {
        return failure(error);
      }
    },
    async poll(context) {
      let operationDeadlineAt: number | undefined;
      try {
        const handle = object(context.handle, "DashScope handle") as unknown as Handle;
        const route = dashScopeRouteForCapability(context.need.capability);
        assert(route !== undefined && handle.contract === "qflow.dashscope-operation@1" && handle.route === route.key, "DashScope handle is invalid");
        const receipt = { id: handle.taskId };
        operationDeadlineAt = handle.startedAt + maxOperationMs;
        if (Date.now() >= operationDeadlineAt) {
          return { status: "failed", receipt, failure: { code: "DASHSCOPE_OPERATION_TIMEOUT", message: `DashScope task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
        }
        const response = await client.json(taskPath(handle.taskId), apiKey(context.credentials));
        const output = object(response.output, "DashScope task output");
        const status = String(output.task_status);
        const receiptWithStatus = { id: handle.taskId, status };
        if (status === "PENDING" || status === "RUNNING") {
          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status.toLowerCase() }), receipt: receiptWithStatus };
        }
        const rejected = dashScopeTaskFailure(output, handle.taskId);
        if (rejected !== undefined) return { ...failure(rejected), receipt: receiptWithStatus };
        if (status !== "SUCCEEDED") throw new EndpointResponseError(`DashScope returned unknown task status ${status}`);
        return { status: "ready", handle: canonicalize({ ...handle, url: taskVideoUrl(output) }), receipt: receiptWithStatus };
      } catch (error) {
        return retrying(error, context.handle, pollIntervalMs, operationDeadlineAt) ?? failure(error);
      }
    },
    async collect(context) {
      try {
        const handle = object(context.handle, "DashScope handle") as unknown as Handle;
        const route = dashScopeRouteForCapability(context.need.capability);
        assert(route !== undefined && handle.route === route.key, "DashScope collection route differs");
        await context.reportProgress?.({ phase: "Receiving generated video" });
        const blobs = await store(client, [httpsUrl(handle.url, "DashScope handle")], context.resources);
        return { status: "completed", result: { value: route.packageResult(blobs) }, receipt: { id: handle.taskId } };
      } catch (error) {
        return retrying(error, context.handle, pollIntervalMs) ?? failure(error);
      }
    },
  };
}

export function createDashScopeProvider(options: CreateDashScopeProviderOptions = {}) {
  const requestTimeoutMs = options.requestTimeoutMs ?? 300_000;
  const operationTimeoutMs = options.operationTimeoutMs ?? 30 * 60_000;
  for (const [name, value] of Object.entries({ requestTimeoutMs, operationTimeoutMs })) {
    assert(Number.isSafeInteger(value) && value > 0, `DashScope ${name} must be a positive integer`);
  }
  const client = new DashScopeClient(apiBaseUrl(options.baseUrl ?? "https://dashscope.aliyuncs.com"), requestTimeoutMs, options.fetch ?? globalThis.fetch);
  const asyncEndpoint = endpoint(client, options.pollIntervalMs ?? 10_000, operationTimeoutMs);
  return defineEndpoint({
    instance: options.instance ?? "dashscope.default", pool: options.pool ?? options.instance ?? "dashscope.default",
    pricing: { kind: "page", url: "https://help.aliyun.com/zh/model-studio/billing-for-model-studio" },
    credentials: { apiKey: options.apiKey ?? credentialRef("env", "DASHSCOPE_VIDEO_API_KEY") },
    credentialInputs: { apiKey: { label: "DashScope API key (environment variable)" } },
    defaultConcurrency: options.defaultConcurrency ?? 2,
    ...(options.actionLimits === undefined ? {} : { actionLimits: options.actionLimits }),
    capabilities: dashScopeRoutes.map((route) => ({
      capability: route.capability, returns: route.returns, lifecycle: "asynchronous" as const,
      endpoint: asyncEndpoint, capacity: route.capability.name, supports: route.supports,
    })),
  });
}
