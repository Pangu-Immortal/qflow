# `@qflow/temporal`

Runtime protocol for projected video time.

The public values are `TemporalInstant` and `TemporalWindow`. An Instant retains its runtime source,
exact projection expression, resolved ProgramSpace frame and author authority. A Window is composed
from two independently traced Instants; it has no synthetic single source.

Every source names its exact `ProgramSpace`; semantic sources also name their `Narrative`. Every projection retains the
consumer's public domain identity as `subjectId`. These are public provenance fields, not generated hashes
or editor metadata. A graph-qualified projection `id` and its author-facing `subjectId` are separate
on purpose.

Author syntax does not live here. `@qflow/temporal-markup` lowers SVML timing forms into ordinary
Instant projection and Window composition operations. The graph supplies one Timeline;
domain components receive that Timeline plus the resulting Instant or Window and never locate a
Selection, Segment or Moment themselves.

Every official consumer verifies the projection at its public boundary: `subjectId` must name the
domain object being built, both endpoints must retain one time-range identity, and that identity
must equal the explicitly supplied Timeline. Timeline is therefore an ordinary graph input
to the consumer, not ambient renderer state.

Temporal rejects Instants outside ProgramSpace and Windows that are reversed or empty. It does not
clip or repair author time. The package also provides sibling-window validation and triggered-stage
scheduling, but no renderer, Provider, media policy or Studio behavior.

All projection Producers receive Timeline. Program-bound projection uses its complete range;
semantic-bound projection locates its Script anchors. Both produce the same Instant type; program-bound
sources have no Narrative identity. A Window can combine a semantic endpoint with a program endpoint
on the same time axis. `absolute` expressions may include a duration offset, as used by `at`/`for`.
