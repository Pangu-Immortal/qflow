# `@qflow/temporal`

Common absolute-time protocol for video graphs.

The public coordinate values are:

- `TemporalInstant`: one resolved frame boundary on one Timeline;
- `TemporalWindow`: one non-empty half-open `[start, end)` interval; and
- `TemporalExtent`: an unpositioned frame count on an exact frame rate.

These values contain the minimal facts needed by consumers. Their derivation—Narrative Moment,
music beat, Timeline child, literal clock position, or another source—remains in the typed graph and
the producing package. Temporal does not carry a closed source-kind union or a domain projector.

`subjectId` identifies each authored value for inspection. A Window has its own identity while its
endpoints retain the identities of the values from which it was composed; those three identities need
not match. It is not an ownership lock on consumers: a named Window or Instant may deliberately feed
several components. Consumers validate Timeline identity and bounds rather than requiring their own
id to match the value.

`TemporalExtent` lets an imported or generated result determine Timeline construction without making
Timeline understand media, speech, or the operation that discovered the length. A domain projector
may map one complete finite source-local domain onto an equal-length Window at native speed through
the pure exact-projection helper. This total one-to-one operation keeps every local boundary
projectable and produces no durable Placement value.

Author syntax does not live in the main contract entry. The same owner exposes
`@qflow/qflow/temporal/markup` to construct absolute literals and compose Windows from Markup.
Domain packages such as `@qflow/narrative-temporal` project their own values into these
common types. Visual, audio, caption, typography and project components receive only the completed
Instant or Window plus the Timeline they already consume.

Temporal rejects Instants outside Timeline, Windows whose endpoint Timelines or stored span disagree,
reversed or empty Windows, non-exact local-domain projection, and incompatible frame rates. It does not
clip, repair, infer meaning, perform rendering, or define Studio behavior.

Author-directed editing follows the declaration that produced a value rather than asking a consumer
to invert an arbitrary projection; see [EDITING.md](EDITING.md).
