# `@qflow/kernel`

The domain neutral graph compiler and build state machine.

Core links module declarations and plans one complete Author Graph together with one complete Run
Graph. Starting at the Targets, it applies explicit satisfactions, follows every dependency introduced
by the selected Candidates, and derives one finite execution closure without rewriting either source
graph.

Execution is one immutable `BuildDefinition` followed by accepted `BuildFact` values. `BuildMachine`
reconstructs the current view, emits the next commands and accepts their results. The materialized
`BuildState` is a disposable view rather than durable authority.
Within one live Build, the machine keeps disposable Record/Need/Command indexes, missing-input
counts, reverse Record dependencies and the remaining Goals. A committed Fact therefore wakes only
the steps whose inputs changed. These indexes are neither serialized nor shared across Builds and
can always be reconstructed from the Definition and Facts. `evaluate` still derives the exact Fact
before mutation; `commit` advances the indexes only after the caller has durably appended it.

The pure `reduce(BuildState)` path remains the standalone reference transition for detached or
deserialized views. Runtime execution can use the machine's indexed Record lookup directly; a Store
snapshot whose state was already materialized is adopted once instead of replaying the same Facts a
second time.
`BuildDefinition` contains only the selected Program, initial Records, Producer steps,
`Output -> Record` bindings and Targets. Graphs, satisfactions and Candidate identities end at the
planning boundary.

`resolveNeedCommand(state, commandId)` resolves the Command belonging to an existing Need, including
when a stopped Build has no outstanding work. Core owns this identity rule; execution adapters do not
parse Command IDs. The query does not schedule or execute work.

Core does not parse source files, load packages, execute components, call providers, store artifact
bytes or know what a video is. Those responsibilities remain in compiler and runtime packages.
