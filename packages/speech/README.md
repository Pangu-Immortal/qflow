# `@qflow/speech`

External components use `@qflow/qflow/speech` from their `@qflow/qflow` development dependency. The package
owns the types and helpers below; Source imports retain the `@qflow/speech@1` Module identity.


Public contracts for speech duration, normalized semantic Takes and provider-neutral evidence audio.
A `SemanticTake` contains one normalized media product, one authored Segment, its words and local
frame anchors. Ordered Takes are assembled by `@qflow/timeline-author` into a `Timeline`, which is
the complete Program range and Take placements, including gaps or overlap. `SpeechEvidenceAudio` carries canonical 16 kHz WAV bytes
and their exact sample count; it never carries Script or Segment identity.

The package also owns deterministic boundary materialization for a Segment with no Tokens. It maps
the Segment start and end to the prepared media's frame domain and publishes the same
`SemanticTake` type. The preview and real-media author surfaces both select this operation for an
empty Segment. There are no word windows to predict or acoustic evidence to request.
