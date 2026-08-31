# `@qflow/provider-qflowhub`

Thin Qflow Runtime Provider for a QflowHub deployment. It is an optional default gateway for
paid generation and Gemini VLM requests; callers may keep their own Provider and select QflowHub only
when its key is configured.

It maps the currently shipped image/video model capabilities to QflowHub, including image edits and
image-to-video first-frame inputs, submits jobs, polls them, downloads the first-class assets and
persists them in Qflow's configured ArtifactStore. Image references use QflowHub's documented
`reference_images` object shape (`[{ "url": "…" }]`); video references use the public
`reference_image_urls`, `reference_videos`, and `reference_audios` fields (with `ref_video_url`
for one video). First/last-frame images use `first_frame` and `last_frame`. It also
exports a small Gemini-native VLM generator for callers that previously used Vertex.

Runtime Profile example:

```json
{
  "endpoints": {
    "qflowhub.default": {
      "use": "@qflow/provider-qflowhub",
      "pool": "qflowhub.default",
      "config": {
        "baseUrl": "https://qflow.ai",
        "apiKey": { "store": "env", "key": "QFLOWHUB_API_KEY" },
        "defaultConcurrency": 4
      }
    }
  }
}
```

Gemini VLM is also exposed as the provider-neutral `@qflow/gemini` Runtime capability, so an Author
Source can select the exact model while the Runtime chooses QflowHub or Vertex. Existing embedded
callers can still use the exported `createQflowHubGeminiGenerator`. Set `QFLOWHUB_API_KEY` (and optionally `QFLOWHUB_BASE_URL`; either the origin or
an existing `/v1`/`/v1beta` base is accepted) only when choosing QflowHub. The Runtime Provider also
accepts the origin or either versioned base and normalizes it to `/v1`; missing or insufficient user
credentials should be resolved at [qflow.ai](https://qflow.ai). Referenced image, audio and video
Artifacts are uploaded automatically through `POST /v1/files`, then their returned HTTPS capability
URLs are used in image and video requests. Uploads are deduplicated by Artifact digest within one
Runtime operation. Embedded callers may override that transport with `publicAssetUrl`.

QflowHub audio capabilities are disabled by default because a QflowHub key may not include the MiMo
audio models. Set `audio: true` only when that key explicitly has them enabled. The usual setup keeps
official `@qflow/provider-xiaomi-mimo` as the audio endpoint, so one Runtime uses QflowHub for
image/video and official MiMo for audio.
