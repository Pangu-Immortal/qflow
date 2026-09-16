# `@qflow/qflow/model-kit`

Author-model package helper for defining exact generated-media requests without repeating the
nominal Type → Producer → Need → Graph Fragment shell.

An external model package develops against the public `@qflow/qflow/model-kit`, `@qflow/qflow/generation`, and
`@qflow/qflow/author-kit` subpaths. The released `@qflow/qflow` Distribution is its framework development
dependency; the model ships its own compiled JavaScript, Sources, and assets.

## Declare the authored request

For example, a model's request can have one prompt and a chosen output shape:

```ts
import { defineExactModelModule } from "@qflow/qflow/model-kit";
import { sealGenerationPortTable } from "@qflow/qflow/generation";

const ports = sealGenerationPortTable({
  model: "studio-image-v1",
  result: "image",
  ports: [
    { name: "prompt", value: { kind: "text" }, minItems: 1, maxItems: 1 },
    { name: "aspectRatio", value: { kind: "enum", values: ["1:1", "9:16"] }, minItems: 1, maxItems: 1 },
  ],
  requires: [],
});

export const model = defineExactModelModule({
  module: { name: "@studio/image-model", version: "1" },
  endpoints: [{ key: "image", requestTypeName: "ImageRequest", producerName: "generate-image", ports }],
});
```

The model name, ports, supported values, and cardinalities above are illustrative; declare the actual
model's author-visible semantics. A service-specific subset belongs in its Provider's `supports`.
Adding a new service for this request leaves the Model unchanged.

The definition supplies the Module Manifest, component handlers, exact-model Host facet, and each
endpoint's request Types and generation Fragment. Export the Manifest in the package activation's
`modules`, the component in `components`, and its Host facet in `hostFacets`. An Author Surface uses
`@qflow/qflow/author-kit` to read Source and connects authored Text and media edges through
`createExactModelPrimaryGenerationFragment`. It publishes the resulting image, video, or audio as a
normal Output. See the public function types for the returned values and Fragment inputs.

The Model declares the Need; a separately selected Provider must implement its exact Capability and
result Type. Source selects the Model, while the Runtime Profile selects the Provider Endpoint.

`defineExactModelModule` does not make model requests generic. The calling package still owns its
exact fields, constraints, model identity, capability name and validator. The helper adds no
Provider routing, fallback, credentials or Runtime authority.

This is a package-authoring utility, not an author-importable model by itself.

## Model-owned request checks

An endpoint may supply two synchronous, pure functions in addition to its port table:

- `validateInputs(inputs)` checks values already supplied, both in drafts and complete requests.
  Text and media may still be missing from a draft. Use this for rules such as a reference's media
  type; do not require a future input to exist.
- `validateRequest(request)` checks additional relationships that require the complete request.
  It runs after the port table and `validateInputs`, when every required input is available.

Both return `void` and throw a useful error to reject. They read the supplied values only: no IO,
Provider selection, request mutation or saved validation result. Existing port rules remain in the
port table. The helper supplies structural validation before calling either function.

Register each rule once in the endpoint definition. The helper connects these functions to Type
validators, media/Text bindings, finalization, generation and planning. Planning checks the known
values and leaves future media on the existing graph edges. A directly supplied request or an
existing Need receives full validation, just as it does during execution.

For a public request builder, use `model.endpoints.image.sealRequest(ports)`: it canonicalizes the
request and applies all model rules. `endpoint.validateRequest(value)` checks an existing complete
request; `endpoint.validateDraft(value)` checks a partially assembled one. Calling the common
generation port helpers alone applies only the port table, not these model-owned functions.

Keep service-specific limits in the Provider. Its existing `supports` and pre-submission preparation
should share its own checks, rejecting known unsupported values before resource transfer. This does
not require the Provider to import the Model implementation or add any fields to the request.
