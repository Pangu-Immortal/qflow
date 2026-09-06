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
Resources are uploaded through a session from `POST /v1/files/uploads`, followed by the private
regional multipart instructions returned by QflowHub. The Provider follows the server-selected part
size and concurrency, retries only a failed part with a fresh signed URL, completes or cancels that
one upload, and then passes the returned HTTPS URL to generation, Gemini or transcription. One
Resource identity is uploaded once within one Runtime operation. Qflow keeps no upload catalog or
cross-Build cache. Embedded callers may replace this transport with `publicAssetUrl`.

The service currently requires whole-file and per-part SHA-256 values as fields of its signed upload
protocol. They exist only while transferring bytes; Qflow never uses them as Resource identity,
Result metadata, lookup keys or reuse evidence. Signed URLs and their query credentials are removed
from surfaced upload errors.

The default remote alignment model is `victor-upmeet/whisperx`; `transcriptionModel` may select another
QflowHub model that exposes the `transcriptions` route. `qflow doctor` reads the authenticated model
catalog to verify configured capabilities; ordinary preflight never makes that request. The package
declares QflowHub's public pricing page, `https://qflow.ai/commercial/pricing/`, as its price source;
`qflow plan --runtime <profile>` prints it beside each request this Endpoint would serve. Per-model
credit costs are never copied into Qflow.

QflowHub declares MiMo Voice Design and Voice Clone together with every other capability it serves; it
never hides one. Voice Design produces an accepted voice-reference Resource, and Voice Clone uses
that reference to produce independent speech. Qflow does not expose MiMo preset voices. When another
selected Endpoint offers the same capability (a local WhisperX, a Vertex Gemini, or the official MiMo
Provider), the Runtime Profile's `bindings` say which Endpoint serves it.

Execution policy remains local to this Provider. A profile may set `requestTimeoutMs`,
`operationTimeoutMs`, `uploadPartTimeoutMs`, `uploadPartAttempts`, `downloadAttempts`,
`geminiRateLimitAttempts` and `geminiRateLimitRetryDelayMs`; defaults are respectively 300 seconds,
20 minutes, 5 minutes, 3 attempts, 3 attempts, 4 attempts and 2 seconds. `defaultConcurrency`
controls the total shared capacity of this Profile's QflowHub pool. Optional `capabilityConcurrency`
sets narrower group limits, for example `{ "seedance-2-mini": 2, "gemini": 3, "transcription": 1 }`.
Image/video/speech groups use the exact capability name; all Gemini capabilities share `gemini`, and
WhisperX uses `transcription`. These limits coordinate this Runtime's requests; QflowHub remains
responsible for service-wide account limits. Immediate speech/Gemini/transcription slots cover the
active HTTP invocation, while asynchronous image/video slots cover remote work until completion or local execution failure.

For asynchronous image/video jobs, `actionLimits` configures the common `submit`, `poll` and `collect`
admission budgets. Each accepts `concurrency` and `rate: { limit, periodMs }`, shared by the pool.
These limits count lifecycle actions; Provider-specific upload parts and HTTP requests remain inside
those actions. Synchronous speech, Gemini and transcription retain their ordinary request capacity.

A submission, polling or collection error ends the local attempt. Known job IDs and credential
references remain available in Result receipts; a timeout with no ID is recorded as such. A job can
be inspected at `/jobs/<id>` and its generated assets at `/jobs/<id>/assets` on the selected API base.
The next production attempt uses a new Run and Build. Runtime bindings never switch from a user's
own Provider to QflowHub after a key, quota or transport failure.

Multipart concurrency is different: QflowHub
selects it for one upload session, and it does not create a Build queue or a second Runtime pool.
