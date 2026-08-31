# `@qflow/provider-qflowhub`

Thin Qflow Runtime Provider for a QflowHub `/v1` deployment. It is an optional default gateway for
paid generation and Gemini VLM requests; callers may keep their own Provider and select QflowHub only
when its key is configured.

It maps the currently shipped image/video model capabilities to QflowHub, including image edits and
image/video reference inputs, submits jobs, polls them, downloads the first-class assets and persists
them in Qflow's configured ArtifactStore. References are sent as QflowHub-compatible `data:` URLs, so
the adapter does not require a provider-specific public upload bucket. It also exports a small
Gemini-native VLM generator for callers that previously used Vertex.

Runtime Profile example:

```json
{
  "endpoints": {
    "qflowhub.default": {
      "use": "@qflow/provider-qflowhub",
      "pool": "qflowhub.default",
      "config": {
        "baseUrl": "https://qflow.ai/v1",
        "apiKey": { "store": "env", "key": "QFLOWHUB_API_KEY" },
        "defaultConcurrency": 4
      }
    }
  }
}
```

Gemini VLM callers can use the exported `createQflowHubGeminiGenerator` without changing their
provider-facing code. Set `QFLOWHUB_API_KEY` (and optionally `QFLOWHUB_BASE_URL`) only when choosing
QflowHub; missing or insufficient user credentials should be resolved at [qflow.ai](https://qflow.ai).
