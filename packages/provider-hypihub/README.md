# `@qflow/provider-qflowhub`

Thin Qflow Runtime Provider for a QflowHub deployment. It is an optional default gateway for
paid generation, Gemini VLM and WhisperX alignment requests; callers may keep their own Provider and select QflowHub only
when its OAuth login is configured.

It maps the currently shipped image/video model capabilities to QflowHub, including image edits and
image-to-video first-frame inputs, submits jobs, polls them, downloads the first-class assets and
admits them into the current Build's working byte area. Image references use QflowHub's documented
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

Gemini VLM is exposed as the Provider-neutral `@qflow/gemini` Runtime capability, and remote
transcription is exposed as the same `@qflow/whisperx` alignment capability implemented by the local
WhisperX Provider. An Author
Source can select the exact model while the Runtime chooses QflowHub or Vertex. Existing embedded
callers can still use the exported `createQflowHubGeminiGenerator`. Run `qflow auth login qflowhub.default --runtime qflow.runtime.json` to sign in with QflowHub OAuth (and optionally set `QFLOWHUB_BASE_URL`; either the origin or
an existing `/v1`/`/v1beta` base is accepted) only when choosing QflowHub. The Runtime Provider also
accepts the origin or either versioned base and normalizes it to `/v1`; missing or insufficient user
credentials should be resolved at [qflow.ai](https://qflow.ai). Referenced image, audio and video
Artifacts are uploaded automatically through `POST /v1/files`, then their returned HTTPS capability
URLs are used in image and video requests. One referenced Resource is uploaded once within one
Runtime operation. Embedded callers may override that transport with `publicAssetUrl`.

The default remote alignment model is `victor-upmeet/whisperx`; `transcriptionModel` may select another
QflowHub model that exposes the `transcriptions` route. `qflow doctor` reads the authenticated model
catalog to verify configured capabilities; ordinary preflight never makes that request. The package
declares QflowHub's public pricing page, `https://qflow.ai/commercial/pricing/`, as its price source;
`qflow plan --runtime <profile>` prints it beside each request this Endpoint would serve. Per-model
credit costs are never copied into Qflow.

QflowHub declares MiMo VoiceDesign together with every other capability it serves; it never hides
one. When another selected Endpoint offers the same capability (a local WhisperX, a Vertex Gemini,
the official MiMo Provider), the Runtime Profile's `bindings` say which Endpoint serves it. Qflow does
not expose MiMo preset-voice or voice-cloning models.
