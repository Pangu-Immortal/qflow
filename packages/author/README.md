# `@qflow/author`

Parser-independent author linking and static Graph Fragment elaboration outside SVML Core.

The package is the optional compilation layer between authored declarations and the domain-free
Kernel. A frontend, API or visual editor first emits one sealed `qflow.author-module@1` containing
component calls with symbolic Record/Component-output references. The Author linker then works in two
phases:

1. lock every referenced Fragment and predeclare every component export;
2. resolve references, reject missing values, type mismatches and cycles, hygienically instantiate
   Fragments, then emit one ordinary `qflow.graph@1` for Core.

Because all exports are collected before any input is resolved, declaration order has no meaning
and a component may reference a later component. The linker itself does not parse `.svml`, execute
package code or know any domain vocabulary. The non-video laboratory test demonstrates that the
same layer works without `@qflow/markup` or audiovisual contracts.

The official Markup adapter emits this exact Author Module format. Its separate non-video
integration fixture proves the complete `source → Surface → AuthorModule → Graph → BuildPlan` path;
Markup still does not become a prerequisite for direct API or visual-editor callers.

The package owns the parser-independent Frontend, Author Module, Source Closure and provenance
contracts consumed by compilation. `@qflow/compiler` owns recursive discovery and closure
orchestration: it receives a `ResolvedSource`, exact Frontend registry, immutable module closure and
Workspace resolver, rejects cycles and duplicate aliases, and decodes dependencies before their
importers. The Author linker then qualifies private Record/component identities and binds only
declared public exports into importer namespaces. Workspace paths remain outside Source Closure
identity; source contents, Frontend digests, written import edges and requested Blob identities stay
covered without moving raw bytes into AuthorModule or Kernel BuildState.

The same hygienic pass emits an ephemeral `qflow.author-provenance@1` sidecar. A Frontend may retain
the structural ranges of author elements and inputs; the Author linker qualifies their Record, component,
output and endpoint identities together with the graph. This is a compiler result, not a Source
file, lock, digest inventory or editor database. It carries no domain or Studio presentation and
lets any diagnostic/editor join a graph value back to the exact author endpoint without matching a
local name after compilation.

The orchestration ABI is asynchronous even when a local Text/SVS implementation is synchronous.
This lets a browser, sandbox or remote repository provide SourceUnits without changing the
compilation contract. The Host resolver is the authority for path canonicalization, workspace
containment, symlink policy and I/O; the Author linker receives bytes and identities but never opens files
or grants filesystem access itself.

Asset resolution follows the same inversion of authority. The decode context exposes only an
asynchronous `resolveAsset({ from, mediaType })` capability. The Author linker validates the returned
identity, rejects conflicting media assignments for one written locator and folds the dependency
into Source Closure identity. It does not know whether a Host obtained the bytes from a filesystem,
browser upload, repository object or remote content store.

Frontend output passes a Host-owned Record validation hook before linking. The hook is permitted to
reject a Record but is forbidden to rewrite Record identity, Type or value.
`@qflow/compiler` wires this to `@qflow/admission` by default, so authored
values use the same Type-owner gate as Producer, Provider and provided Candidate values.

A `qflow.fragment@1` value may reference only declared Fragment inputs and local Operations. It
contains no JavaScript callback, ambient file lookup, credential access or Runtime endpoint. Before
expansion the Author linker verifies producer ports, types, cycles, reachable exports and Semantic
Input Envelopes.

Expansion assigns hygienic identities from `Fragment id + author instance id + local id`.
Multiple exports of one instance therefore share internal Operations, while two explicit instances
remain two nodes even when their content is identical. Author exports become Logical Outputs with
Primary Candidates; Run exports become independent typed Candidates plus explicit Satisfaction
edges. The result is ordinary graph data that Core validates again before freezing a BuildPlan.

`exportRunFragment()` is the canonical Run-Graph boundary: it exports independent Candidates and
does not name an Author Logical Output. Run frontends keep Candidate declaration and the explicit
`output -> candidate` Satisfaction edge separate.

`@qflow/author` is a reusable graph-construction owner, not a universal Author SDK facade. A domain
normally adds its own contract and component packages; Text remains only one
optional frontend capable of producing the same Author Module data.
