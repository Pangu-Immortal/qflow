# `@qflow/qflow/generation`

Provider-neutral generated-media contracts shared by exact image, video and audio model packages.

External Model and Provider packages import this public subpath from the `@qflow/qflow` Distribution.
It gives both sides the same request and result vocabulary without a dependency between their
implementations. `sealGenerationPortTable` describes a model's inputs; `GenerationWireMapping` and
`compileWireRequest` can translate those inputs to one Provider's documented wire fields.
`selectWireModelForRequest` applies the same route selection without resolving media bytes. During
planning, a Provider may add the model-port names already attached as future graph inputs; the
selector does not inspect graph structure or interpret media roles.

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
