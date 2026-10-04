# Timing authored relationships

Read this when deciding when a component acts. [Script syntax](script-syntax.md) names Narrative
relationships; [Timeline](timeline.md) constructs the complete absolute domain. Components consume
absolute Instants and Windows.

## Start from the production decision

Use Narrative time when a picture or event should follow meaning as wording or performance changes.
Use absolute time when it should follow the film clock. Both choices eventually produce the same
absolute value types; neither is mandatory for the other.

NarrativeAlignment locates Script boundaries in a source-local domain. `semantic:Projection` maps
that domain exactly onto an equal-length Timeline Window and publishes only the Narrative
Instants and Windows the production asks for:

```svml
<semantic:Projection id="story-time" narrative={story} timeline={film.timeline}>
  <semantic:Map alignment={speech.alignment} domain={speech-media.domain} window={film.speech}/>
  <semantic:Window id="proof" selection={story.selection.proof}/>
  <semantic:Instant id="claim" moment={story.moment.claim}/>
  <semantic:Instant id="answer-end" segment={story.segment.answer} boundary="end"/>
</semantic:Projection>
```

General components then use `story-time.proof`, `story-time.claim`, and `story-time.answer-end` as
ordinary `TemporalWindow` or `TemporalInstant` values. They do not receive `story-time.projection`
and do not interpret Script objects.

## Window forms

Surfaces using the common Window vocabulary accept one of these forms:

| Form | Result |
| --- | --- |
| `during="timeline"` | The complete film Window. |
| `during={story-time.proof}` | An already resolved Window. |
| `from="2s" for="12f"` | A Window beginning at two seconds and lasting twelve frames. |
| `until="3s" for="250ms"` | A 250 ms Window ending at three seconds. |
| `from={story-time.claim} until={story-time.answer-end}` | A Window between two resolved Instants. |

Outside `during`, supply exactly two of `from`, `until`, and `for`. `for` may also reference a
`TemporalExtent`, including the measured duration of generated media. This does not put media on
Timeline; it only lets an ordinary graph result determine an interval.

## Instant forms

An event component uses one Instant:

| Form | Result |
| --- | --- |
| `at={story-time.claim}` | A domain-projected event. |
| `at="2s"` or `at="12f"` | An absolute clock event. |
| `at="timeline.end-12f"` | An event relative to a Timeline boundary. |

The component decides what the event does. A card may remain visible, a slideshow component may switch pictures,
or a motion may begin. The Instant itself has no visible duration.

## Name only what needs a name

Write timing directly on a single consumer when it is local to that occurrence. Publish a named
Timeline Window/Instant when it helps determine the film end or is deliberately shared. Publish a
domain-projected value when its source identity matters. Do not copy every possible semantic anchor
into a central table.

## Editing

Studio follows the producer of the value:

- an absolute literal edits that literal;
- a named Timeline value edits its Timeline declaration;
- a Narrative-produced value edits the declared Narrative mapping that produced it;
- a reused value is edited once at its producer, so every consumer follows after recompilation.

The consumer does not carry an inverse projector. If a source domain offers no declared inverse,
Studio does not guess one. A resolved value remains fully usable even when it is not editable.

Frames use the selected film clock. Seconds and milliseconds express clock duration. Keep semantic
relationships, absolute offsets, and response duration as separate author decisions rather than
collapsing them into one hidden policy.
