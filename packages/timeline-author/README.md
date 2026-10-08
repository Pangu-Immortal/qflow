# `@qflow/timeline-author`

Construct one finite absolute Timeline from a small acyclic graph of named Instants and Windows.
This package owns author syntax and lowering; [`@qflow/timeline`](../timeline/README.md) owns only the
completed value `{ id, frameRate, frameCount }`.

The official video Distribution installs this package as an ordinary default npm dependency. Its
parser and construction values remain package-owned; downstream components consume only the public
Timeline, Window and Instant values. Core and the Timeline value package do not know this author
syntax exists.

Timeline is not a media Track, clip list, semantic anchor registry or hidden schedule. Its author
graph does only two jobs:

1. resolve the program's exclusive `end`; and
2. publish deliberately named absolute Instants and Windows for other graph nodes to consume.

```svml
<import as="time" from="@qflow/timeline-author@1"/>

<time:Clock id="clock" frame-rate="30"/>
<time:Timeline id="program" clock={clock}
  end="latest(speech.end,outro.end)">
  <time:Window id="speech" from="start" for={voice.extent}/>
  <time:Instant id="claim" at="speech.end-12f"/>
  <time:Window id="outro" from="claim" for="3s"/>
</time:Timeline>
```

The Timeline declaration publishes:

- `program.timeline`, the completed Timeline;
- `program.window`, `program.start` and `program.end` for the complete range;
- `program.speech`, plus `program.speech.start` and `program.speech.end`;
- `program.claim`; and
- `program.outro`, plus its boundaries.

Every named child is naturally addressable. There is no author-facing `export` attribute. Internal
construction points, spans and extents are compiler values and never become another public time
model.

## Timeline declarations

| Form | Meaning | Published value |
| --- | --- | --- |
| `<time:Instant id="cue" at="…"/>` | Names one absolute boundary relationship. | `program.cue` |
| `<time:Window id="tail" from="…" for="2s"/>` | Names one non-empty absolute interval relationship. | `program.tail`, `.start`, `.end` |

A Window supplies exactly two of `from`, `until` and `for`. `for` accepts either an exact duration
literal or a typed `TemporalExtent`. This gives forward placement, end alignment and intervals
between existing boundaries without separate Block, Before, After or Place primitives:

```svml
<time:Timeline id="film" clock={clock} end="latest(voice.end,tail.end)">
  <time:Window id="voice" from="start" for={voice-media.extent}/>
  <time:Window id="last-three" until="end" for="3s"/>
  <time:Window id="tail" from="voice.end" until="voice.end+3s"/>
</time:Timeline>
```

## Point expressions

`Instant.at`, Window boundaries and the required Timeline `end` share one restricted expression
grammar:

| Expression | Meaning |
| --- | --- |
| `start` | frame boundary zero |
| `12f`, `250ms`, `1.5s` | absolute position from zero |
| `speech.start`, `speech.end` | boundary of a named Window |
| `claim` | a named Instant |
| `claim+2s`, `speech.end-12f` | exact literal offset |
| `earliest(a,b)`, `latest(a,b,c)` | earliest or latest of named boundaries |

Declarations may refer forward. Source order is not execution order; dependencies determine graph
evaluation. `end` may also be referenced by a Window such as `last-three`. If `end` then depends on
that same Window, the author graph contains a real cycle and is rejected. Unknown references,
non-positive Timeline ends, non-exact frame durations, empty Windows and values outside the final
range are errors.

The graph may have several roots, branches and leaves. It needs no clip ordering or single content
root; it needs one resolvable `end`.

## Unknown generated duration

`TemporalExtent` is an unpositioned frame count on one frame rate. Normalization publishes it only
after an imported or generated asset is available. A Timeline Window can consume that ordinary graph
value, so an unknown voice or video length may determine later boundaries and the final `end` without
a phase state machine, callback or second Source run:

```svml
<time:Timeline id="film" clock={clock} end="outro.end">
  <time:Window id="voice" from="start" for={voice-media.extent}/>
  <time:Window id="outro" from="voice.end" for="3s"/>
</time:Timeline>
```

If generation itself requests this Timeline's end while the end depends on the generated result,
that is a genuine dependency cycle rather than a scheduling problem.

## Local domains contribute, then disappear

A prepared source may supply the `TemporalExtent` that determines a Window. That is its complete
relationship with Timeline construction. The Timeline does not retain the source, its local domain,
or a public Placement object.

When a domain package must project local evidence, it consumes the complete local domain and the
equal-length Window directly. The relation is exact native-speed translation: local frame zero maps
to the Window start and the local exclusive end maps to the Window end. A length mismatch is an error;
projection does not clip, loop, hold, stretch, resample or hide a source tail. The projector publishes
ordinary absolute Instants and Windows and erases the construction relation. Visual and Audio then
place ordinary normalized media independently.

A component consumes a completed Window or Instant; it never authors an anonymous time value on its
own surface. Put a named child in Timeline when it participates in the construction DAG. When the
Timeline is already complete, publish an independent named value or consume a value supplied by a
domain projection:

```svml
<time:Window id="reveal-band" timeline={film.timeline}
  from={story-time.reveal} until={story-time.answer-end}/>
<time:Instant id="credits" timeline={film.timeline} at="timeline.end-2s"/>

<visual:Clip during={reveal-band} .../>
```

The standalone Window publishes `reveal-band`, `reveal-band.start` and `reveal-band.end`. A standalone
Instant authors an absolute expression; an already resolved Instant needs no renaming and should be
referenced directly. Absolute value Types are the common waist; Timeline and Narrative projection are
only two possible producers of them.
