# `@qflow/narrative-speech-alignment`

Provider-neutral deterministic timing locator for one authored Segment on a normalized local temporal
domain. The package does not
invoke Python, read audio, call a speech provider, use an LLM, infer speakers or retain multiple
candidate paths. A runtime adapter preserves its raw provider artifact and supplies the normalized
word, character, score and speech-activity evidence used here in exact 16 kHz sample coordinates.

This is an independently versioned and packaged algorithm, not a root SDK facade and not a WhisperX
implementation. The official Distribution obtains it through `@qflow/whisperx`'s ordinary npm
dependency; another package producing the same provider-neutral evidence may depend on it directly.
The project package manager and lockfile own the selected physical version.

The locator aligns one explicitly connected Script Segment against acoustic evidence carrying that
same local domain identity and exact evidence sample span. A bounded monotonic M:N dynamic
program accepts exact, split, merge, replacement, source-omission and evidence-insertion groups.
Within a selected group, timed evidence characters determine Script token boundaries; word times
and speech-activity bounds are fallbacks. Missing token runs receive continuous weighted windows
between their measured neighbors instead of invented point timestamps. The result is quantized once
into the supplied local frame domain and contains one timing for every Script token plus the Segment
and token boundaries. Segment boundaries are exactly frame `0` and the local domain frame count.

The public Producer accepts Narrative, one Segment excerpt, its `LocalTemporalDomain` and
`AlignedTranscriptEvidence` through explicit graph edges. It does not reopen `SynchronizedMedia` to
recover audio or duration. Evidence carries the measured domain identity and sample span but no
authored Segment identity; the deterministic semantic step performs that association locally and
rejects a mismatched domain or span.

`speechAlignmentComponent` exposes this Segment-local alignment as one enumerable deterministic Producer facet. Its
identity is checked against `speechAlignmentManifest` and executes through the host-neutral compute
port. The package depends only on Narrative, Temporal and provider-neutral Evidence
contracts plus protocol utilities; it has no Media, Core, Driver, Provider, Artifact, queue or credential
authority.

Caption display is outside this package. `@qflow/narrative-caption` combines an independently owned
Caption document/binding with the resulting Narrative timing; it never asks this locator to infer
display text or display-unit timing.

The result is the `@qflow/narrative-temporal` `NarrativeAlignment`, not media and not a Timeline.
An explicit Narrative Projection from that package later combines one or more
`NarrativeAlignment + LocalTemporalDomain + equal-length Window` relations for a chosen Timeline. Visual,
audio and caption consumers then request absolute Instants or Windows through that declared relation;
Timeline and Core do not enumerate semantic event kinds.
