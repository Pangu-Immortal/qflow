# `@qflow/whisperx`

Explicit WhisperX model-family capability for speech alignment. Importing this package selects
WhisperX; Runtime registration binds the resulting evidence Need to a concrete Endpoint. The package
contains no credentials, Python environment or queue.

`<whisperx:Alignment>` consumes one normalized `SynchronizedMedia`, its `LocalTemporalDomain`, one
authored Script Segment and the owning Narrative. For a Segment containing Tokens it also requires an
explicit lowercase two- or three-letter language code. The provider receives canonical evidence audio
tagged with the selected local domain identity and returns provider-neutral
`AlignedTranscriptEvidence` preserving that identity and exact sample span; deterministic local alignment publishes one
`NarrativeAlignment`:

```svml
<whisperx:Alignment id="opening" narrative={story}
  segment={story.segment.opening}
  media={opening-media.media} domain={opening-media.domain}
  language="ko"/>
```

The result is `opening.alignment`. It contains semantic timing on the media-local domain, not media,
not a Timeline and not presentation policy. `@qflow/narrative-temporal` Projection explicitly combines
one or more `NarrativeAlignment + LocalTemporalDomain + equal-length Window` relations for a chosen
Timeline and publishes absolute values without a durable Placement product.

When the Segment has no Tokens, omit `language`. Its start and end map directly to the local domain's
first and final frame, no evidence audio or WhisperX capability is requested, and the same
`NarrativeAlignment` type is published.

For Chinese speech use `zh`. WhisperX may emit character-sized evidence units; local alignment maps
them to Script's authored units while Caption continues to use Script's display wording and Cue breaks.
The package validates only the language-code form; the selected Endpoint owns actual language support.

## Local deployment

`@qflow/provider-qflowhub` is the normal hosted adapter. A local deployment may bind the same Need:

```json
{
  "endpoints": {
    "whisperx.local": {
      "use": "@qflow/provider-whisperx-local",
      "config": { "expectedModel": "small", "alignmentLanguages": ["ko"] }
    }
  },
  "bindings": {
    "@qflow/whisperx@1#whisperx-alignment": "whisperx.local"
  }
}
```

```bash
qflow programs prepare --runtime qflow.runtime.json --endpoint whisperx.local
qflow runtime up --runtime qflow.runtime.json --endpoint whisperx.local
qflow build video.svrun --runtime qflow.runtime.json --follow
```

The Provider README owns model cache and hardware choices. For reference analysis rather than an
authored alignment, use `qflow transcribe source.mp4 --language ko --to transcript.json` with the
selected Runtime.
