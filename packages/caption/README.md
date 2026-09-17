# `@qflow/caption`

External components import `@qflow/qflow/caption`. Source uses the `@qflow/caption@1` Module
identity for shared declarations such as `Hidden`.

Caption has two independent structures: Script organizes displayed words into Cues, and timed Uses
choose how those Cues appear. A Use may begin inside a Cue. It changes presentation without changing
that Cue's text or restarting its word timing.

`CaptionDocument` owns displayed words with authored separators, display/pronunciation associations, word attributes and `||`
breaks. `Timeline` owns placed Takes and measured word times. `temporalizeCaptionDocument(document,
timeline)` joins their identities and returns `TimedCaptionProjection`: complete Cues with original
unit times. Segment, speaking-turn and explicit Cue boundaries organize this content. No Style is
needed for this operation. Unplaced material contributes no Cue.

A rendering family's Track accepts `document`, `timeline` and ordered `Use` children. Fine provides:

```svml
<caption:Hidden id="hidden"/>
<caption-fine:Track id="captions" document={story.caption} timeline={film.timeline}>
  <caption-fine:Use style={plain}/>
  <caption-fine:Use role="GUEST" style={guest}/>
  <caption-fine:Use during={story.selection.demo} style={hidden}/>
  <caption-fine:Use at={story.moment.key} for="2s" style={impact}/>
</caption-fine:Track>
```

Time attributes come from `@qflow/temporal-markup`: `during`, `at`/`for`, `until`/`for`, and
`start`/`end`, including semantic references and explicit frame/second expressions. Omitted time
attributes mean the whole Timeline. `role` filters content independently of time. Later matching
Uses replace earlier presentation inside their windows, including a Hidden Style. Separate Tracks
remain independent and can intentionally display simultaneous captions.

## Rendering-family extension

A family owns its Style, schedule, renderer and Track Surface. It can use ordinary VisualTrack
objects or an explicit browser program; no central renderer dispatch is required.

The public helpers and Types are in [index.ts](src/index.ts):

- `CaptionStyleIntent` carries a family identifier and parameters, or `rendering: null` for Hidden.
- `CaptionProgram` is the Track's internal collection of ordered, resolved Uses and referenced Styles.
  It is not a separate author element. `create-caption-uses` and `append-caption-use` assemble it from
  typed Windows. The Track may export it for its Companion, like Performance and Sound.
- `captionUseVisibility(program, index, role, envelope)` intersects a Cue envelope with a Use and
  subtracts later matching windows. Hidden participates even though it renders nothing.
- `captionProducers.temporalizeDocument` takes only `document` and `timeline`. Its output retains
  `spaceId`, `narrativeId`, `documentId`, Cue identities and measured alignment-unit boundaries.

Derive layout and animation from complete Cue content and original timing. Apply Use coverage as a
visibility mask. Fine keeps the original Present span and element animations, with separate
`visibility` intervals; changing or briefly hiding a Style does not restart karaoke, typing or motion.
A family may define lead/tail and handoff behavior, but its resulting visibility stays inside the
winning Use window. Empty content produces no drawing.

Word attributes remain on `CaptionDocument.words`. A structural family can interpret an explicit
attribute as a keyword role while retaining complete display/alignment units. Time selection does
not split `<display|speech>` text, and elapsed Cue progress is not a replacement for word timing.
The content query helpers for Role, Selection and attributes remain available for components that
actually need authored word subsets; those queries do not define the Use time language.

See Fine's [Surface](../caption-fine/src/surface.ts), [schedule](../caption-fine/src/schedule.ts) and
[renderer](../caption-fine/src/render.ts) for a concrete implementation. New family behavior belongs
in its own project package. The selected family interprets its own Styles; mixed-family dispatch,
when useful, is an explicit component responsibility.
