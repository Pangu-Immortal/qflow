# `@qflow/film`

The Surface, Fragment and assembly Producers receive the same Timeline through a `timeline` input.
Partial, overlapping or absent semantic coverage all use that complete range.

Official package-owned assembly layer between peer Tracks and the generic Composition waist.
Film is an ordinary author component and an optional Target, not a Core root or a privileged video
type.

The package lowers one concrete Film declaration into a finite `FilmTrackSet` fold, then compiles
that set into `Composition`. This supports any number and mix
of VisualTrack and AudioTrack inputs while every Core Operation retains a fixed manifest-declared
port list and one atomic result.

`FilmTrackSet` is an immutable lowering value, not an author-facing workflow collection. Each append
receives the previous set and newly added Track through explicit graph edges. The domain value copies
no lineage metadata. Final Composition
remains order-independent because the public contract canonicalizes Tracks and visual ordering
belongs to each Present's absolute `z`, Track-local `order` and stable identity fallback.

The official Structured Surface validates an imported generic SVS Recipe into a nominal
`FilmProgram`, receives Canvas and the selected time source through separate explicit edges,
passes the Timeline directly, type-checks
each `<film:Track source={...}/>` reference and generates the finite fold. Canvas is the only
dimension truth, Timeline is the only time-range truth, and FilmProgram owns only assembly
identity and clear color.
Child order is organizational: Track and Present identity, timing and absolute stacking remain in
their own typed values. Final rendering is a separate author package and capability.

For example, after the named inputs are declared:

```svml
<film:Film id="main" canvas={vertical.canvas} timeline={speech.timeline}
  appearance={recipes.film.vertical}>
  <film:Track source={picture.visual}/>
  <film:Track source={mix.audio}/>
  <film:Track source={coverage.visual}/>
  <film:Track source={captions.visual}/>
  <film:Track source={music.audio}/>
</film:Film>
```

The public output is `main.composition`. Including a Visual Track output does not automatically include
an Audio Track output derived from the same media. An opaque upper layer can cover a performance while
its separately included audio continues;
reordering these children is not how an author changes that visual stacking.

The `appearance` Recipe uses `background`, for example `film.vertical { background: #18212A; }`.
The compiled FilmProgram's field is `clearColor`; it is not a Recipe key named `clear-color`.
