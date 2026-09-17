# `@qflow/qflow/generation`

Provider-neutral generated-media contracts shared by exact image, video and audio model packages.

External Model and Provider packages import this public subpath from the `@qflow/qflow` Distribution.
It gives both sides the same request and result vocabulary without a dependency between their
implementations. `sealGenerationPortTable` describes a model's inputs; `GenerationWireMapping` and
`compileWireRequest` can translate those inputs to one Provider's documented wire fields.
`selectWireModelForRequest` applies the same route selection without resolving media bytes. During
planning, a Provider may add the model-port names already attached as future graph inputs; the
selector does not inspect graph structure or interpret media roles.
Route selection here applies declared input-mode mappings for the already chosen exact capability;
it does not search for an alternative model, service or account.

`compileWireRequest` awaits its media URL resolver, so compilation can have external effects when
that resolver uploads files. Use `selectWireModelForRequest` for request identity and known-port
checks before those effects; pricing and execution can share the same mapping. A Provider can also
describe its API operation from the authored ports. Service-specific support queries belong to that
Provider and only use operations its API actually exposes. The generic helper neither queries a
catalogue nor switches to another route after a failure. Actual URL resolution belongs to request
execution, not to discovering a model name or making a planning placeholder.

The package owns `GenerationRequest`, `GeneratedImageSet` and `GeneratedVideoSet` identities,
schemas, validators and graph facets. Generated sets are atomic Products: a Provider persists the
returned bytes in an ResourceStore and returns typed Blob references rather than transient URLs.

This package does not choose a model, Provider, credential, queue or retry policy. Model packages
declare exact request Capabilities; selected Endpoint packages implement those
Capabilities in a selected Runtime Profile.

## Reference fields in resource transport

A service may consume per-media metadata while preparing a URL rather than in its generation JSON.
Media wire mappings (`url`, `urlArray`, `itemObject`) may declare `resourceFields: ["fieldName"]`.
`compileWireRequest` supplies those present item fields as the second argument to its URL resolver;
`itemObject.fieldKeys` separately maps fields into the generation body. Port coverage checks both
paths against the declared media fields. False, zero and empty strings remain values; omitted fields
remain absent. The resolver implements the service protocol; this package knows no particular
service or classification. Providers using custom transports carry those fields through that boundary.

A Model item field being optional means authors may omit it. If a request supplies that field,
`mappingSupportsRequest` and final wire compilation require the mapping to carry it through
`fieldKeys` or `resourceFields`, including an explicit `false`. A service may support requests
without a particular optional field and refuse requests that supply it; no field is silently dropped.
Final compilation checks the whole request before resolving or uploading any reference.
