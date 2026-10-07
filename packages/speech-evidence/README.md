# `@qflow/speech-evidence`

Provider-neutral acoustic and word-alignment observations. Evidence is not the authored semantic truth.

External package authors import these contracts from `@qflow/qflow/speech-evidence`; their logical
Module identity remains `@qflow/speech-evidence@1`.

`SpeechEvidenceAudio` carries canonical 16 kHz mono WAV bytes, their exact sample count and the
`LocalTemporalDomain` identity from which they were projected. `AlignedTranscriptEvidence` preserves
that domain identity and sample span while adding measured passages, words, characters and speech
activity. Providers therefore return evidence for the same explicit source domain rather than an
unidentified transcript that a later package must reconnect by inspecting Media.

The package also owns the provider-neutral `project-speech-evidence-audio` Capability and its
deterministic request Producer. That Producer verifies one `SynchronizedMedia` value against its
explicit `LocalTemporalDomain`, then requests the exact 16 kHz mono projection. A media Provider may
implement the bytes, but media operations do not own the acoustic-evidence contract.

## Transcript evidence document

`qflow.transcript@1` is the portable file view written by model-specific transcription tools. This
package owns its parsing and its exact word/phrase range operations because those operations concern
speech evidence, not FFmpeg and not a Timeline. A local-media inspection tool may use the returned
seconds ranges to select frames, but it does not acquire ownership of transcript meaning.

`wordsAt` uses half-open word spans and preserves overlaps. `phraseRanges` matches whole consecutive
words, preserves repeated occurrences and returns each measured range; it never guesses which
occurrence an author intended. Missing word times remain missing rather than being inferred as
silence. These values stay on the transcript input's local clock until an explicit semantic mapping
projects evidence onto authored Narrative.
