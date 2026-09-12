# `@qflow/program-space`

`ProgramClock` supplies a positive rational frame rate before material exists. The `Clock` Surface
publishes it for normalization and Timeline assembly; the same Clock Surface is available from
`@qflow/timeline-author`.

`ProgramSpace` is the lightweight physical range consumed by rendering: `id`, `durationSec` and
`frameRate`. Its positive duration ends on an exact frame boundary. The Timeline projects this
view, whether it contains speaking Takes, wordless media, gaps or no Takes at all. Authors declare
that complete work through [Timeline](../timeline-author/README.md), then components obtain the
range and any semantic evidence they need. The range itself carries no media or word table.
