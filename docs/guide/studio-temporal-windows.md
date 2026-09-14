---
title: Studio Temporal Lineage
description: How author choice becomes an Instant or Window and returns to its real source.
---

Time has three layers:

```text
author choice (Selection / Segment / Moment / program time)
  -> projection (TemporalInstant / TemporalWindow)
  -> domain consumption (Program / Schedule / Track)
```

Script's semantic ruler contains `2M + 2N + 2` author points: Token and Segment boundaries plus
distinct Program start/end anchors. Program anchors resolve at frame `0` and `frameCount` in the
Timeline; they are author points and therefore never have to be forged inside a SemanticTake.
Their Script order need not match physical time when Takes overlap or are reordered.
This does not make `during="program"` writable: that projection remains structurally fixed.

`@qflow/temporal-markup` owns the SVML author forms and lowers them before a domain component runs.
The compiler only composes records, components and fragments; it does not recognize `during`, `at`
or any time grammar. One Timeline supplies the complete range and any placed semantic evidence.
Domain components receive that same Timeline and projected time values, remaining independent from
both semantic lookup and Studio.

## Runtime values

A `TemporalInstant` contains the runtime source used to evaluate it, the exact point expression and
resolved frame, and one author authority: `semantic`, `parameter` or `fixed`.

The identity chain is author-visible rather than synthesized by Studio:

- `<script id="story">` becomes `Narrative.id = story`; every Selection, Moment, Segment excerpt
  and CaptionDocument from that Script carries `narrativeId = story`;
- every terminal Track's `programSpaceId` names the selected Timeline. `ProgramSpace` is the shared
  clock/range shape contained in Timeline, not a second author-declared time axis;
- every projected Instant carries the space identity; semantic sources also carry the Narrative
  identity. Each includes the consumer's public domain identity (normally its SVML `id`) as `subjectId`.

The projection record `id` may be qualified to stay unique inside an expanded graph; it is not the
author identity. `subjectId` is kept separate and remains the exact board, card, item or sequence
identity published by the component's public Program.

These values are ordinary runtime provenance, not random hashes or Studio metadata. They let a
consumer and its inverse reject a same-named Selection from another Script or a Track projected on
another timeline. A Script id therefore names one Narrative across the active Source closure.
The Script Surface declares that identity, and compilation rejects duplicates before Studio needs
to choose a source.

A `TemporalWindow` contains two complete Instants and a non-empty half-open span. Its endpoints may
have different sources and different authorities, so a Window never pretends to have one source.
ProgramSpace boundaries are legal Instants; `program.end` is not disguised as a one-frame Window.
Out-of-range Instants and reversed or empty Windows are rejected, not clipped or repaired.

## Author forms

| Form | Start authority | End authority | Timeline writeback |
|---|---|---|---|
| `during={Selection}` | semantic Selection start | semantic Selection end | Script markers |
| `during={Segment}` / `during="program"` | fixed | fixed | read-only |
| `at={Moment} for="…"` | semantic Moment cue | parameter `for` | Script and/or SVML atomically |
| `until={Moment} for="…"` | parameter `for` | semantic Moment cue | Script and/or SVML atomically |
| `at="2s" for="…"` | parameter `at` | parameter `for` | SVML timing attributes |
| `start="…" end="…"` | parameter `start` | parameter `end` | SVML timing attributes |

A point consumer uses `at={Moment}` (or a chosen Selection boundary) for semantic authority, or
`at="2s"` for authored time. `instant="…"` accepts a projected expression. Text such as `at="moment.cue+3f"` is rejected because it hides
whether the author intended to move the Moment or the offset.

## Studio inverse

Studio indexes the actual executed `TemporalInstant` and `TemporalWindow` records plus their direct
consumer edges. Endpoint authority, not a component name or Companion declaration, determines the
inverse:

- semantic authority writes the shared Script identity;
- parameter authority names the author input selected by the runtime record;
- fixed authority disables a gesture that would change it.

For `at/for` and `until/for`, one gesture may touch both layers. For example, trimming the start of
an `at/for` Window moves the Moment and changes `for` so the end stays fixed. Studio applies both
source ranges as one revisioned transaction, recompiles, and rolls both back on failure.

Companion packages still decide how an entity looks and which Inspector fields are visible. They do
not declare common timeline inverse functions. A new component becomes time-editable by consuming
the same public Instant/Window protocol and carrying its executed lineage to its Studio entity.

Film and Script interpretation also remain outside Studio core. `film-studio` declares which Film
reference supplies the time axis and which child references are terminal Tracks; `script-studio` owns
Script source observation and marker relocation. Studio selects the Script source map whose
`narrativeId` exactly matches the active Timeline and delegates the edit back to that companion.
A zero-Take Timeline supplies the same physical time range without requiring a Script lane.

The binding name is not used as a global address. Markup retains the exact author element and input
range while decoding, Elaborator hygienizes that endpoint with its Source unit, and the compiled
`AuthorProvenance` joins the executed authority to one author endpoint. Studio therefore never
chooses the first same-named `start`, output or local id across imported Sources. The provenance is
recomputed with the compilation and is not persisted as metadata, a lock or an index file.
