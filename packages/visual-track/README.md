# `@qflow/visual-track`

Visual Track is the plain picture-placement package. Its author model is deliberately small:

```text
Visual Clip = one picture source + absolute Window + Frame
            + z + spatial map + source-time + optional treatment + optional typed Motion
Visual Track = ordered set of Visual Clips
```

The Track consumes one completed Timeline. It publishes `.program` for
declared tooling and `.visual` for Film. It does not discover media or anchors from Timeline, infer
semantic roles, select audio, or own multi-Clip transitions.

```svml
<visual:Motion id="gentle-push">
  <visual:Pose at="start" scale="1.08" easing="ease-out"/>
  <visual:Pose at="end" scale="1"/>
</visual:Motion>

<visual:Track id="picture" timeline={program.timeline}>
  <visual:Clip id="speaker" media={speaker-media.media}
    during={program.speaker} frame={full-frame} z="10" fit="cover"/>
  <visual:Clip id="diagram" image={diagram} extent={diagram-extent}
    during={story-time.explanation} frame={inset-frame} z="20" fit="contain"
    treatment={recipes.visual.diagram} motion={gentle-push}/>
</visual:Track>
```

A public Clip accepts exactly one direct source form—`image` plus `extent`, normalized `media`, or a
typed `surface`. Moving media is normalized before authoring; its
factual frame count and frame rate remain source truth. The destination Window states when this
occurrence exists in program time.

The ordinary source roles are intentionally equal. A-roll, B-roll, generated footage and imported
graphics are all Clips. A source may have contributed duration and anchors while Timeline was built;
that prior contribution does not give its later visual occurrence a special Type or placement route.

## Frame and source mapping

`frame` is the outer destination rectangle. Independent Clip attributes control placement and
source-time; an optional treatment Recipe contains only reusable pixel and Frame treatment:

| Properties | Meaning |
| --- | --- |
| `z` | Absolute picture stacking; required on the occurrence. |
| `fit`, alignment, offsets and constraint | Convenient occurrence attributes that derive one source-to-picture `SpatialMap2D`. |
| `mapping` | An explicit `SpatialMap2D` used instead of all fit attributes. |
| `clip`, `radius`, `padding` | Outer geometry and the fitting inset. |
| border, shadows and `frame-paint` | Decoration owned by this Clip. |
| opacity, blur, brightness, contrast, saturation | Treatment of the sampled picture. |
| `Map` / `source-time` | Optional Clip-local relation from target frames to timed-source frames. |

Use distinct `z` values when relative paint order matters. Equal-`z` Clips are valid: the Track
retains declaration order locally, and terminal rendering uses stable Track and Present identities
as the remaining fallback. This guarantees deterministic execution without making Visual Track
pretend it can prove every authored overlap aesthetically intentional.

An authored spatial Path may replace the treatment clip with `clip={path}`. Path coordinates remain
in program-picture pixels. A typed `Motion` transforms the whole framed Clip with affine/opacity
`Pose` keyframes; inline `Pose` children express the same value. `Sampling` children animate the
fitted source inside the Frame. Neither form names a closed aesthetic effect.

The resolved Program never retains fit as a competing spatial authority. When the Clip Frame is
known, ordinary fit resolves once against the Frame's deterministic border/padding inset; an
explicit mapping passes through unchanged. Every sample in `.program` then carries the final
`SpatialMap2D`, and rendering applies that complete matrix to the source-local extent. A rectangular
content bound may be derived for diagnostics, but is not stored or rendered as a substitute for the
map.

For the open path, publish or receive a map and share the same value with every consumer that needs
the identical projection:

```svml
<space:Map id="turned" xx="0" xy="-0.5" yx="0.5" yy="0" tx="920" ty="180"/>
<visual:Clip image={diagram} extent={diagram-extent} mapping={turned}
  during={story-time.explanation} frame={inset-frame} z="20"/>
```

The explicit map is already in program-picture coordinates. `frame` still independently owns the
Clip's clipping and treatment boundary. This separation permits rotation, skew, reflection,
off-Frame placement and exact reuse by source-local evidence without adding a layout mode.

## Source time

Omitting a Map means bounded partial identity: Clip-local target frame zero maps to source frame zero
at native rate, and the picture becomes absent when either domain ends. There is no implicit hold,
loop or stretch.

One `Map` states an affine piece. `target-from`/`target-until` bound its target interval;
`target-at`, `source-at` and the exact rational `rate` relate the two clocks;
`source-from`/`source-until` bound the source domain. `wrap-from`/`wrap-until` make that source interval
periodic. A Map without rate, anchors or wrap fits the selected source interval across its target
interval. Multiple non-overlapping Maps form one partial function; uncovered target frames are
transparent.

```svml
<visual:SourceTime id="native-loop">
  <visual:Map rate="1" wrap-from="start" wrap-until="end"/>
</visual:SourceTime>

<visual:Clip media={shot.media} during={story.outro} frame={full} z="10">
  <visual:Map target-at="end" source-at="end" rate="1"/>
</visual:Clip>
```

Visual rates may be zero for a held frame or negative for reverse traversal. A still image has no
source clock and refuses Map; it simply remains visually active throughout the Clip Window while
Clip-local Motion may still animate it.

Visual Track contains no generic `Presentation`, `Use`, `Sequence` or `Handoff`. A continuing
presenter, crossfade, slideshow or coordinated reveal is shared behavior and therefore belongs to an
ordinary project/author component. Such a component may use the public visual primitives and still
publish the same terminal `VisualTrack`; Core and Film learn no new role.

This is the package's incremental boundary: the plain Clip supplies the stable operations almost
every picture occurrence needs, while a new visual role remains straightforward to author as a
component. The Track does not force authors to start from raw Composition IR, and it does not turn
today's effect names into tomorrow's ceiling.

Audio from synchronized media is never selected implicitly. Author the corresponding occurrence
independently through [`@qflow/audio-track`](../audio-track/README.md).
