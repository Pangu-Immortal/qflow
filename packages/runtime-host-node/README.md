# `@qflow/runtime-host-node`

Node.js Runtime port shared by the generic CLI and an application's chosen Runtime implementation,
plus environment helpers for Endpoint adapters.

The package keeps Node-specific process control out of the host-neutral Runtime contracts. It provides:

- project-root resolution for configured relative executable paths;
- executable availability diagnostics for absolute, relative and `PATH` commands;
- explicit environment-credential diagnostics.

These functions produce `RuntimeDoctorDiagnostic` values only. They do not construct Endpoints,
read secret values, execute commands or choose fallback Providers.

The generic CLI depends only on this port. The official video application selects
`@qflow/runtime-local` directly; Runtime Profiles vary credentials, Endpoints and their services
rather than replacing the Runtime itself or selecting Build history storage. A second application
may supply another `NodeRuntimeHost` at its Distribution assembly boundary; no unused Host plugin
registry or selector is exposed in a local Profile.

The same port lets an authoring application open a disposable transient execution. The caller hands
over a graph state, deterministic Producers, validators and temporary Resources; the Runtime keeps
Endpoint selection, handlers and concurrency for that disposable session private and returns the evaluated
state. This is an execution boundary, not a second Runtime Profile, Build type, cross-Build scheduler or
preview registry.

`RuntimeHostControl.logs(build, lines)` optionally exposes a bounded tail of active Build evidence.
Finished logs belong to `BuildResultManifest.executionLog` and are read through the project's Repository;
reading a finished log needs no Runtime or execution Provider. Runtime process logs keep their separate
process-control operation.

`prepare`, `preflight`, `doctor` and Program lifecycle operations accept explicit Endpoint instance
names. Build preflight uses resolved Endpoints, not every Provider offering the capability. Omitting
a scope retains whole-Profile inspection or preparation.

`prepareHostPackages` keeps exact releases in separate ordinary npm installations below the Host
package home. `HostPackageProgress.logPath` identifies live and retained npm output; failures include
that path. npm owns each installation's dependency tree and lockfile. No parallel package inventory is
maintained. `RuntimeInvocationObservation` passes direct-call progress and diagnostics through the
same Provider callbacks used in Builds, without giving immediate calls durable Operation semantics.

## Execution choices and lifetime

`createRuntime({ endpoints })` scopes a submission to the selected Endpoint instances. The local Host
records those choices and its project package root with the active execution request. Its long-lived
Worker supervises carriers with independent per-Build module and registry contexts. Managed
Programs remain independently warm. `runWorker` accepts an internal carrier entry point; execution
readiness and Endpoint capacity are independent of the number of unfinished Builds. Other Hosts own
their choice of code-loading and physical execution mechanisms.

Submission clients use `const controller = await host.controller(); await controller.worker.up()`
to start execution, then `const runtime = await host.createRuntime(); await runtime.build(request)`
to submit work. `RuntimeHostExecution` does not run a second embedded Worker loop. A local carrier
may stop accepting new Builds and drain; its assigned Builds stay in place and all carriers continue
using the same resource accounting. Process policy belongs to the local Runtime, not this Host ABI.

`prepareHostPackages` accepts exact specifier strings or `{ specifier, env }` installation inputs.
The optional environment is applied only to that npm child process, merged over its inherited
environment. It is neither persisted as installation status nor returned in package reports.
The shared installer does not interpret SDK-specific variables; their owning packages supply them.
