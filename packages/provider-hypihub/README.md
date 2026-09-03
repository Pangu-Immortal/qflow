# `@qflow/provider-qflowhub`

Thin Qflow Runtime Provider for a QflowHub deployment. It is an optional default gateway for
paid generation and Gemini VLM requests; callers may keep their own Provider and select QflowHub only
when its OAuth login is configured.

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
        "apiKey": { "store": "os", "key": "qflowhub.oauth" },
        "defaultConcurrency": 3,
        "pollIntervalMs": 10000
      }
    }
  }
}
```

Gemini VLM is also exposed as the provider-neutral `@qflow/gemini` Runtime capability, so an Author
Source can select the exact model while the Runtime chooses QflowHub or Vertex. Existing embedded
callers can still use the exported `createQflowHubGeminiGenerator`. Run `qflow auth login qflowhub.default --runtime qflow.runtime.json` to sign in with QflowHub OAuth (and optionally set `QFLOWHUB_BASE_URL`; either the origin or
an existing `/v1`/`/v1beta` base is accepted) only when choosing QflowHub. The Runtime Provider also
accepts the origin or either versioned base and normalizes it to `/v1`; missing or insufficient user
credentials should be resolved at [qflow.ai](https://qflow.ai). Referenced image, audio and video
Artifacts are uploaded automatically through `POST /v1/files`, then their returned HTTPS capability
URLs are used in image and video requests. Uploads are deduplicated by Artifact digest within one
Runtime operation. Embedded callers may override that transport with `publicAssetUrl`.

The provider also serves `@qflow/whisperx#whisperx-alignment` through QflowHub's synchronous
`/v1/audio/transcriptions` endpoint using `victor-upmeet/whisperx`. It always requests
`verbose_json` with both segment- and word-level timestamps, then converts QflowHub's OpenAI-shaped
seconds into Qflow's 16 kHz sample-domain `AlignedTranscriptEvidence`. Override the model with
`whisperxModel` only when the QflowHub catalog exposes a compatible replacement.

QflowHub exposes MiMo VoiceDesign by default. Set `audio: false` only when the user explicitly selects
another VoiceDesign Provider. Qflow does not expose MiMo preset-voice or voice-cloning models.
