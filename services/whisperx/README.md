# SVML WhisperX Service

This is the trusted, warm Python process used by `@qflow/provider-whisperx-local`. It is a Runtime
deployment package, not an author-importable SVML module and not part of Core.

The service has one narrow job:

```text
canonical 16 kHz mono PCM s16 WAV
  -> faster-whisper ASR
  -> language-specific WhisperX alignment
  -> raw measured words and optional acoustic time windows
```

It does not run FFmpeg, modify the authored script, split caption cues, infer SVML Segments, cache
Build results or create a SemanticTake. Missing WhisperX word timing stays missing; the author-side
semantic projection combines this evidence with one explicit Script Segment later.

## Install

For an ordinary installed Distribution, select the local WhisperX Endpoint and run
`qflow runtime up`. The Runtime creates this environment in the machine Program Home only when it is
missing, and reuses it across projects and sessions. The commands below are contributor/operator
diagnostics for a deliberately managed deployment:

WhisperX 3.8.6 supports Python 3.10 through 3.13. The checked-in lock selects Python 3.13:

```bash
uv python install 3.13
uv sync --project services/whisperx --frozen
uv run --project services/whisperx --frozen qflow-whisperx-prepare
uv run --project services/whisperx --frozen qflow-whisperx-check
```

The first model start may download ASR and alignment weights. Production should put the relevant
Hugging Face cache on persistent storage. `qflow-whisperx-prepare` separately installs NLTK's
`punkt_tab` sentence data through NLTK's own downloader. This resource is required by WhisperX
alignment and is prepared explicitly before the warm service starts, never inside an inference request.

## Run

```bash
uv run --project services/whisperx --frozen qflow-whisperx-service
curl http://127.0.0.1:8765/health
```

Default identity:

```text
model       small
device      cpu
compute     int8
batch size  8
protocol    qflow.whisperx-service@1
```

Configuration is deployment state:

| Variable | Default | Meaning |
|---|---:|---|
| `QFLOW_WHISPERX_PORT` | `8765` | loopback port |
| `QFLOW_WHISPERX_MODEL` | `small` | faster-whisper model |
| `QFLOW_WHISPERX_DEVICE` | `cpu` | `cpu` or the deployed accelerator |
| `QFLOW_WHISPERX_COMPUTE` | `int8` on CPU | CTranslate2 compute type |
| `QFLOW_WHISPERX_BATCH_SIZE` | `8` | bounded ASR batch size |
| `QFLOW_WHISPERX_INPUT_ROOTS` | OS temp directory | path-separated roots the service may read |
| `QFLOW_WHISPERX_NLTK_DATA` | user SVML cache | prepared, identity-checked NLTK data root |
| `QFLOW_WHISPERX_MAX_REQUEST_BYTES` | `65536` | HTTP JSON bound |
| `QFLOW_WHISPERX_MAX_AUDIO_BYTES` | `536870912` | staged canonical WAV bound |

The Node Provider must configure the same model, device, compute, batch size, service version and
WhisperX version. A mismatch fails before transcription results are accepted.

## Package preparation

Local package preparation includes `src/**/*.py` in uv's package cache inputs. Updating service code
therefore rebuilds its small wheel instead of reusing one selected only by an unchanged
`pyproject.toml`. This leaves dependency and speech-model caches intact. See
[uv's local dependency caching](https://docs.astral.sh/uv/concepts/cache/#dynamic-metadata).
This governs package installation; an already running service continues using its loaded code.

## Queue and concurrency

The SVML Runtime Scheduler decides how many WhisperX Needs may enter this Provider lane. One service
process admits exactly one inference because its ASR/alignment models are shared process state. A
second direct request receives `503 BUSY` instead of entering a hidden service queue.
`ThreadingHTTPServer` keeps `/health` responsive while the admitted inference runs.

Run multiple service processes on different devices/ports only when the Runtime registers and
locks them as distinct Provider instances.

The local Provider reconciles this packaged project through `uv sync` before a cold service start.
A passing version probe alone cannot establish that same-version checkout edits were installed;
the declared uv source cache keys decide whether the service wheel needs rebuilding. A healthy
running service remains untouched. To adopt edited service code, stop that selected helper when idle
and start it again through its Profile; restarting only the Build Worker does not reinstall Python.
