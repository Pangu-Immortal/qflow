# `@qflow/caption`

External components import `@qflow/qflow/caption`. Source uses the `@qflow/caption@1` Module
identity for shared declarations such as `Hidden`.

Caption has independent content, timing and presentation structures: CaptionDocument organizes
displayed words into Cues, CaptionTiming locates those units, and timed Uses
choose how those Cues appear. A Use may begin inside a Cue. It changes presentation without changing
that Cue's text or restarting its word timing.

`CaptionDocument` owns displayed words with authored separators, display units, word attributes and
Cue breaks. It contains no Narrative identities or time. `CaptionTiming` independently owns complete
Cues and absolute unit windows on one Timeline. A domain adapter can produce that timing from speech,
SRT/VTT can publish it directly, and authored absolute timing can use the same renderer.

A rendering family's Track accepts `document`, `timing`, `timeline`, the spatial inputs its renderer
actually needs and ordered `Use` children. Fine takes one placement Frame:

```svml
<caption:Hidden id="hidden"/>
<narrative-caption:Timing id="story-captions" document={story.caption}
  binding={story.caption-binding} projection={story-time.projection}/>
<caption-fine:Caption id="captions" document={story.caption} timing={story-captions}
  timeline={film.timeline} within={vertical.bounds}>
  <caption-fine:Use style={plain}/>
  <caption-fine:Use role="GUEST" style={guest}/>
  <caption-fine:Use during={demo-window} style={hidden}/>
  <caption-fine:Use from="12s" for="2s" style={impact}/>
</caption-fine:Caption>
```

Time attributes come from `@qflow/temporal-markup`: `during`, or exactly two of `from`, `until`, and
`for`, including resolved temporal references and explicit frame/second expressions. Omitted time
attributes mean the whole Timeline. Domain adapters must resolve semantic or other domain references
to ordinary absolute Windows/Instants before a Caption family consumes them. `role` filters content independently of time. Later matching
Uses replace earlier presentation inside their windows, including a Hidden Style. Separate Tracks
remain independent and can intentionally display simultaneous captions.

## Rendering-family extension

A family owns its Style, schedule, renderer and Track Surface. It can use ordinary VisualTrack
objects or an explicit browser program; no central renderer dispatch is required.

The public helpers and Types are in [index.ts](src/index.ts):

- `CaptionStyleIntent` carries a family identifier and parameters, or `rendering: null` for Hidden.
- `CaptionProgram` is the Track's internal collection of ordered, resolved Uses and referenced Styles.
  It is not a separate author element. `create-caption-uses` and `append-caption-use` assemble it from
  typed Windows. The Track may export it for its Companion, like Visual and Audio Clips.
- `captionUseVisibility(program, index, role, envelope)` intersects a Cue envelope with a Use and
  subtracts later matching windows. Hidden participates even though it renders nothing.
- `CaptionTiming` retains only `timelineId`, `documentId`, Cue identities and absolute unit windows.
  Narrative-specific binding and projection belong to `@qflow/narrative-caption`.

Derive layout and animation from complete Cue content and original timing. Apply Use coverage as a
visibility mask. Fine keeps the original Present span and element animations, with separate
`visibility` intervals; changing or briefly hiding a Style does not restart karaoke, typing or motion.
A family may define lead/tail and handoff behavior, but its resulting visibility stays inside the
winning Use window. Empty content produces no drawing.

Word attributes remain on `CaptionDocument.words`. A structural family can interpret an explicit
attribute as a keyword role while retaining complete display/alignment units. Time selection does
not split `<display|speech>` text, and elapsed Cue progress is not a replacement for word timing.
The content query helpers for Role and attributes remain here. Narrative Selection-to-unit queries
belong to `@qflow/narrative-caption`; neither defines the Use time language.

See Fine's [Surface](../caption-fine/src/surface.ts), [schedule](../caption-fine/src/schedule.ts) and
[renderer](../caption-fine/src/render.ts) for a concrete implementation. New family behavior belongs
in its own project package. The selected family interprets its own Styles; mixed-family dispatch,
when useful, is an explicit component responsibility.
