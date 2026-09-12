# Performance

Performance presents footage already placed on a Timeline. Media Items receive independent assets;
Performance Uses select how the existing footage appears. [Sound](../sound/README.md) presents existing audio. Include the wanted visual and audio outputs
separately in Film.

```svml
<import as="performance" from="@qflow/performance@1"/>
<performance:Style id="full" frame={layout.full} appearance={recipes.media.presenter}/>
<performance:Style id="side" frame={layout.side} appearance={recipes.media.presenter}/>
<performance:Track id="presenter" timeline={program.timeline} canvas={canvas}>
  <performance:Use style={full}/>
  <performance:Use during={story.selection.explanation} style={side}/>
</performance:Track>
```

Select `presenter.visual` in Film. A Style's appearance uses Media fitting, clipping, radius, padding,
border, shadows and sample appearance. `stack-order` places its Presents among Film contributions.
A Use with no time selector covers the complete Timeline. Later Uses replace earlier rules locally;
they do not add another copy of the picture. No matching Use means no picture. An empty winning
Style stays empty. Separate Performance Tracks can independently show the same material.

## Time, sources and visibility

Use accepts shared `during`, `at` + `for`, `until` + `for`, or `start` + `end`. A Window says when a
presentation applies. Timeline determines source positions: a Take placed at second 5 shows source
second 2 at program second 7. Styles receive the original Use Window even when partially covered.
Visibility does not restart playback or animation. The ordinary Style presents available videos in
Timeline declaration order, later above earlier; no Takes, audio-only Takes and source gaps supply
no picture. The Timeline can extend past all material without filling that time with a clip.

Two independently bound endpoints can describe a physical overlap that is backwards in Script order:

```svml
<performance:Use style={mix}
  start-source={story.segment.next} start="segment.start"
  end-source={story.segment.previous} end="segment.end"/>
```

The concrete Style determines which sources are outgoing/incoming. Window endpoints do not select
those roles implicitly. There is no automatic crossfade when source spans overlap.

## Write a project Style

`performanceStyle(fragment, bindings)` creates an authored Style. The fragment takes `timeline`,
`canvas`, and `window`, plus any family-defined typed inputs, and exports `visual: VisualTrack`.
`bindings` binds those extra inputs to resolved author references. A Style Surface returns this as
an inline Record of `performanceTypes.style`. At each Use, the Track expands the fragment and turns
every binding into a normal graph edge, including references to generated outputs. No family
registry or effect-name dispatch is involved. The Style is an author-time definition, not a
runtime-produced choice of executable code.

```ts
const style = performanceStyle(fragment, {
  from: resolveFrame("from"),
  to: resolveFrame("to"),
});
// Each value is a SurfaceResolvedReference; all fragment inputs except the three
// occurrence inputs above must be bound. Your Surface owns its parameter names.
```

A family may bind Segment references, Moments, prepared assets, Frames, Recipes or computed outputs.
Its Producers use the Timeline and shared projections to obtain exact source spans and event times.
`projectTimelineMedia` returns zero, one or several sources with their identities and native source
positions. Known sources without visual material differ from invalid references. Rendering can use
ordinary structural elements, Media helpers or a browser program with HTML, CSS and frame code.
`ordinaryPerformance` provides reusable fixed framing; a whole coordinated diagram/presenter scene
can instead be an independent component.

The [project Style example](../../examples/semantic-composition/packages/performance-styles/README.md)
implements movement and two-source blending through these public interfaces. It demonstrates an
extension path, not a required library of built-in transitions.

## Implementation boundary

`resolvePerformance` resolves last-declared Window coverage. It retains each Present's original
`span` and intersects its optional `visibility` subranges with the winning intervals. The renderer
uses `span` for animation and sampling and `visibility` only for display. Empty Uses still participate
in coverage. Nothing in this package changes audio, Script, Timeline placement or generation.

`Track.visual` is the resolved picture. `Track.program` retains the ordered Use windows and their
unresolved VisualTracks, including covered and empty applications. The
[Studio Companion](../performance-studio/README.md) uses this program to expose individual Uses.
