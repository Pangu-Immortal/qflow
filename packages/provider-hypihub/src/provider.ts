import { requestDeadline } from "@qflow/runtime-kit";
import type { AsyncEndpoint, EndpointCredential, EndpointFulfillment, EndpointInvocationContext, EndpointPollContext, EndpointPricingReader, EndpointStartContext, EndpointOutcome, ImmediateEndpointHandler } from "@qflow/endpoint-kit";
import { defineEndpointPackage, wakeAfter } from "@qflow/endpoint-kit";
import { selectWireModelForRequest } from "@qflow/generation";
import type { GenerationRequest } from "@qflow/generation";
import { canonicalize } from "@qflow/protocol";
import type { BlobRef, CapabilityRef } from "@qflow/protocol";
import { credentialRef } from "@qflow/runtime";
import type { CredentialRef, ResourceStore } from "@qflow/runtime";
import { sealAlignedTranscriptEvidence, speechEvidenceTypes } from "@qflow/speech-evidence";
import {
  assertWhisperXEvidenceWav,
  interpretWhisperXTranscript,
  verifyWhisperXAlignmentRequest,
  whisperXCapabilities,
} from "@qflow/whisperx";
import type { WhisperXTranscriptResponse } from "@qflow/whisperx";
import { hypiHubRouteForCapability, hypiHubRoutes } from "./routes.js";
import type { QflowHubModelOperation } from "./routes.js";
import { QflowHubUploader } from "./upload.js";
import type { RuntimeDoctorDiagnostic } from "@qflow/runtime-kit";
import { createQflowHubAuth, hypiHubCredentialNeedsRefresh } from "./oauth.js";
import type { QflowHubAuth } from "./oauth.js";
import { QflowHubHttpError, QflowHubServiceError, hypiHubJobFailure } from "./errors.js";

export const hypiHubProviderModuleRef = { name: "@qflow/provider-qflowhub", version: "1" } as const;

export type CreateQflowHubProviderOptions = {
  readonly instance?: string;
  readonly pool?: string;
  readonly baseUrl?: string;
  readonly apiKey?: CredentialRef;
  readonly defaultConcurrency?: number;
  readonly actionLimits?: import("@qflow/endpoint-kit").EndpointActionLimits;
  readonly capabilityConcurrency?: Readonly<Record<string, number>>;
  readonly pollIntervalMs?: number;
  readonly requestTimeoutMs?: number;
  readonly oauthRequestTimeoutMs?: number;
  readonly pricingRequestTimeoutMs?: number;
  readonly operationTimeoutMs?: number;
  /** Whole files uploaded concurrently per service and credential in this process. */
  readonly uploadConcurrency?: number;
  readonly uploadPartTimeoutMs?: number;
  readonly uploadPartAttempts?: number;
  readonly downloadAttempts?: number;
  /** QflowHub model used for the Provider-neutral WhisperX alignment capability. */
  readonly transcriptionModel?: string;
  readonly fetch?: typeof globalThis.fetch;
  /** Overrides QflowHub's negotiated upload transport for referenced Resources. */
  readonly publicAssetUrl?: (artifact: BlobRef, artifacts: ResourceStore, fields?: Readonly<Record<string, string | number | boolean>>) => Promise<string>;
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
function credential(credentials: Readonly<Record<string, EndpointCredential>>) {
  const value = credentials.apiKey?.secret;
  assert(typeof value === "string" && value.length > 0, "QflowHub apiKey credential is unavailable; configure this Endpoint's credential with a QflowHub API key or OAuth login");
  return credentials.apiKey!;
}
function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function failure(error: unknown): EndpointOutcome {
  const message = failureMessage(error);
  return { status: "failed", failure: { code: error instanceof QflowHubServiceError ? error.code : "QFLOWHUB_ERROR", message } };
}

function jobId(value: Record<string, unknown>): string {
  const id = value.id ?? value.job_id;
  assert(typeof id === "string" && id.length > 0, "QflowHub response has no job id");
  return id;
}

async function verifyModelRoute(client: QflowHubClient, auth: QflowHubAuth, model: string, operation: QflowHubModelOperation): Promise<void> {
  const card = await client.json(`/models/${encodeURIComponent(model)}`, auth);
  const endpoints = card.endpoints;
  assert(Array.isArray(endpoints) && endpoints.every((value) => typeof value === "string"),
    `QflowHub model ${model} returned no valid operation list; support for ${operation} is unknown`);
  assert(endpoints.includes(operation),
    `QflowHub model ${model} does not list operation ${operation}; listed operations: ${endpoints.join(", ") || "none"}`);
}

class QflowHubClient {
  readonly baseUrl: string;
  readonly timeout: number;
  readonly oauthTimeout: number;
  readonly downloadAttempts: number;
  readonly fetcher: typeof globalThis.fetch;
  readonly uploader: QflowHubUploader;
  constructor(options: {
    readonly baseUrl: string;
    readonly timeout: number;
    readonly oauthTimeout: number;
    readonly uploadConcurrency: number;
    readonly uploadPartTimeout: number;
    readonly uploadPartAttempts: number;
    readonly downloadAttempts: number;
    readonly fetcher: typeof globalThis.fetch;
  }) {
    this.baseUrl = options.baseUrl.replace(/\/$/u, "");
    this.timeout = options.timeout;
    this.oauthTimeout = options.oauthTimeout;
    this.downloadAttempts = options.downloadAttempts;
    this.fetcher = options.fetcher;
    this.uploader = new QflowHubUploader({
      baseUrl: this.baseUrl,
      requestTimeoutMs: this.timeout,
      uploadConcurrency: options.uploadConcurrency,
      uploadPartTimeoutMs: options.uploadPartTimeout,
      uploadPartAttempts: options.uploadPartAttempts,
      fetch: this.fetcher,
    });
  }
  async json(path: string, auth: QflowHubAuth, init: RequestInit = {}, refreshOnUnauthorized = true,
    onResponse?: (response: Response) => Promise<void>): Promise<Record<string, unknown>> {
    const token = await auth.token();
    const deadline = requestDeadline(this.timeout);
    try {
      const response = await deadline.wait(this.fetcher(`${this.baseUrl}${path}`, { ...init, signal: deadline.signal, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } }));
      if (response.status !== 401 && onResponse !== undefined) await deadline.wait(onResponse(response));
      const text = await deadline.wait(response.text()); let body: unknown = {};
      if (response.status === 401 && refreshOnUnauthorized && auth.canRefresh()) {
        deadline.finish();
        await auth.refresh();
        return await this.json(path, auth, init, false, onResponse);
      }
      if (!response.ok) {
        const input = typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
        throw new QflowHubHttpError(response.status, response, text, {
          method: init.method ?? "GET", url: `${this.baseUrl}${path}`,
          ...(typeof input?.model === "string" ? { model: input.model } : {}),
        });
      }
      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new Error(`QflowHub returned invalid JSON (${response.status})`); }
      return object(body, "QflowHub response");
    } finally { deadline.finish(); }
  }
  async download(url: string): Promise<{ readonly bytes: Uint8Array; readonly mediaType: string }> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.downloadAttempts; attempt += 1) {
      const deadline = requestDeadline(this.timeout);
      try {
        const response = await deadline.wait(this.fetcher(url, { signal: deadline.signal }));
        if (!response.ok) throw new Error(`QflowHub asset returned HTTP ${response.status}`);
        return { bytes: new Uint8Array(await deadline.wait(response.arrayBuffer())), mediaType: response.headers.get("content-type")?.split(";", 1)[0] ?? "application/octet-stream" };
      } catch (error) {
        lastError = error;
      } finally {
        deadline.finish();
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  async upload(artifact: BlobRef, resources: ResourceStore, auth: QflowHubAuth, fields?: Readonly<Record<string, string | number | boolean>>): Promise<string> {
    const bytes = await resources.get(artifact.resource);
    assert(bytes !== undefined, `QflowHub reference artifact ${artifact.resource} is unavailable`);
    assert(bytes.byteLength === artifact.size, `QflowHub reference artifact ${artifact.resource} size differs`);
    const personReference = fields?.personReference;
    assert(personReference === undefined || typeof personReference === "boolean", "QflowHub personReference must be a boolean");
    return await this.uploader.upload({ bytes, mediaType: artifact.mediaType,
      ...(personReference === undefined ? {} : { isPersonReference: personReference }) }, auth);
  }

  async transcribe(body: Record<string, unknown>, auth: QflowHubAuth,
    report?: (message: string) => Promise<void>): Promise<Record<string, unknown>> {
    return await this.json("/audio/transcriptions", auth, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }, true, async (response) => {
      const requestId = response.headers.get("x-request-id");
      if (requestId === null || !/^[A-Za-z0-9_-]{1,200}$/u.test(requestId)) return;
      let retrieval = "";
      const location = response.headers.get("location");
      if (location !== null) {
        try {
          const url = new URL(location, this.baseUrl);
          const expected = new URL(`${this.baseUrl}/audio/transcriptions/${encodeURIComponent(requestId)}`);
          if (url.href === expected.href) retrieval = `; result lookup: ${url.href}`;
        } catch { /* A malformed Location does not erase the request identifier. */ }
      }
      await report?.(`QflowHub transcription request ${requestId} (HTTP ${response.status})${retrieval}`);
    });
  }
  async speech(auth: QflowHubAuth, body: Record<string, unknown>, refreshOnUnauthorized = true): Promise<readonly { readonly bytes: Uint8Array; readonly mediaType: string }[]> {
    const token = await auth.token();
    const deadline = requestDeadline(this.timeout);
    try {
      const response = await deadline.wait(this.fetcher(`${this.baseUrl}/audio/speech`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ ...body, output: "b64_json" }),
        signal: deadline.signal,
      }));
      const bytes = new Uint8Array(await deadline.wait(response.arrayBuffer()));
      if (response.status === 401 && refreshOnUnauthorized && auth.canRefresh()) {
        deadline.finish();
        await auth.refresh();
        return await this.speech(auth, body, false);
      }
      if (!response.ok) {
        throw new QflowHubHttpError(response.status, response, Buffer.from(bytes).toString("utf8"), {
          method: "POST", url: `${this.baseUrl}/audio/speech`,
          ...(typeof body.model === "string" ? { model: body.model } : {}),
        });
      }
      const responseType = response.headers.get("content-type")?.split(";", 1)[0] ?? "audio/mpeg";
      if (!responseType.includes("json")) return [{ bytes, mediaType: responseType }];

      let decoded: unknown;
      try {
        decoded = JSON.parse(Buffer.from(bytes).toString("utf8"));
      } catch {
        throw new Error("QflowHub returned invalid audio JSON");
      }
      const root = object(decoded, "QflowHub audio response");
      const values = Array.isArray(root.previews) ? root.previews : [root];
      assert(values.length > 0, "QflowHub audio response contains no audio");
      return await Promise.all(values.map(async (value, index) => {
        const item = object(value, `QflowHub audio response ${index + 1}`);
        const mediaType = typeof item.mime_type === "string" && item.mime_type.startsWith("audio/")
          ? item.mime_type : "audio/mpeg";
        if (typeof item.b64_json === "string" && item.b64_json.length > 0) {
          assert(item.b64_json.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/u.test(item.b64_json),
            `QflowHub audio response ${index + 1} contains malformed Base64`);
          const audio = Uint8Array.from(Buffer.from(item.b64_json, "base64"));
          assert(audio.byteLength > 0, `QflowHub audio response ${index + 1} is empty`);
          return { bytes: audio, mediaType };
        }
        assert(typeof item.url === "string" && /^https?:\/\//u.test(item.url),
          `QflowHub audio response ${index + 1} contains neither audio bytes nor a URL`);
        return await this.download(item.url);
      }));
    } finally {
      deadline.finish();
    }
  }
}

function authFor(context: EndpointInvocationContext, client: QflowHubClient): QflowHubAuth {
  return createQflowHubAuth({
    credential: credential(context.credentials),
    baseUrl: client.baseUrl,
    requestTimeoutMs: client.oauthTimeout,
    fetch: client.fetcher,
  });
}

function pricingAuth(credentials: Readonly<Record<string, EndpointCredential>>, client: QflowHubClient): QflowHubAuth {
  return createQflowHubAuth({
    credential: credential(credentials),
    baseUrl: client.baseUrl,
    requestTimeoutMs: client.oauthTimeout,
    fetch: client.fetcher,
  });
}

function pricingModel(request: import("@qflow/endpoint-kit").EndpointRequest, transcriptionModel: string): string | undefined {
  if (capabilityKey(request.capability) === capabilityKey(whisperXCapabilities.alignment)) {
    return transcriptionModel;
  }
  const route = hypiHubRouteForCapability(request.capability);
  if (route === undefined) return undefined;
  const generation = request.constraints as unknown as GenerationRequest;
  return selectWireModelForRequest(
    route,
    generation,
    request.pendingInputs?.map((input) => input.input),
  );
}

/** Read QflowHub's own current model-pricing document without calculating a request total. */
function hypiHubPricingReader(client: QflowHubClient, transcriptionModel: string): EndpointPricingReader {
  const documents = new Map<string, Promise<Record<string, unknown>>>();
  return async ({ request, credentials }) => {
    const model = pricingModel(request, transcriptionModel);
    if (model === undefined) return [];
    const path = `/pricing?model=${encodeURIComponent(model)}`;
    let pending = documents.get(model);
    if (pending === undefined) {
      pending = credentials().then(async (resolved) => await client.json(path, pricingAuth(resolved, client)));
      documents.set(model, pending);
    }
    const response = await pending;
    return [{
      source: `${client.baseUrl}${path}`,
      data: canonicalize(response),
    }];
  };
}

function cardEndpoints(card: Record<string, unknown> | undefined): readonly string[] {
  return Array.isArray(card?.endpoints)
    ? card.endpoints.filter((item): item is string => typeof item === "string")
    : [];
}

/** The catalogue's own names for a card: its id and its canonical name. */
function cardIdentifiers(card: Record<string, unknown>): readonly string[] {
  return [card.id, card.canonical_name].filter((name): name is string => typeof name === "string");
}

/** Additional names explicitly published by the service for this card. */
function cardAliases(card: Record<string, unknown>): readonly string[] {
  return Array.isArray(card.aliases)
    ? card.aliases.filter((name): name is string => typeof name === "string")
    : [];
}

/** Active, read-only QflowHub check used only by doctor. */
export async function diagnoseQflowHubProvider(
  options: CreateQflowHubProviderOptions,
  context: {
    readonly credentials: Readonly<Record<string, { readonly secret: string }>>;
    readonly capabilities?: readonly CapabilityRef[];
  },
): Promise<readonly RuntimeDoctorDiagnostic[]> {
  const apiKey = context.credentials.apiKey?.secret;
  assert(typeof apiKey === "string" && apiKey.length > 0, "QflowHub credential is unavailable");
  if (hypiHubCredentialNeedsRefresh(apiKey)) return [{
    severity: "warning",
    code: "QFLOWHUB_OAUTH_REFRESH_UNCHECKED",
    message: "The stored QflowHub access token needs refresh. Read-only doctor has not checked account access or refresh validity. Authorized execution can refresh through a writable Credential Store; reconnect if that refresh is rejected.",
  }];
  const client = new QflowHubClient({
    baseUrl: apiBaseUrl(options.baseUrl ?? "https://qflow.ai/v1"),
    timeout: options.requestTimeoutMs ?? 30_000,
    oauthTimeout: options.oauthRequestTimeoutMs ?? 30_000,
    uploadConcurrency: options.uploadConcurrency ?? 8,
    uploadPartTimeout: options.uploadPartTimeoutMs ?? 5 * 60_000,
    uploadPartAttempts: options.uploadPartAttempts ?? 3,
    downloadAttempts: options.downloadAttempts ?? 3,
    fetcher: options.fetch ?? globalThis.fetch,
  });
  const auth = createQflowHubAuth({
    credential: { secret: apiKey },
    baseUrl: client.baseUrl,
    requestTimeoutMs: client.oauthTimeout,
    fetch: client.fetcher,
  });
  const response = await client.json("/models", auth);
  assert(Array.isArray(response.data), "QflowHub model catalogue has no data array");
  const catalogue: Record<string, unknown>[] = [];
  for (const value of response.data) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
    catalogue.push(value as Record<string, unknown>);
  }
  const cards = new Map<string, Record<string, unknown>>();
  for (const card of catalogue) for (const name of cardIdentifiers(card)) cards.set(name, card);
  for (const card of catalogue) for (const alias of cardAliases(card)) {
    if (!cards.has(alias)) cards.set(alias, card);
  }
  const transcriptionModel = options.transcriptionModel?.trim() || "victor-upmeet/whisperx";
  const diagnostics: RuntimeDoctorDiagnostic[] = [];
  for (const capability of context.capabilities ?? []) {
    let available = false;
    if (capabilityKey(capability) === capabilityKey(whisperXCapabilities.alignment)) {
      available = cardEndpoints(cards.get(transcriptionModel)).includes("transcriptions");
    } else {
      const route = hypiHubRouteForCapability(capability);
      if (route !== undefined) {
        const acceptable = route.media === "image" ? ["images", "image_edits"]
          : route.media === "video" ? ["videos"] : ["audio_speech"];
        available = route.routes.some(({ model }) => cardEndpoints(cards.get(model))
          .some((endpoint) => acceptable.includes(endpoint)));
      }
    }
    if (!available) diagnostics.push({
      severity: "error",
      code: "QFLOWHUB_CAPABILITY_UNAVAILABLE",
      message: `The QflowHub catalogue returned for this credential does not list a route for ${capabilityKey(capability)}`,
      subject: capabilityKey(capability),
    });
  }
  return diagnostics;
}

async function complete(client: QflowHubClient, auth: QflowHubAuth, route: (typeof hypiHubRoutes)[number], id: string, artifacts: ResourceStore): Promise<EndpointOutcome> {
  const response = await client.json(`/jobs/${encodeURIComponent(id)}/assets`, auth); const items = response.items;
  assert(Array.isArray(items) && items.length > 0, "QflowHub job has no assets"); const blobs: BlobRef[] = [];
  for (const item of items) { const asset = object(item, "QflowHub asset"); assert(typeof asset.url === "string", "QflowHub asset has no URL"); const downloaded = await client.download(asset.url); blobs.push(await artifacts.put(downloaded.bytes, downloaded.mediaType)); }
  return { status: "completed", result: { value: route.packageResult(blobs) } };
}

async function prepareGeneration(client: QflowHubClient, context: EndpointInvocationContext, publicAssetUrl: CreateQflowHubProviderOptions["publicAssetUrl"]) {
  const route = hypiHubRouteForCapability(context.need.capability);
  assert(route !== undefined, "QflowHub does not implement this exact capability");
  const request = route.prepare(context.need.constraints);
  const auth = authFor(context, client);
  await context.reportProgress?.({ phase: `Reading QflowHub model catalogue: ${request.model} (${request.operation})` });
  try {
    await verifyModelRoute(client, auth, request.model, request.operation);
  } catch (error) {
    throw new QflowHubServiceError(error instanceof QflowHubServiceError ? error.code : "QFLOWHUB_ERROR",
      `QflowHub model catalogue check failed; model=${request.model}; operation=${request.operation}; references uploaded=0; generation not submitted: ${failureMessage(error)}`);
  }
  await context.reportProgress?.({ phase: `Preparing QflowHub request: ${request.model} (${request.operation})` });
  const uploaded = new Map<string, Promise<string>>();
  const resolve = (artifact: BlobRef, fields?: Readonly<Record<string, string | number | boolean>>): Promise<string> => {
    const key = JSON.stringify([artifact.resource, canonicalize(fields ?? {})]);
    const existing = uploaded.get(key);
    if (existing !== undefined) return existing;
    const promise = publicAssetUrl === undefined
      ? client.upload(artifact, context.resources, auth, fields)
      : publicAssetUrl(artifact, context.resources, fields);
    uploaded.set(key, promise);
    return promise;
  };
  let compiled;
  try {
    compiled = await request.compile(resolve);
  } catch (error) {
    throw new QflowHubServiceError(error instanceof QflowHubServiceError ? error.code : "QFLOWHUB_ERROR",
      `QflowHub request preparation failed; model=${request.model}; operation=${request.operation}; generation not submitted: ${failureMessage(error)}`);
  }
  return { route, auth, compiled, operation: request.operation };
}

async function synthesizeAudio(client: QflowHubClient, context: EndpointInvocationContext, publicAssetUrl: CreateQflowHubProviderOptions["publicAssetUrl"]): Promise<EndpointFulfillment> {
  const { route, auth, compiled, operation } = await prepareGeneration(client, context, publicAssetUrl);
  assert(route.media === "audio", "QflowHub audio capabilities use an immediate endpoint");
  await context.reportProgress?.({ phase: `Submitting QflowHub request: ${compiled.model} (${operation})` });
  const audio = await client.speech(auth, { model: compiled.model, ...(compiled.input as Record<string, unknown>) });
  const artifacts = await Promise.all(audio.map(async (item) => await context.resources.put(item.bytes, item.mediaType)));
  return { value: route.packageResult(artifacts) };
}

function endpoint(client: QflowHubClient, pollIntervalMs: number, maxOperationMs: number, publicAssetUrl: CreateQflowHubProviderOptions["publicAssetUrl"]): AsyncEndpoint {
  return {
    async start(context: EndpointStartContext) {
      try {
        const { route, auth, compiled, operation } = await prepareGeneration(client, context, publicAssetUrl);
        assert(route.media !== "audio", "QflowHub audio capabilities use an immediate endpoint");
        const input = compiled.input as Record<string, unknown>;
        const path = operation === "image_edits" ? "/images/edits"
          : operation === "images" ? "/images/generations" : "/videos";
        await context.reportProgress?.({ phase: `Submitting QflowHub request: ${compiled.model} (${operation})` });
        const response = await client.json(path, auth, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": context.operation }, body: JSON.stringify({ model: compiled.model, ...input }) });
        const status = response.status;
        const remoteEnded = status === "succeeded" || status === "completed";
        const handle: Handle = { contract: "qflow.qflowhub-operation@1", jobId: jobId(response), route: capabilityKey(route.capability), startedAt: Date.now() };
        const receipt = { id: handle.jobId };
        await context.checkpoint?.({ handle: canonicalize(handle), receipt, ...(remoteEnded ? { remoteEnded: true as const } : {}) });
        const rejected = hypiHubJobFailure(response, handle.jobId);
        if (rejected !== undefined) return { ...failure(rejected), receipt };
        return remoteEnded ? { status: "ready", handle: canonicalize(handle), receipt }
          : { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "submitted" }), receipt };
      } catch (error) {
        return failure(error);
      }
    },
    async poll(context: EndpointPollContext) {
      try {
        const handle = object(context.handle, "QflowHub handle") as unknown as Handle; const route = hypiHubRouteForCapability(context.need.capability);
        assert(route !== undefined && handle.contract === "qflow.qflowhub-operation@1" && handle.route === capabilityKey(route.capability), "QflowHub handle is invalid");
        if (Date.now() - handle.startedAt > maxOperationMs) {
          return { status: "failed",
            receipt: { id: handle.jobId },
            failure: { code: "QFLOWHUB_OPERATION_TIMEOUT", message: `QflowHub job ${handle.jobId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
        }
        const job = await client.json(`/jobs/${encodeURIComponent(handle.jobId)}`, authFor(context, client)); const status = job.status;
        if (status === "queued" || status === "running" || status === "in_progress") return wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: String(status) });
        const rejected = hypiHubJobFailure(job, handle.jobId);
        if (rejected !== undefined) return { ...failure(rejected), receipt: { id: handle.jobId } };
        if (status !== "succeeded" && status !== "completed") throw new Error(`QflowHub returned unknown job status ${String(status)}`);
        return { status: "ready", handle: context.handle, receipt: { id: handle.jobId } };
      } catch (error) {
        return failure(error);
      }
    },
    async collect(context) {
      try {
        const handle = object(context.handle, "QflowHub handle") as unknown as Handle;
        const route = hypiHubRouteForCapability(context.need.capability);
        assert(route !== undefined && handle.route === capabilityKey(route.capability), "QflowHub collection route differs");
        return await complete(client, authFor(context, client), route, handle.jobId, context.resources);
      } catch (error) { return failure(error); }
    },

  };
}

export function createQflowHubProvider(options: CreateQflowHubProviderOptions = {}) {
  const capacityNames = new Set([...hypiHubRoutes.map((route) => route.capability.name), "transcription"]);
  const capabilityConcurrency = options.capabilityConcurrency ?? {};
  for (const [name, limit] of Object.entries(capabilityConcurrency)) {
    assert(capacityNames.has(name), `unknown QflowHub capacity ${name}`);
    assert(Number.isSafeInteger(limit) && limit > 0, `QflowHub ${name} capacity must be a positive integer`);
  }
  const requestTimeoutMs = options.requestTimeoutMs ?? 300_000;
  const oauthRequestTimeoutMs = options.oauthRequestTimeoutMs ?? 30_000;
  const pricingRequestTimeoutMs = options.pricingRequestTimeoutMs ?? 30_000;
  const operationTimeoutMs = options.operationTimeoutMs ?? 20 * 60_000;
  const uploadPartTimeoutMs = options.uploadPartTimeoutMs ?? 5 * 60_000;
  const uploadPartAttempts = options.uploadPartAttempts ?? 3;
  const downloadAttempts = options.downloadAttempts ?? 3;
  for (const [name, value] of Object.entries({
    requestTimeoutMs,
    oauthRequestTimeoutMs,
    pricingRequestTimeoutMs,
    operationTimeoutMs,
    uploadPartTimeoutMs,
    uploadPartAttempts,
    downloadAttempts,
  })) {
    assert(Number.isSafeInteger(value) && value > 0, `QflowHub ${name} must be a positive integer`);
  }
  assert(uploadPartAttempts <= 8, "QflowHub uploadPartAttempts must be within 1..8");
  const client = new QflowHubClient({
    baseUrl: apiBaseUrl(options.baseUrl ?? "https://qflow.ai/v1"),
    timeout: requestTimeoutMs,
    oauthTimeout: oauthRequestTimeoutMs,
    uploadConcurrency: options.uploadConcurrency ?? 8,
    uploadPartTimeout: uploadPartTimeoutMs,
    uploadPartAttempts,
    downloadAttempts,
    fetcher: options.fetch ?? globalThis.fetch,
  });
  const pricingClient = new QflowHubClient({
    baseUrl: apiBaseUrl(options.baseUrl ?? "https://qflow.ai/v1"),
    timeout: pricingRequestTimeoutMs,
    oauthTimeout: oauthRequestTimeoutMs,
    uploadConcurrency: options.uploadConcurrency ?? 8,
    uploadPartTimeout: uploadPartTimeoutMs,
    uploadPartAttempts,
    downloadAttempts,
    fetcher: options.fetch ?? globalThis.fetch,
  });
  const asyncEndpoint = endpoint(client, options.pollIntervalMs ?? 10_000, operationTimeoutMs, options.publicAssetUrl);
  const audioEndpoint: ImmediateEndpointHandler = async (context) =>
    await synthesizeAudio(client, context, options.publicAssetUrl);
  const transcriptionModel = options.transcriptionModel?.trim() || "victor-upmeet/whisperx";
  const whisperXEndpoint: ImmediateEndpointHandler = async (context) => {
    try {
      const request = verifyWhisperXAlignmentRequest(context.need.constraints);
      const bytes = await context.resources.get(request.audio.resource);
      assert(bytes !== undefined && bytes.byteLength === request.audio.size,
        `WhisperX evidence Resource ${request.audio.resource} is unavailable or has changed`);
      assertWhisperXEvidenceWav(bytes, request.sampleFrames);
      const auth = authFor(context, client);
      await verifyModelRoute(client, auth, transcriptionModel, "transcriptions");
      await context.reportProgress?.({ phase: "Preparing audio for hosted transcription" });
      const url = options.publicAssetUrl === undefined
        ? await client.upload(request.audio, context.resources, auth)
        : await options.publicAssetUrl(request.audio, context.resources);
      await context.reportProgress?.({ phase: "Transcribing and aligning words" });
      const response = await client.transcribe({
        model: transcriptionModel,
        url,
        response_format: "verbose_json",
        language: request.language,
        timestamp_granularities: ["segment", "word"],
      }, auth, async (message) => { await context.reportDiagnostic?.({ level: "info", message }); });
      const evidence = sealAlignedTranscriptEvidence({
        passages: interpretWhisperXTranscript(response as WhisperXTranscriptResponse, request.sampleFrames),
      });
      await context.reportProgress?.({ phase: "Word timing ready" });
      return { value: { kind: "inline", value: canonicalize(evidence) } };
    } catch (error) {
      throw new Error(failureMessage(error), { cause: error });
    }
  };
  const oauthOrigin = new URL(options.baseUrl ?? "https://qflow.ai").origin;
  return defineEndpointPackage({
    module: hypiHubProviderModuleRef, facet: "gateway", instance: options.instance ?? "qflowhub.default", pool: options.pool ?? options.instance ?? "qflowhub.default",
    pricing: { kind: "page", url: "https://qflow.ai/commercial/pricing/" },
    readPricing: hypiHubPricingReader(pricingClient, transcriptionModel),
    credentials: { apiKey: options.apiKey ?? credentialRef("os", "qflowhub.oauth") },
    credentialInputs: { apiKey: {
      label: "QflowHub credential",
      acquisition: {
        kind: "oauth2-pkce",
        authorizationEndpoint: new URL("/oauth/consent", oauthOrigin).toString(),
        tokenEndpoint: new URL("/oauth/token", oauthOrigin).toString(),
        clientId: "hyc_d5d5e8e7131b0c877756e66c",
        scopes: ["user:profile", "user:inference"],
        requestTimeoutMs: oauthRequestTimeoutMs,
      },
    } },
    defaultConcurrency: options.defaultConcurrency ?? 4,
    ...(options.actionLimits === undefined ? {} : { actionLimits: options.actionLimits }),
    capabilities: [
      ...hypiHubRoutes
      .map((route) => route.media === "audio"
        ? { capability: route.capability, returns: route.returns, lifecycle: "immediate" as const, handler: audioEndpoint, capacity: route.capability.name, ...(route.supports === undefined ? {} : { supports: route.supports }), ...(capabilityConcurrency[route.capability.name] === undefined ? {} : { maxConcurrency: capabilityConcurrency[route.capability.name]! }) }
        : { capability: route.capability, returns: route.returns, lifecycle: "asynchronous" as const, endpoint: asyncEndpoint, capacity: route.capability.name, ...(route.supports === undefined ? {} : { supports: route.supports }), ...(capabilityConcurrency[route.capability.name] === undefined ? {} : { maxConcurrency: capabilityConcurrency[route.capability.name]! }) }),
      {
        capability: whisperXCapabilities.alignment,
        returns: speechEvidenceTypes.alignedTranscript,
        lifecycle: "immediate" as const,
        handler: whisperXEndpoint,
        capacity: "transcription",
        ...(capabilityConcurrency.transcription === undefined ? {} : { maxConcurrency: capabilityConcurrency.transcription }),
      },
    ],
  });
}
