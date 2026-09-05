import type { Need } from "@qflow/protocol";
import type { CredentialRef, CredentialStore } from "@qflow/runtime";

import { hypiHubRouteForCapability } from "./routes.js";

export type QflowHubQuoteItem = {
  readonly request: string;
  readonly model: string;
  readonly estimatedCredits: number;
  readonly estimatedUsd: number;
};

export type QflowHubBuildQuote = {
  readonly format: "qflow.build-quote@1";
  readonly status: "complete";
  readonly totalCredits: number;
  readonly totalUsd: number;
  readonly items: readonly QflowHubQuoteItem[];
};

type QflowHubPricingTransport = {
  json(path: string, apiKey: string, init?: RequestInit): Promise<Record<string, unknown>>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown, subject: string): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${subject} must be an object`);
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, subject: string): number {
  assert(typeof value === "number" && Number.isFinite(value), `${subject} is invalid`);
  return value;
}

function capabilityKey(need: Need): string {
  return `${need.capability.module.name}@${need.capability.module.version}#${need.capability.name}`;
}

async function quoteNeed(
  transport: QflowHubPricingTransport,
  apiKey: string,
  need: Need,
): Promise<QflowHubQuoteItem> {
  const route = hypiHubRouteForCapability(need.capability);
  assert(route !== undefined, `QflowHub cannot price capability ${capabilityKey(need)}`);
  assert(route.media === "video", `QflowHub pricing does not support ${route.media} capability ${capabilityKey(need)}`);
  const compiled = await route.compile(need.constraints, async () => "pricing-reference");
  const input = object(compiled.input, `${need.id} pricing input`);
  const seconds = input.seconds;
  assert(typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0,
    `QflowHub pricing requires a non-negative duration for ${need.id}`);
  const dimensions: Record<string, unknown> = {};
  if (typeof input.resolution === "string") dimensions.resolution = input.resolution;
  const hasReferenceVideo = typeof input.ref_video_url === "string"
    || (Array.isArray(input.reference_videos) && input.reference_videos.length > 0);
  const response = await transport.json("/pricing/quote", apiKey, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: compiled.model,
      units: { seconds },
      dimensions: {
        ...dimensions,
        ...(hasReferenceVideo ? { flags: ["reference_video"] } : {}),
      },
    }),
  });
  return {
    request: need.id,
    model: compiled.model,
    estimatedCredits: finiteNumber(response.estimated_credits, `${need.id}.estimated_credits`),
    estimatedUsd: finiteNumber(response.estimated_usd, `${need.id}.estimated_usd`),
  };
}

export function createQflowHubPricingClient(options: {
  readonly client: QflowHubPricingTransport;
  readonly apiKey: CredentialRef;
}): {
  quoteMany(needs: readonly Need[], credentials: CredentialStore): Promise<QflowHubBuildQuote>;
} {
  return {
    async quoteMany(needs, credentials) {
      if (needs.length === 0) {
        return {
          format: "qflow.build-quote@1",
          status: "complete",
          totalCredits: 0,
          totalUsd: 0,
          items: [],
        };
      }
      const credential = await credentials.resolve(options.apiKey);
      assert(credential !== undefined && credential.secret.length > 0,
        "QflowHub login is unavailable; run qflow auth login for QflowHub");
      const items = await Promise.all(needs.map((need) => quoteNeed(options.client, credential.secret, need)));
      return {
        format: "qflow.build-quote@1",
        status: "complete",
        totalCredits: items.reduce((total, item) => total + item.estimatedCredits, 0),
        totalUsd: items.reduce((total, item) => total + item.estimatedUsd, 0),
        items,
      };
    },
  };
}
