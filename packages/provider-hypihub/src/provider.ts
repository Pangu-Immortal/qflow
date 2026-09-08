import type { AsyncEndpoint, EndpointFulfillment, EndpointInvocationContext, EndpointPollContext, EndpointStartContext, EndpointOutcome, ImmediateEndpointHandler } from "@qflow/endpoint-kit";
import { defineEndpointPackage, wakeAfter } from "@qflow/endpoint-kit";
import { geminiCapabilities, geminiModels, verifyGeminiRequest } from "@qflow/gemini";
import type { GeminiRequest } from "@qflow/gemini";
import { canonicalize } from "@qflow/protocol";
import type { BlobRef, CapabilityRef } from "@qflow/protocol";
import { credentialRef } from "@qflow/runtime";
import type { CredentialRef, ArtifactStore } from "@qflow/runtime";
import { speechEvidenceTypes } from "@qflow/speech-evidence";
import { whisperXCapabilities } from "@qflow/whisperx";
import { sealText } from "@qflow/text";
import { textTypes } from "@qflow/text";
import { createQflowHubGeminiGenerator } from "./gemini.js";
import { hypiHubRouteForCapability, hypiHubRoutes } from "./routes.js";
import { QflowHubUploader } from "./upload.js";
import { transcribeWithQflowHub, whisperXAlignmentRequest } from "./whisperx.js";
import { createQflowHubPricingClient } from "./pricing.js";
import { createQflowHubAuth } from "./oauth.js";
import type { QflowHubAuth } from "./oauth.js";

export const hypiHubProviderModuleRef = { name: "@qflow/provider-qflowhub", version: "1" } as const;

export type CreateQflowHubProviderOptions = {
  readonly instance?: string;
  readonly pool?: string;
  readonly baseUrl?: string;
  readonly apiKey?: CredentialRef;
  readonly defaultConcurrency?: number;
  readonly pollIntervalMs?: number;
  readonly requestTimeoutMs?: number;
  /** Whole file upload concurrency per origin/credential. Defaults to 8; range 1..64. */
  readonly uploadConcurrency?: number;
  /** Timeout for one S3 multipart PUT. Defaults to five minutes. */
  readonly uploadPartTimeoutMs?: number;
  /** Attempts per S3 part; only a failed part is retried. Defaults to three. */
  readonly uploadPartAttempts?: number;
  /** Expose QflowHub VoiceDesign. Defaults to enabled; set false only for an explicit alternate Provider. */
  readonly audio?: boolean;
  /** QflowHub transcription model used for the WhisperX alignment capability. */
  readonly whisperxModel?: string;
  readonly fetch?: typeof globalThis.fetch;
  /** Overrides the default POST /v1/files upload for referenced artifacts. */
  readonly publicAssetUrl?: (artifact: BlobRef, artifacts: ArtifactStore) => Promise<string>;
};

type Handle = { readonly contract: "qflow.qflowhub-operation@1"; readonly jobId: string; readonly route: string; readonly startedAt: number };

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function object(value: unknown, subject: string): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${subject} must be an object`);
  return value as Record<string, unknown>;
}
function capabilityKey(capability: CapabilityRef): string { return `${capability.module.name}@${capability.module.version}#${capability.name}`; }
function apiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/u, "");
  assert(trimmed.length > 0, "QflowHub base URL is empty");
  const origin = trimmed.replace(/\/(?:v1beta|v1)$/iu, "");
  return `${origin}/v1`;
}
function credential(context: EndpointInvocationContext): string {
  const value = context.credentials.apiKey?.secret;
  assert(typeof value === "string" && value.length > 0, "QflowHub login is unavailable; run qflow auth login for QflowHub");
  return value;
}
function guidedMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /API key is unavailable|QflowHub login is unavailable|HTTP 401\b|invalid_token/iu.test(message)
    ? `${message}. Sign in to QflowHub at https://qflow.ai with qflow auth login`
    : message;
}
function failure(error: unknown): EndpointOutcome {
  const message = guidedMessage(error);
  return { status: "failed", failure: { code: "QFLOWHUB_ERROR", message } };
}

function inlineGeminiRequest(context: EndpointInvocationContext): GeminiRequest {
  const request = context.need.constraints as unknown;
  verifyGeminiRequest(request);
  return request;
}
function jobId(value: Record<string, unknown>): string {
  const id = value.id ?? value.job_id;
  assert(typeof id === "string" && id.length > 0, "QflowHub response has no job id");
  return id;
}

async function verifyModelRoute(client: QflowHubClient, auth: QflowHubAuth, model: string, operation: "images" | "image_edits" | "videos" | "audio_speech" | "transcriptions"): Promise<void> {
  const card = await client.json(`/models/${encodeURIComponent(model)}`, auth);
  const endpoints = card.endpoints;
  assert(Array.isArray(endpoints) && endpoints.includes(operation),
    `QflowHub model ${model} is not enabled for ${operation} with this API key`);
}

function dataUrl(bytes: Uint8Array, mediaType: string): string {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function resolveArtifactInline(artifacts: ArtifactStore, artifact: BlobRef): Promise<string> {
  const bytes = await artifacts.get(artifact.digest);
  assert(bytes !== undefined, `QflowHub reference artifact ${artifact.digest} is unavailable`);
  return dataUrl(bytes, artifact.mediaType);
}

class QflowHubClient {
  readonly baseUrl: string;
  readonly timeout: number;
  readonly fetcher: typeof globalThis.fetch;
  readonly uploader: QflowHubUploader;
  constructor(options: { readonly baseUrl: string; readonly timeout: number; readonly uploadPartTimeout: number; readonly uploadPartAttempts: number; readonly uploadConcurrency: number; readonly fetcher: typeof globalThis.fetch }) {
    this.baseUrl = options.baseUrl.replace(/\/$/u, ""); this.timeout = options.timeout;
    this.fetcher = options.fetcher;
    this.uploader = new QflowHubUploader({
      baseUrl: this.baseUrl,
      requestTimeoutMs: this.timeout,
      uploadPartTimeoutMs: options.uploadPartTimeout,
      uploadPartAttempts: options.uploadPartAttempts,
      uploadConcurrency: options.uploadConcurrency,
      fetch: this.fetcher,
    });
  }
  async json(path: string, auth: QflowHubAuth, init: RequestInit = {}, retryAuth = true): Promise<Record<string, unknown>> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, signal: controller.signal, headers: { authorization: `Bearer ${await auth.token()}`, ...(init.headers ?? {}) } });
      if (response.status === 401 && retryAuth && auth.canRefresh()) {
        await auth.refresh();
        return await this.json(path, auth, init, false);
      }
      const text = await response.text(); let body: unknown = {};
      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new Error(`QflowHub returned invalid JSON (${response.status})`); }
      if (!response.ok) throw new Error(`QflowHub returned HTTP ${response.status}: ${text.slice(0, 300)}`);
      return object(body, "QflowHub response");
    } finally { clearTimeout(timer); }
  }
  async download(url: string): Promise<{ readonly bytes: Uint8Array; readonly mediaType: string }> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.fetcher(url);
        if (!response.ok) throw new Error(`QflowHub asset returned HTTP ${response.status}`);
        return { bytes: new Uint8Array(await response.arrayBuffer()), mediaType: response.headers.get("content-type")?.split(";", 1)[0] ?? "application/octet-stream" };
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  async upload(artifact: BlobRef, artifacts: ArtifactStore, auth: QflowHubAuth): Promise<string> {
    const bytes = await artifacts.get(artifact.digest);
    assert(bytes !== undefined, `QflowHub reference artifact ${artifact.digest} is unavailable`);
    assert(bytes.byteLength === artifact.size, `QflowHub reference artifact ${artifact.digest} size differs`);
    return this.uploader.upload({
      bytes,
      mediaType: artifact.mediaType,
      purpose: "reference",
      sha256: artifact.digest,
    }, auth);
  }
  async transcribe(body: Record<string, unknown>, auth: QflowHubAuth): Promise<Record<string, unknown>> {
    return this.json("/audio/transcriptions", auth, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  async binary(path: string, auth: QflowHubAuth, body: Record<string, unknown>, retryAuth = true): Promise<{ readonly bytes: Uint8Array; readonly mediaType: string }> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, { method: "POST", headers: { authorization: `Bearer ${await auth.token()}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (response.status === 401 && retryAuth && auth.canRefresh()) {
      await auth.refresh();
      return await this.binary(path, auth, body, false);
    }
    if (!response.ok) throw new Error(`QflowHub returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return { bytes: new Uint8Array(await response.arrayBuffer()), mediaType: response.headers.get("content-type")?.split(";", 1)[0] ?? "audio/wav" };
  }
}

function authFor(context: EndpointInvocationContext, client: QflowHubClient, apiKey: CredentialRef): QflowHubAuth {
  return createQflowHubAuth({
    secret: credential(context),
    baseUrl: client.baseUrl,
    fetch: client.fetcher,
    ...(context.credentialStore === undefined ? {} : { credentialStore: context.credentialStore }),
    credentialRef: apiKey,
  });
}

async function complete(client: QflowHubClient, auth: QflowHubAuth, route: (typeof hypiHubRoutes)[number], id: string, artifacts: ArtifactStore): Promise<EndpointOutcome> {
  const response = await client.json(`/jobs/${encodeURIComponent(id)}/assets`, auth); const items = response.items;
  assert(Array.isArray(items) && items.length > 0, "QflowHub job has no assets"); const blobs: BlobRef[] = [];
  for (const item of items) { const asset = object(item, "QflowHub asset"); assert(typeof asset.url === "string", "QflowHub asset has no URL"); const downloaded = await client.download(asset.url); blobs.push(await artifacts.put(downloaded.bytes, downloaded.mediaType)); }
  return { status: "completed", result: { value: route.packageResult(blobs) } };
}

async function synthesizeAudio(client: QflowHubClient, context: EndpointInvocationContext, apiKey: CredentialRef, publicAssetUrl: CreateQflowHubProviderOptions["publicAssetUrl"]): Promise<EndpointFulfillment> {
  const route = hypiHubRouteForCapability(context.need.capability);
  assert(route !== undefined && route.media === "audio", "QflowHub does not implement this exact capability");
  const auth = authFor(context, client, apiKey);
  const compiled = await route.compile(context.need.constraints, async (artifact) => publicAssetUrl === undefined
    ? await resolveArtifactInline(context.artifacts, artifact)
    : await publicAssetUrl(artifact, context.artifacts));
  await verifyModelRoute(client, auth, compiled.model, "audio_speech");
  const audio = await client.binary("/audio/speech", auth, { model: compiled.model, ...(compiled.input as Record<string, unknown>) });
  const artifact = await context.artifacts.put(audio.bytes, audio.mediaType);
  return { value: route.packageResult([artifact]) };
}

function endpoint(client: QflowHubClient, apiKey: CredentialRef, pollIntervalMs: number, maxOperationMs: number, publicAssetUrl: CreateQflowHubProviderOptions["publicAssetUrl"]): AsyncEndpoint {
  return {
    async start(context: EndpointStartContext) {
      try {
        const route = hypiHubRouteForCapability(context.need.capability);
        assert(route !== undefined, "QflowHub does not implement this exact capability"); const auth = authFor(context, client, apiKey);
        const uploaded = new Map<string, Promise<string>>();
        const resolve = (artifact: BlobRef): Promise<string> => {
          const existing = uploaded.get(artifact.digest);
          if (existing !== undefined) return existing;
          const promise = publicAssetUrl === undefined
            ? client.upload(artifact, context.artifacts, auth)
            : publicAssetUrl(artifact, context.artifacts);
          uploaded.set(artifact.digest, promise);
          return promise;
        };
        const compiled = await route.compile(context.need.constraints, resolve);
        assert(route.media !== "audio", "QflowHub audio capabilities use an immediate endpoint");
        const input = compiled.input as Record<string, unknown>;
        const hasReferences = Object.entries(input).some(([key, value]) => {
          if (!["images", "reference_images", "reference_image_urls", "reference_videos", "reference_audios", "first_frame", "last_frame"].includes(key)) return false;
          return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.length > 0;
        });
        const path = route.media === "image"
          ? (hasReferences ? "/images/edits" : "/images/generations")
          : "/videos";
        await verifyModelRoute(client, auth, compiled.model,
          path === "/images/edits" ? "image_edits" : path === "/images/generations" ? "images" : "videos");
        const response = await client.json(path, auth, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": context.operation }, body: JSON.stringify({ model: compiled.model, ...input }) });
        const status = response.status; if (status === "succeeded" || status === "completed") return await complete(client, auth, route, jobId(response), context.artifacts);
        const handle: Handle = { contract: "qflow.qflowhub-operation@1", jobId: jobId(response), route: capabilityKey(route.capability), startedAt: Date.now() };
        return wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "submitted" });
      } catch (error) { return failure(error); }
    },
    async poll(context: EndpointPollContext) {
      try {
        const handle = object(context.handle, "QflowHub handle") as unknown as Handle; const route = hypiHubRouteForCapability(context.need.capability);
        assert(route !== undefined && handle.contract === "qflow.qflowhub-operation@1" && handle.route === capabilityKey(route.capability), "QflowHub handle is invalid");
        if (Date.now() - handle.startedAt > maxOperationMs) throw new Error("QflowHub operation timed out");
        const auth = authFor(context, client, apiKey);
        const job = await client.json(`/jobs/${encodeURIComponent(handle.jobId)}`, auth); const status = job.status;
        if (status === "queued" || status === "running" || status === "in_progress") return wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: String(status) });
        if (status === "failed" || status === "queue_expired") {
          const detail = [job.error, job.message, job.reason, job.detail]
            .find((value) => typeof value === "string" && value.length > 0);
          throw new Error(`QflowHub job ${status}${typeof detail === "string" ? `: ${detail}` : ""}`);
        }
        if (status !== "succeeded" && status !== "completed") throw new Error(`QflowHub returned unknown job status ${String(status)}`);
        return await complete(client, auth, route, handle.jobId, context.artifacts);
      } catch (error) { return failure(error); }
    },
  };
}

export function createQflowHubProvider(options: CreateQflowHubProviderOptions = {}) {
  const uploadPartAttempts = options.uploadPartAttempts ?? 3;
  assert(Number.isInteger(uploadPartAttempts) && uploadPartAttempts >= 1 && uploadPartAttempts <= 8,
    "QflowHub uploadPartAttempts must be within 1..8");
  const uploadPartTimeout = options.uploadPartTimeoutMs ?? 5 * 60_000;
  assert(Number.isSafeInteger(uploadPartTimeout) && uploadPartTimeout > 0,
    "QflowHub uploadPartTimeoutMs must be a positive integer");
  const client = new QflowHubClient({
    baseUrl: apiBaseUrl(options.baseUrl ?? "https://qflow.ai/v1"), timeout: options.requestTimeoutMs ?? 300_000,
    uploadPartTimeout, uploadPartAttempts, uploadConcurrency: options.uploadConcurrency ?? 8,
    fetcher: options.fetch ?? globalThis.fetch,
  });
  const apiKey = options.apiKey ?? credentialRef("os", "qflowhub.oauth");
  const asyncEndpoint = endpoint(client, apiKey, options.pollIntervalMs ?? 10_000, 20 * 60_000, options.publicAssetUrl);
  const audioEndpoint: ImmediateEndpointHandler = async (context) => {
    try {
      return await synthesizeAudio(client, context, apiKey, options.publicAssetUrl);
    } catch (error) {
      throw new Error(guidedMessage(error), { cause: error });
    }
  };
  const geminiEndpoint: ImmediateEndpointHandler = async (context) => {
    const request = inlineGeminiRequest(context);
    const auth = authFor(context, client, apiKey);
    const generate = createQflowHubGeminiGenerator({
      apiKey: await auth.token(),
      auth,
      model: context.need.capability.name,
      ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
      ...(options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs }),
      ...(options.uploadConcurrency === undefined ? {} : { uploadConcurrency: options.uploadConcurrency }),
      ...(options.uploadPartTimeoutMs === undefined ? {} : { uploadPartTimeoutMs: options.uploadPartTimeoutMs }),
      ...(options.uploadPartAttempts === undefined ? {} : { uploadPartAttempts: options.uploadPartAttempts }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      maxRateLimitRetries: 5,
      rateLimitRetryDelayMs: 3_000,
    });
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: request.prompt }];
    for (const item of request.media) {
      const bytes = await context.artifacts.get(item.artifact.digest);
      assert(bytes !== undefined, `QflowHub Gemini reference artifact ${item.artifact.digest} is unavailable`);
      parts.push({ inlineData: { mimeType: item.artifact.mediaType, data: Buffer.from(bytes).toString("base64") } });
    }
    const value = await generate({ parts, instruction: request.instruction });
    return { value: { kind: "inline", value: canonicalize(sealText(value)) } };
  };
  const whisperxEndpoint: ImmediateEndpointHandler = async (context) => {
    try {
      const request = whisperXAlignmentRequest(context.need.constraints);
      const auth = authFor(context, client, apiKey);
      const model = options.whisperxModel ?? "victor-upmeet/whisperx";
      await verifyModelRoute(client, auth, model, "transcriptions");
      const evidence = await transcribeWithQflowHub(
        client,
        request,
        context.artifacts,
        auth,
        model,
      );
      return { value: { kind: "inline", value: canonicalize(evidence) } };
    } catch (error) {
      throw new Error(guidedMessage(error), { cause: error });
    }
  };
  const endpointPackage = defineEndpointPackage({
    module: hypiHubProviderModuleRef, facet: "gateway", instance: options.instance ?? "qflowhub.default", pool: options.pool ?? options.instance ?? "qflowhub.default",
    credentials: { apiKey }, credentialInputs: { apiKey: { label: "QflowHub login" } }, defaultConcurrency: options.defaultConcurrency ?? 3,
    capabilities: [
      ...hypiHubRoutes
      .filter((route) => options.audio !== false || route.media !== "audio")
      .map((route) => route.media === "audio"
        ? { capability: route.capability, returns: route.returns, lifecycle: "immediate" as const, handler: audioEndpoint, lane: route.capability.name }
        : { capability: route.capability, returns: route.returns, lifecycle: "asynchronous" as const, endpoint: asyncEndpoint, lane: route.capability.name }),
      ...geminiModels.map((model) => ({
        capability: geminiCapabilities[model],
        returns: textTypes.text,
        lifecycle: "immediate" as const,
        handler: geminiEndpoint,
        lane: "gemini",
      })),
      {
        capability: whisperXCapabilities.alignment,
        returns: speechEvidenceTypes.alignedTranscript,
        lifecycle: "immediate" as const,
        handler: whisperxEndpoint,
        lane: "whisperx",
      },
    ],
  });
  return Object.assign(endpointPackage, createQflowHubPricingClient({
    client,
    apiKey,
    auth: (secret, credentials) => createQflowHubAuth({
      secret,
      baseUrl: client.baseUrl,
      fetch: client.fetcher,
      credentialStore: credentials,
      credentialRef: apiKey,
    }),
  }));
}
