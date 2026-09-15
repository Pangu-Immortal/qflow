# A project-owned Provider

This complete package demonstrates an asynchronous image service through the public Qflow SDK.
The service protocol below is **illustrative**, not a live vendor API. Replace its mapping and
transport with the selected service's documented operations. The lifecycle test exercises the
example without a paid request. Implement the capabilities needed by the production; a service's
entire catalogue is not required.

## Follow one request

The existing GPT Image 2 Model produces `@qflow/gpt-image@1#gpt-image-2` with a generated image-set
result. This Provider supports 1K at three ratios, with optional reference images. It reports its
smaller support range without changing the Model. The Profile selects this implementation; the
Source's prompt, references and model remain ordinary generation inputs.

The example service uses Bearer authentication for these API operations:

| Operation | Example protocol |
| --- | --- |
| Upload reference | `POST /uploads`, image bytes and media Content-Type → `{ "url": "https://…" }` |
| Submit generation | `POST /tasks`, `{ "model": "gpt-image-2", "input": { "prompt": "…", "ratio": "9:16", "size": "1K", "references": [] } }` → `{ "id": "task-123" }` |
| Poll task | `GET /tasks/task-123` → `state`: `queued`, `running`, `failed`, or `succeeded`; success includes a signed image `url` |
| Read rates | `GET /rates?model=gpt-image-2` → service-owned fields and a `description` stating rates, units and conditions |
| Collect result | GET the signed image URL without the account key |

HTTP failures expose a public `{ "error": { "code": "…", "message": "…" } }` and optional
`X-Request-Id`; failed tasks carry the same `error` object. The Provider preserves these fields,
the failed API operation or task ID, and omits unrelated response fields and signed URLs.
This example schema is not a universal service-error format: adapt the interpretation to the chosen API.

Known request limits and model identity are resolved before the media URL resolver can upload.
This service exposes no model-catalogue endpoint, so the example invents none. Services with a
documented query can use it before transferring references. Request preparation, submission and
collection report live activity through `reportProgress`; queued/running task responses supply
pending progress between calls. The Provider follows the selected mapping without substituting
another model or account after a failure.

`start` records the received task ID through `checkpoint` before returning it. Runtime owns polling,
capacity and durable operation state. `poll` returns `ready` for completed remote work; `collect`
stores the image through `context.resources` and returns the Model's declared value. The Provider
chooses neither a Result folder nor a project media path. A failed call ends the attempt while the
received task ID remains evidence. This service defines no cancellation endpoint, so the package
does not claim remote cancellation.

`pricing` identifies the service page. `readPricing` maps the current request to its service rate
source and preserves the response with a concise description. It reads no graph and invents no
future media duration. Rates and credentials do not supply spending permission.

## Make it a package in the production

Copy `packages/provider-images` into the video's `packages/`. Choose your own package name and change
`providerModule.name` with it. Implement the actual service protocol, including its request limits,
upload/download limits and any OAuth or cancellation behavior it really offers. Configure the
selected service address; `images.example` is a placeholder that cannot generate media.

Use the active `@qflow/qflow` version as a development dependency. Build and install with the
project's package manager. In this repository the example uses `workspace:*` for that dependency;
replace it with your selected release when copying it out. The `@qflow/driver-node` and
`@qflow/gpt-image` development dependencies serve the repository test only and can be removed from
the copied package. For example:

```bash
cd packages/provider-images
npm install
npm run build
cd ../..
npm install ./packages/provider-images
```

The package ships JavaScript. Its `qflow.activation` exports a Profile-selected Runtime facet;
installation alone activates nothing. The active Distribution resolves public SDK imports when
loading project packages. Keep the chosen package version and lockfile with the project.

Merge the endpoint, credential store and binding from `qflow.runtime.json` into the project's
chosen Profile. Preserve its other services and resolve bindings explicitly. Once the user chooses
that account, `qflow auth login images.personal` securely enters the key into its declared store.
`plan` checks the requested parameters; `pricing` supplies the service's rates. Submitting a real
generation follows the agreed production scope and spending authority.

## Owners

- `src/provider.ts`: exact capability, mapping, service support, task lifecycle, pricing and capacity.
- `src/activation.ts`: configuration and package activation through the Runtime SDK.
- Model: author inputs and result meaning. No service URL or account is placed in it.
- Runtime: durable execution, scheduling, credentials supplied to declared slots, and Results.

The Endpoint SDK README owns the precise handler fields; the Runtime SDK README owns activation.
Both are included in the installed Distribution. A new service may need a small immediate handler,
a different upload protocol, or an asynchronous implementation like this one. Those are Provider
decisions within the same public boundary.
