# @qflow/whisperx

Explicit WhisperX model-family capability for the official speech program. Importing this package
selects WhisperX; Runtime registration only binds the resulting alignment Need to a concrete
execution endpoint. The default Qflow Skill path uses the QflowHub-hosted WhisperX endpoint; the
trusted local worker remains an explicit deployment choice.

The package contains no credentials, Python environment or queue. Providers translate the typed
request directly into provider-neutral `AlignedTranscriptEvidence`. There is no vendor-shaped
Evidence wrapper or pass-through normalization node in the graph.

`<whisperx:SemanticTake>` is the real-media semantic Surface. It consumes one normalized
`SynchronizedMedia` and exactly one Script Segment. When that Segment contains Tokens, it also
requires an explicit lowercase two- or three-letter language code, such as `language="ko"`.
This package checks the code's form, not a cross-Provider support list. The language is passed directly to
WhisperX; Script text and audio are not used to choose it implicitly. `@qflow/media-pipeline`
projects the Take's audio to canonical 16 kHz mono `SpeechEvidenceAudio`; WhisperX sees only those
bytes. A deterministic local alignment then combines the returned evidence with the Segment and
emits one self-contained `SemanticTake`.

For Chinese speech, select `zh` (also `qflow transcribe --language zh` for a reference). WhisperX's
Chinese alignment emits character-sized words, including letters inside some Latin names. The
evidence adapter preserves those windows; the local alignment maps them onto Script's units, so
a complete Latin name can consume several evidence words while neighboring Han characters retain
their own times. Caption gets its displayed wording and Cue breaks from Script, independently of
the recognizer's punctuation or simplified/traditional spelling.

When the authored Segment has no Tokens, write the same Surface without `language`. Its start and
end Anchors map directly to the prepared media's first and final frame. There are no words to align,
so this branch requests no evidence audio and no WhisperX capability:

```svml
<whisperx:SemanticTake id="pause" narrative={story}
  segment={story.segment.pause} media={pause-media.media}/>
```

There is no whole-program WhisperX pass. Timeline assembly only receives already-semantic Takes and later
translates their local frames when assembling the final ProgramSpace and complete semantic map.

`@qflow/provider-qflowhub` is the default concrete adapter; it uploads the canonical evidence audio
and requests verbose JSON with segment- and word-level timestamps. `@qflow/provider-whisperx-local`
remains available as an explicit local deployment.


## Language selection and local preparation

```svml
<whisperx:SemanticTake id="opening" narrative={story}
  segment={story.segment.opening} media={opening-media.media} language="ko"/>
```

The selected service owns which languages it can align. The local service uses its pinned WhisperX
version's default language-to-alignment-model mapping: the author does not choose weight URLs in
SVML. ASR size and hardware are separate deployment choices (`expectedModel`, `expectedDevice`,
`expectedCompute`). A multilingual ASR such as `small` can serve Korean; an English-only `.en`
model cannot and is rejected explicitly. Unknown alignment languages fail in the service without
switching language, model family or Provider. Locale aliases such as `zh-CN`, language names and
`auto` are not interpreted by this Surface; use the service's explicit code.

For local execution, merge this into the existing Runtime Profile:

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

`alignmentLanguages` declares resources to prepare on this machine. Each SVML `language` states
what that particular Take uses; the preparation list never supplies an implicit author language.

```bash
qflow programs prepare --runtime qflow.runtime.json --endpoint whisperx.local
qflow runtime up --runtime qflow.runtime.json --endpoint whisperx.local
qflow build video.svrun --runtime qflow.runtime.json --follow
```

The Run references the authored SVML. Preparation downloads missing resources without starting the
service; `runtime up` prepares if needed and starts the helper and Worker. Build only uses prepared
resources. Adding a language to the same cache requires preparation, not a service restart.
See the [local Provider README](../provider-whisperx-local/README.md) for cache and hardware choices.
Other Endpoints needed by the Run must also be prepared and available.

For reference analysis rather than an authored SemanticTake, use the same language code with
`qflow transcribe source.mp4 --language ko --to transcript.json --runtime qflow.runtime.json`.
Hosted execution uses the selected hosted deployment's models and preparation; the local
`alignmentLanguages` option does not configure a remote service.
