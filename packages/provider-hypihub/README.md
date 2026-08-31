# `@qflow/provider-qflowhub`

Thin Qflow Runtime Provider for a QflowHub `/v1` deployment.

It maps the currently shipped image/video model capabilities to QflowHub, submits jobs, polls them,
downloads the first-class assets and persists them in Qflow's configured ArtifactStore. The first
version intentionally supports prompt-only generation plus preset MiMo TTS; reference-media inputs
are rejected until a shared Artifact URL bridge is needed.

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
