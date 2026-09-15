# `@qflow/cli`

Domain neutral commands for checking, planning, building and inspecting Qflow projects.

The command engine receives one explicit `CliDistribution`. A distribution supplies the compiler,
trusted bootstrap packages, source package discovery and its Runtime Host. The official video
executable assembles the Local Runtime through `@qflow/video-cli`; another application may provide
another Host without changing this package or pretending that a local Profile selected it.

Source imports decide which language and component packages give the source meaning. A Local Runtime
Profile separately selects Credential Stores and Endpoints allowed to execute work. The CLI does not
invent targets, candidates or Provider choices.

Human and JSON output answer the same command-specific question. `--json` changes encoding;
`--verbose` expands scope. Compiler, Runtime and Repository objects are not default reports.

Design reports for the decision they support: retain relevant facts, uncertainty and usable object
selectors, with direct access to omitted detail. Shorter output is useful when the next action
remains well-founded. Observe the command result separately from service availability; titles,
exit codes and JSON must preserve that distinction. A lifecycle refusal cannot become success just
because a health probe is down. These rules concern presentation and composition of existing
operations, not a prescribed production workflow.

Argument errors use `CLI_USAGE` and point to the relevant `qflow help <command>`; JSON retains that
command in `error.help`. Unknown help topics fail explicitly. Runtime and execution failures retain
their own diagnostics and optional `--debug` trace. Result pagination changes only the `--before`
cursor on the current query, preserving its project, Source filter and other options.

Concrete follow-up commands keep the selected project and, for execution operations, Runtime Profile.
Result-only commands need no Runtime. Arguments in displayed commands are quoted for POSIX shells
or PowerShell on Windows, including paths with spaces. The CLI formats these existing commands;
it does not choose which one the Agent must execute next.

`build --follow` and `status --watch` report coalesced progress through `CliIo.writeProgress` when
provided, including in JSON mode. The executable writes that channel to stderr; stdout remains the
final machine result. A stopped Worker ends observation with evidence-reading commands, without
promising to restart failed execution or describing the interruption as a Result storage failure.

| Command | Default scope | Explicit detail |
| --- | --- | --- |
| `check` | Validation, targets and counts | `--verbose`: exported names/types and historical references |
| `plan` | Targets, demanded requests, Endpoint selection and diagnostics | `--verbose`: Run choices, graph step count and unreached declarations |
| `pricing` | Requests that may incur a Provider charge and their rate material | `--verbose`: declared no-charge requests and original documents |
| `status`, `activity` | Current work, Provider-reported phases and failures | `--verbose`: individual operations; activity also includes capacity reservations |
| `inspect` | Targets and explicitly highlighted Outputs, outcome and failure evidence | `--output <name>` selects one Output; `--verbose` browses all available Outputs and receipts |
| `doctor`, `programs` | Complete diagnostics; program discovery or the unmet result of an explicit lifecycle action | `--verbose`: successful lifecycle details; `--limit` bounds the healthy program list |

Run choices count explicit Candidate selections, which can supply existing work or execute an
alternative producer. They are not a count of reused files. Result output counts describe all
available named Outputs, including forwarded ones; they are not a count of newly generated assets.
`history <output>` lists Builds containing that name, including reuse, rather than deduplicating
generation events or guessing whether mutable external files still contain the same bytes.
`inspect` chooses names before resolving references, so an unrelated Output cannot delay or break
inspection of a target. It reports the number of other Outputs without reading their descriptions.

`plan` retains every target, demanded request and preflight diagnostic in both encodings. `--limit`
bounds expanded detail, not the work inventory before grouping. `inspect` likewise keeps its default
target/highlight selection intact; `--limit` bounds the broader `--verbose` list, with an omitted count.
No-charge classification continues to belong to the selected Endpoint's pricing declaration.

Build follow and status include Provider-reported local Command activity as well as asynchronous
Operations. Follow coalesces counters into readable updates and continues to distinguish execution
from Result saving. Status groups identical active Operations and retains failures by default;
completed receipts are detail. Activity reports the phases that trigger its updates and ignores
changes confined to Builds outside the displayed page. Providers own the phase vocabulary; the CLI
does not interpret model or renderer names.

## Project and Runtime context

`--workspace` explicitly selects the project. Otherwise the nearest `package.json` above the command's
current directory establishes its root; with none, the current directory is the root. Source and Run
arguments locate files within that context. Relative command-line paths are resolved from the current
directory, including when `--workspace` is supplied.

Runtime-aware commands use an explicit `--runtime` for that invocation, or read exactly the resolved
project's `.qflow/runtime` pointer. `runtime use` writes the pointer; a Profile filename by itself does
not select it. The pointer is a file, separate from the Profile's `dataRoot`; a directory at that
path is reported explicitly and preserved. Project selection is also available on `paths`, `doctor`, execution status/control,
Runtime operations, `programs` and `auth`. Machine-wide `packages` operations have no project selector.

`auth status <endpoint>` reports credential presence, write access, and the Provider's declared
OAuth authorization endpoint when present. This describes how a subsequent `auth login` acquires a
credential; it does not classify the secret already stored or verify remote account access.
Without browser acquisition, login uses secure input. `--from <file>` explicitly imports a secret
instead. Credential entry operates on an already declared Endpoint and changes no Provider or binding.

`paths` shows the effective locations and whether the Profile came from a command argument, a project
selection or neither. Its JSON fields `profileSource` and `selectionFile` expose that distinction; the
selection-file location is shown even when no selection exists. `doctor` states whether it checked
only project Results or also a selected Runtime. An unselected Runtime is not a completed environment
diagnosis. Result repository selection and project-package resolution remain independent of Runtime.

For a command invoked outside the project, name both the project and its input explicitly:

```bash
qflow paths --workspace /path/to/video-project
qflow plan /path/to/video-project/build.svrun --workspace /path/to/video-project
```

`plan` lists every Endpoint request in the frozen Build graph. Exact-model packages expose their own
port tables and request-assembly edges, so the CLI can show authored prompt, duration and generation
settings without searching arbitrary records for a request-shaped object. When an input file will be
made by an earlier Build step, that direct graph edge stays symbolic until the file exists; the rest
of the request is still shown. A complete request is resolved through the same Endpoint Registry as
the Build, including the Endpoint's `supports` check.
Each component's planned-Need presentation owns its useful request fields. An empty presentation
means the summary is unavailable, not that the request has no parameters. Structured render inputs
are summarized by their owning packages; the CLI does not traverse upstream graphs to invent them.

`pricing <run>` uses that selected Runtime to read Provider-owned rate material. The default report
summarizes requests whose resolved Endpoint explicitly declares `pricing.kind: "local"` as having no
Provider charge. Requests with missing pricing declarations, failed price reads, or unresolved or
unsupported Endpoints remain visible. Names, model families and request parameters do not determine
whether work is free.

Matching capability, Endpoint and pricing material share one group. Each group shows shared request
parameters once and preserves the counts and combinations of varying parameters. A Provider's optional
document summary supplies the default rate display; otherwise the document itself is shown, or the
declared pricing page when no document is available. Documents retain the Provider's fields, units and conditions. The CLI
does not interpret formulas, infer upstream media properties, or calculate totals.

All groups are shown by default. `--limit <count>` limits human groups after grouping; `--verbose`
adds no-charge request details, full request names and original documents. JSON uses `qflow.cli-pricing@1`: `requestCount`
and `noChargeRequestCount` describe the whole Run, while `groups[]` holds Provider selection facts,
`requests[]` with known parameters and pending inputs, and `pricingDocuments[]` with source and data.
JSON includes every group regardless of `--limit`; no-charge requests are included with `--verbose`.

The implementation follows those same boundaries: `command.ts` defines the exact semantic command
union, while argument parsing and option ownership live in `arguments.ts`; project Result
browsing/export lives under `commands/results.ts`; Runtime,
credential, package and deployment operations live under `commands/environment.ts`; active Build
observation is read-only code in `observation.ts`; and human rendering is separate from the explicit
machine-view union. `main.ts` resolves project and selected Runtime context separately from parsed
syntax, then routes these command groups. Result commands do not consult or construct a Runtime,
and the generic CLI cannot silently choose a Result Repository or a Provider-specific login
flow.

## Execution logs

`qflow logs <build-id> [--workspace <project>] [--runtime <profile>] [--lines <count>]` reads Build
execution phases and Provider diagnostics. It reads a finished Result directly, without opening the
Runtime; an active Build is read through Runtime control. The selected Repository handles file access.
`--lines` limits the tail and the report states the omitted count; JSON carries records plus that count.
An unavailable log reports `source: "unavailable"` and exits unsuccessfully; a readable log with zero
records is a successful empty result. The human report distinguishes a finished Result with no log
from a lookup that still needs the Build's Runtime or correct project selection.
`inspect` exposes an available log separately from authored Outputs. `qflow runtime logs` reads the
Worker process log instead, for Runtime startup or process-level failures.

Project context resolution is owned by [`@qflow/project-context-node`](../project-context-node/README.md).
CLI, Studio and creation tools call that same package; the CLI is not another environment owner.

`doctor`, `programs up|status|down`, and `runtime up` accept repeated `--endpoint <instance>` values.
The same Endpoint scope reaches package preparation and Program operations. Omission means the whole
Profile. Build preflight instead uses the Endpoints resolved for that Build's concrete requests.
An unrelated offered capability does not add another credential or Program requirement.
Program rows show the configured Endpoint selector alongside an internal Program ID when they differ.
The `programs` JSON `ok` field reports whether this command succeeded; `ready` reports service
readiness. Successful stopping can therefore report `ok: true` with `ready: false`. A declined stop remains visible even
while the service is still preparing and cannot yet answer its health probe.

Upstream package installation reports an `install.log` path at preparation time. Exact package
releases coexist below the machine home, each with npm's own package.json and lockfile. `paths` shows
the home; `packages status <name@version>` checks the requested release rather than a mutable latest copy.
