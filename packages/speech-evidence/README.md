# `@qflow/speech-evidence`

Provider-neutral acoustic and word-alignment observations. Evidence is not the authored semantic truth.

External package authors import these contracts from `@qflow/qflow/speech-evidence`; their logical
Module identity remains `@qflow/speech-evidence@1`.

`SpeechEvidenceAudio` carries canonical 16 kHz mono WAV bytes, their exact sample count and the
`LocalTemporalDomain` identity from which they were projected. `AlignedTranscriptEvidence` preserves
that domain identity and sample span while adding measured passages, words, characters and speech
activity. Providers therefore return evidence for the same explicit source domain rather than an
unidentified transcript that a later package must reconnect by inspecting Media.
