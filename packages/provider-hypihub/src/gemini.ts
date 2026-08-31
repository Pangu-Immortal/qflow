export type QflowHubGeminiPart =
  | { readonly text: string }
  | { readonly inlineData: { readonly mimeType: string; readonly data: string } };

export type QflowHubGeminiGeneratorOptions = {
  readonly apiKey: string;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly requestTimeoutMs?: number;
  readonly fetch?: typeof globalThis.fetch;
};

export type QflowHubGeminiGenerateInput = {
  readonly parts: readonly QflowHubGeminiPart[];
  readonly instruction: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function partValue(part: QflowHubGeminiPart): Record<string, unknown> {
  if ("text" in part) return { text: part.text };
  if ("inlineData" in part) {
    assert(typeof part.inlineData.mimeType === "string" && typeof part.inlineData.data === "string",
      "QflowHub Gemini inline media part is incomplete");
    return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } };
  }
  throw new Error("QflowHub Gemini only supports text and inline media parts");
}

/** Create a small native-Gemini generator for callers that previously used Vertex. */
export function createQflowHubGeminiGenerator(options: QflowHubGeminiGeneratorOptions) {
  const apiKey = options.apiKey.trim();
  assert(apiKey.length > 0, "QflowHub API key is empty");
  // The native Gemini endpoint lives at /v1beta while the paid image/video
  // client lives at /v1. Accept either commonly configured QflowHub base URL
  // and strip only the version suffix before adding /v1beta below.
  const baseUrl = (options.baseUrl ?? "https://qflow.ai")
    .replace(/\/(?:v1beta|v1)\/?$/iu, "")
    .replace(/\/$/u, "");
  const model = options.model?.trim() || "gemini-3.1-pro-preview";
  const timeout = options.requestTimeoutMs ?? 120_000;
  const fetcher = options.fetch ?? globalThis.fetch;

  return async (input: QflowHubGeminiGenerateInput): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetcher(`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.instruction }] },
          contents: [{ role: "user", parts: input.parts.map(partValue) }],
          generationConfig: { temperature: 1, responseMimeType: "text/plain" },
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        const message = `QflowHub Gemini returned HTTP ${response.status}: ${text.slice(0, 300)}`;
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          throw new Error(`${message}. Get a QflowHub key with this model enabled at https://qflow.ai`);
        }
        throw new Error(message);
      }
      let body: unknown;
      try { body = JSON.parse(text); } catch { throw new Error("QflowHub Gemini returned invalid JSON"); }
      const candidates = (body as { readonly candidates?: readonly { readonly content?: { readonly parts?: readonly { readonly text?: unknown }[] } }[] }).candidates;
      const output = candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => typeof part.text === "string" ? part.text : "")
        .join("").trim() ?? "";
      assert(output.length > 0, "QflowHub Gemini returned an empty response");
      return output;
    } finally {
      clearTimeout(timer);
    }
  };
}
