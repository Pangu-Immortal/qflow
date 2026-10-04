# Place pictures through Visual Track

Read this when an existing image, normalized video or compositable Surface should appear in the
finished picture. [Media preparation](media.md) owns incoming material, [spatial layout](spatial.md)
owns destination Frames, and [timing](timing.md) owns absolute and projected event time.

## The ordinary relation is one Clip occurrence

Visual Track has one base child form:

```text
Visual Clip = one picture source + absolute Window + Frame
            + z + spatial mapping + source-time + optional treatment + optional typed Motion
Visual Track = ordered set of Visual Clips
```

```svml
<visual:Motion id="photo-push">
  <visual:Pose at="start" scale="1.08" easing="ease-out"/>
  <visual:Pose at="end" scale="1"/>
</visual:Motion>

<visual:Track id="picture" timeline={program.timeline}>
  <visual:Clip id="speaker" media={speaker-media.media}
    during={program.speaker} frame={layout.full} z="10" fit="cover"/>
  <visual:Clip id="photo" image={product} extent={product-extent}
    during={story-time.example} frame={layout.detail} z="20" fit="contain"
    treatment={look.visual.still} motion={photo-push}/>
</visual:Track>
```

An A-roll picture, B-roll insert, generated shot and imported graphic are equal after their inputs
exist. A medium may earlier have supplied Timeline extent or local-domain evidence; that contribution
does not create a special rendering route. The Clip names the source again because rendering is a
separate relation: the author explicitly chooses what becomes visible.

A Clip takes exactly one direct source form—`image` with `extent`, normalized `media`, or a typed
`surface`. `during` consumes an absolute Window or the complete
Timeline. The alternate temporal form supplies exactly two of `from`, `until` and `for`.

Spatially, ordinary fit and alignment attributes derive a source-local-to-program `SpatialMap2D`.
If that vocabulary is insufficient, pass an explicitly authored `<space:Map>` through `mapping`.
The Clip Frame remains the independent treatment and clipping boundary. See
[spatial layout](spatial.md#map-a-source-plane-and-treat-its-frame) for the complete relation.

## Keep destination time and source sampling distinct

The Window says when the occurrence may contribute. It does not silently prove an anchor mapping.
For moving media, omission means bounded partial identity: target start maps to source start at native
rate, and excess destination time is empty.

Use `visual:Map` children when the temporal relation differs. `target-from`/`target-until` select Clip-local target
frames; `source-from`/`source-until` select source frames; `target-at`, `source-at` and an exact `rate`
relate the clocks. `wrap-from`/`wrap-until` makes a source interval periodic. A Map with only source
and target bounds fits one interval across the other. Multiple non-overlapping Maps create one
piecewise relation and gaps stay transparent.

```svml
<visual:Clip media={shot.media} during={story.outro} frame={layout.full} z="10">
  <visual:Map target-at="end" source-at="end" rate="1"/>
</visual:Clip>
```

Stills reject `visual:Map` because they have no source clock. This temporal child is unrelated to a
`space:Map` supplied through the `mapping` attribute. `z`, spatial mapping and source time are direct
occurrence facts. A treatment Recipe contains only image/Frame paint. A typed Motion contains affine
and opacity Pose keyframes over the Clip-local clock; it is not an enter/sustain/exit effect catalogue.

Use distinct `z` values whenever the relative paint relation matters. Equal-`z` Clips are legal and
follow stable declaration and identity order; choosing that tie is the author's responsibility.
Sampling children move the crop inside the Frame; Pose children or `motion={Motion}` move the complete
framed Clip.

Exact one-to-one mapping is required only when another package claims that local semantic endpoints
project exactly into an absolute Window. Ordinary picture placement is not that proof operation.

## Relationships spanning Clips are components

Visual Track has no generic Presentation, Style/Use, Sequence or Handoff ontology. A continuing
presenter, crossfade, slideshow or coordinated reveal owns behavior across several occurrences, so
it belongs to a project or reusable author component. The component may use Visual Track's public
builders and publish the same terminal `VisualTrack`; Film and Core do not learn a catalogue of roles
or effects.

This does not ban a component-local child named `Use`. Caption retains Use because one persistent
CaptionDocument and Timing stream is real shared content. A project Presenter may also define Source
and Use because continuing presenter identity is its behavior. Those local grammars do not become
base Visual Track syntax.

Visual Track emits `.visual` and `.program`, never audio. Place desired sound independently through
[Audio Track](audio-clips.md). Using both streams from one normalized medium therefore remains an
explicit author decision.

When footage and graphics form one coordinated scene, author a project component whose boundary owns
that relationship. [Track authoring](track-authoring.md) explains how components publish ordinary
terminal tracks without changing Core.
