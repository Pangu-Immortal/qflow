# `@qflow/speech`

Provider-neutral speech generation duration contracts.

External components use `@qflow/qflow/speech` from their `@qflow/qflow` development dependency.
Source imports retain the `@qflow/speech@1` Module identity.

`@qflow/speech-evidence` owns canonical evidence audio plus provider-neutral word, character, score
and speech-activity observations in exact sample coordinates. Evidence carries its local domain
identity, but no Script, Segment, film Timeline or presentation identity.

[`@qflow/speech-alignment`](../speech-alignment/README.md) deterministically combines acoustic
evidence with one authored Segment and its `LocalTemporalDomain` to produce the
`@qflow/narrative-temporal` `NarrativeAlignment`. The public Narrative timing contract is deliberately
not owned here. An empty Segment needs no acoustic request: Narrative Temporal can materialize its
boundaries directly over the supplied local domain with an empty token list.

This package defines no provider, queue, credential, media normalization, Timeline assembly or
visual/audio presentation policy.
