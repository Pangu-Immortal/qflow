# `@qflow/store-sqlite`

Private durable state used by `@qflow/runtime-local`.

One SQLite file stores Build facts, external Operations, the active Build work set, capacity reservations
a small output catalog, resource waiters and action rate budgets. No ready-command queue is stored: Core derives ready work from the saved
Build facts whenever the Worker advances it.

Operation receipts retain task IDs, original Need identity and credential references until the Result
has recorded them. Unknown remote outcomes do not keep a failed Build active.

Artifact bytes and secret credential values never enter this database. Components and Endpoint packages do not import
SQLite. `SqliteRuntimeState` exposes the narrow stores needed by the local Runtime and owns their shared
connection.

Execution choices live in `context_json` on the existing submission/execution records. The store treats
that value as opaque Host data. `started_at` distinguishes queued work from an executor that was lost.
`listUnstarted` and `listReady` return only IDs for dispatch, without parsing every Profile or graph.
Scoped claims and shared capacity updates remain atomic across execution contexts and processes. No global Profile
pin prevents a new Build from using new selections. An interrupted executor is concluded only after
its supervisor knows the process has exited; stored Operation receipts are retained for Result writing.
