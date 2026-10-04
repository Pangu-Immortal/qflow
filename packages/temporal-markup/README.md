# `@qflow/temporal-markup`

Shared SVML author helpers for constructing ordinary absolute `TemporalInstant` and
`TemporalWindow` values. This package knows the Timeline clock. It does not know Narrative,
speech, media, captions, beats, or any other source domain.

The package exports `resolveTemporalContext`, `createTemporalWindowConstruction`,
`createTemporalInstantConstruction`, their attribute vocabularies, and exact duration/instant
parsers. They are helpers for component Surfaces, not a Track and not a second Timeline model.

## The boundary

A general component accepts:

- `timeline={film.timeline}` for the absolute coordinate system;
- a `TemporalWindow` when it occupies an interval; or
- a `TemporalInstant` when it reacts to an event.

It never receives a Narrative projector and never interprets Selection, Segment or Moment values.
A source-domain package performs that projection once and publishes an ordinary absolute value.
The same component can therefore consume time from Narrative, music analysis, imported edit data,
or a literal clock position without knowing which source produced it.

## Window forms

The common Window vocabulary has four attributes and one rule:

| Form | Result |
| --- | --- |
| `during="timeline"` | The complete Timeline Window. |
| `during={story-time.proof}` | Reuse an already resolved Window. |
| `from="2s" for="12f"` | Start at two seconds and last twelve frames. |
| `until="3s" for="250ms"` | End at three seconds and extend 250 ms backwards. |
| `from={cue} until="timeline.end"` | Compose two resolved or authored endpoints. |

Outside `during`, supply exactly two of `from`, `until`, and `for`. `from` and `until` accept an
existing `TemporalInstant` or an absolute expression. `for` accepts an exact duration literal or a
resolved `TemporalExtent`.

Absolute expressions are deliberately small: `start`, `end`, `timeline.start`, `timeline.end`, an
absolute `12f`/`250ms`/`1.5s`, or one of those Timeline boundaries with a signed offset. There is no
implicit lookup of domain names such as `moment.cue`; project that domain value upstream first.

## Instant forms

An event consumer uses `at`:

| Form | Result |
| --- | --- |
| `at={story-time.claim}` | Reuse an already resolved Instant. |
| `at="2.6s"` | An absolute point 2.6 seconds from Timeline start. |
| `at="timeline.end-12f"` | Twelve frames before the exclusive end. |

An Instant does not imply a visible duration. The receiving component decides whether the event
starts an animation, changes persistent state, or ends an outer lifetime.

## Surface implementation

Resolve the required Timeline once:

```ts
const context = resolveTemporalContext({ element, resolveReference });
const timing = createTemporalWindowConstruction({
  id: itemId,
  element: child,
  ...context,
  resolveReference,
});
```

Preserve the returned records, components and fragments, then wire `timing.ref` to a
`TemporalWindow` port. For an event, use `createTemporalInstantConstruction` and an Instant port.
The consumer Producer receives only the completed value.

`subjectId` identifies the authored occurrence for inspection; it is not a nominal ownership lock.
A deliberately named Window can be reused by several components. Timeline identity and interval
validity are still checked.

## Domain projections

Domain projection belongs to the domain package. For example,
`@qflow/narrative-temporal` may publish:

```svml
<semantic:Projection id="story-time" narrative={story} timeline={film.timeline}>
  <semantic:Map alignment={speech.alignment} domain={speech-media.domain} window={film.speech}/>
  <semantic:Window id="proof" selection={story.selection.proof}/>
  <semantic:Instant id="claim" moment={story.moment.claim}/>
</semantic:Projection>

<visual:Clip media={proof-media.media} during={story-time.proof}
  frame={proof-frame} appearance={proof-appearance}/>
<deck:Card at={story-time.claim} .../>
```

Only explicitly requested values cross that boundary. The completed projection contains absolute
boundaries, not a reusable local-domain mapping. A visual, audio, caption, or typography component
does not carry the projector merely to consume the resulting time.
