# `@qflow/audio-track`

The Track Surface accepts `timeline={program.timeline}`. The same Timeline supports authored
positions and, where prepared Takes supply evidence, Script Selections and Moments. Shared `at`
inputs accept a Moment or a time such as `2s`; `at` with `for` produces a Window where required.

Place music, ambience and sound effects in the assembled video. A reveal sound can follow a Script
Moment; music can occupy a Segment or the program; an explicitly timed sound can use clock placement.
Performance audio is presented by [Sound](../sound/README.md) from the assembled Timeline and can continue
under these independent sounds and [Media Track](../media-track/README.md) coverage.

Each Item consumes normalized audio-bearing media and a projected Window. Gain, fades, trim and
playback express the mix. Normalization preserves the source level; choose the balance and any
music ducking for the actual performance. The resulting `.audio` is a peer AudioTrack in Film.

## Authoring items

The Markup Track selects `timeline`; its Fragment receives the same Timeline.
Each Item accepts one shared temporal Window form: `during="program"`, a Selection or Segment,
a Moment paired with `for`, or explicit `start`/`end` expressions. The source must already contain
normalized audio. This excerpt assumes imports, Script, Timeline, Clock and source media exist:

```svml
<pipeline:Normalize id="hit-media" source={hit-source}
  video="none" audio="default" span-authority="audio" clock={clock}/>
<audio:Track id="effects" timeline={speech.timeline}>
  <audio:Item source={hit-media.media} at={story.moment.reveal} for="600ms"
    playback="once" gain="0.45" fade-in="0f" fade-out="3f"/>
</audio:Track>
```

The Track publishes `.program` and `.audio`; include the latter as a peer Film Track. `gain` is a
linear multiplier, defaulting to `1`; fade durations default to `0f`. Trim boundaries are source
durations (`f`, integer `ms`, or fractional `s`), distinct from the Item's destination Window.
`trim-end` is the exclusive source endpoint, not an amount to subtract from the tail. For example,
`trim-start="1s" trim-end="3s"` selects the source interval from one to three seconds.

`once` / `once-start` plays once from the Window start; `once-end` aligns to its end. `loop` /
`loop-start` and `loop-end` repeat with the corresponding alignment. `stretch` preserves pitch and
requires authored `min-rate` and `max-rate` bounds. Other playback modes reject those rate bounds.
Choose occupancy from the intended sound; the Track does not silently loop music or stretch a hit
to fill a longer Window. Its source level is retained unless gain or another explicit audio operation
changes it.

Media Track and Audio Track both place independent Items on the same Timeline.
Overlapping pictures compose by draw order; overlapping sounds mix together.
Give an Item an `id` when it needs a recognizable author name. Studio otherwise
displays its source reference; the generated internal identity still owns
selection and writeback. Reusing a source in two Items keeps two independent
placements, even when their displayed names match.
