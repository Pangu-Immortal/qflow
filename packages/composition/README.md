# `@qflow/composition`

Provider-neutral visual and audio Track contracts and their final Composition.

## VisualTrack

`sealVisualTrack` accepts `id`, `timelineId`, `visualIr: VISUAL_IR_V1` and `presents` and returns
a value with `kind: "visual"`. `assertVisualTrackIdentity(track, timeline)` also checks it against a
specific Timeline. Both functions are exported from this package.

Each Present supplies:

| Field | Meaning |
| --- | --- |
| `id`, optional `subjectId` | Appearance identity and, when useful, the domain entity it depicts |
| `span` | `{ startFrame, endFrameExclusive }` in program frames |
| `order` | Stable order among Presents emitted by this owning Track |
| `z` | Author-owned absolute picture stacking position across Tracks |
| `elements` | One rooted element tree owned by the Present |

Higher `z` paints later. Equal-`z` Presents use stable Track identity, Present `order` and Present
identity as deterministic fallbacks; authors use distinct `z` values when that relative paint order
matters. Element `order` values are distinct within a Present and determine order inside its tree. A child names
its `parent`; its position is relative to that parent. Root positioning is relative to the Canvas.
Animation keyframes use `atFrame` offsets from the Present's start. Media sampling targets use the
same local frame origin and map to exact source frames.

The exported `VisualElement` union covers `box`, `mask`, `text`, `text-flow`, `path-text`, `image`,
`video`, `surface` and `program`. Text carries exact FontArtifactRef values; images and videos carry BlobRefs;
`surface` carries a CompositableSurfaceRef. The schema and exported TypeScript types in `src/track.ts`
give each shape. `qflow vocabulary --visual visual-track` and focused element queries expose those
schemas through the installed Distribution.

A `program` carries `{ format, payload, artifacts }`. The rendering package owns the object payload
and supports named formats. It may place typed children in its own local structure, so video, text
and graphics can share behavior while retaining explicit material dependencies. The parent
relationship remains local to the Present; internal layout belongs to that program.

## AudioTrack

An AudioTrack contributes explicit clips with source audio artifacts, target sample ranges, exact
partial source-time maps, gain and fades. Target positions use the Timeline's canonical 48 kHz
sample domain. Each non-overlapping affine source-time piece maps Clip-local target samples to
source samples; uncovered target samples are silent. Use `timelineSampleFrames` and the
temporal/media helpers when converting an authored event into that domain.

`sealAudioTrack` and `assertAudioTrackIdentity` are the corresponding public constructors/checks.
An Author Package can publish visual and audio Tracks as separate Outputs; the composition includes
each selected Output explicitly.

## Composition

A Composition carries its id, Canvas with clear color, and peer Tracks. The Tracks retain their
Timeline identity; assembly and rendering receive the corresponding Timeline separately.
`@qflow/film` is one author-facing way to assemble it;
`@qflow/render-hyperframes` consumes it to produce a video.

### Visibility without a new source-time origin

A VisualPresent may supply `visibility`, an ordered list of non-overlapping subranges in program
frames, all inside its `span`. Omission means the full span; an empty list means never visible.
`span` continues to define local animation and media-sampling time. This permits rule overrides or
other partial visibility without cutting a program into restarted copies. HyperFrames applies the
visibility independently when seeking; custom HTML and typed media keep their original clocks.

## Audio level automation on the program clock

AudioClip optionally carries level automation as `gainEnvelope: { sample, gain }[]` and
`audibility: { startSample, endSampleExclusive }[]`. Both use absolute 48 kHz program samples.
Envelope points have strictly increasing sample positions and interpolate linearly, holding the
outer endpoint gains. They multiply the existing Clip gain and fades. Audible subranges are ordered,
disjoint and inside the original target; omission means the whole target, an empty list means silence.
`audioEnvelopeGainAt` evaluates the envelope; `assertAudioLevelAutomation` checks these values.

Original target and source sampling remain intact when a Clip is partially inaudible. Range
rendering applies envelopes and masks before cropping. These fields express generic sound behavior;
multi-Clip relationships such as ducking or crossfades belong to ordinary author components.
