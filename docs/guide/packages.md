---
title: Package Architecture
description: The seven layers, dependency boundaries, package anatomy and facets.
---

# Package Architecture

Workspace packages under `packages/` are organized into seven architectural layers. Dependencies are
declared by each package itself. The root installs the complete source checkout so the Package
Loader can resolve any explicitly selected package, but TypeScript has no central path alias that can
hide a package's undeclared import.

## The seven layers

### Layer 1: Qflow Core

The immutable graph protocol, demand compiler and Build state machine. This closure is domain
neutral and knows nothing about source syntax, files, networks, models or video.

```text
@qflow/protocol              immutable wire contracts
@qflow/core                  Demand compiler and Build state machine
```

### Layer 2: Compiler

Source discovery, Frontends, imports, graph elaboration and the reference Node Host. A source
selects its own Frontend in its mandatory header; no central parser knows every language feature.

```text
@qflow/source                mandatory Source Header
@qflow/elaborator            author declarations and Fragment expansion
@qflow/run                   syntax-neutral Run Graph
@qflow/validation            semantic admission
@qflow/host                  opaque Host-facet envelope
@qflow/workspace             replaceable Source/Asset session
@qflow/compiler-node         reference Node compiler Host
@qflow/workspace-fs-node     workspace filesystem abstraction
@qflow/package-loader-node   installed package selection
@qflow/markup                official .svml Markup Frontend
@qflow/svs                   SVS Recipe Frontend
@qflow/run-markup            official .svrun Markup Frontend
@qflow/compiler-markup-node  Markup Frontend + Surface Host assembly
```

### Layer 3: Foundations

Reusable values and deterministic building blocks. They support video authoring but do not decide a
film's creative structure or call an external service.

```text
@qflow/artifact              content-addressed bytes
@qflow/component-kit         Producer and validator registration
@qflow/text                  graph-native text templates
@qflow/media                 media values
@qflow/temporal              Selection and Moment projection
@qflow/spatial               layout geometry
@qflow/visual-ir             renderer-neutral visual vocabulary
@qflow/fonts-open            redistributable font assets
@qflow/media-pipeline        media inspection and normalization
@qflow/media-execution       shared ffmpeg execution body
@qflow/transport             invocation seams
@qflow/transport-aws-lambda  Lambda transport
```

### Layer 4: Video authoring

The packages that give SVML its video vocabulary: narrative, exact model requests, speech,
captions, peer Tracks, Film and render declarations. They depend on shared contracts, never on a
specific Provider deployment.

```text
@qflow/narrative             authored narrative products
@qflow/script                Script Surface
@qflow/program-space         exact frame/sample domain
@qflow/generation            image/video/audio generation contracts
@qflow/model-kit             model family abstractions
@qflow/seedance              Seedance model family + author Surface
@qflow/seedance-kits         data-only Seedance semantic Text Templates
@qflow/minimax-h3            MiniMax H3 model family
@qflow/gemini-omni           Gemini Omni model family
@qflow/grok-imagine          Grok Imagine model family
@qflow/gpt-image             GPT Image model family
@qflow/nano-banana           Nano Banana model family
@qflow/seedream              Seedream model family
@qflow/mimo-tts              three exact Xiaomi MiMo TTS models + author Surfaces
@qflow/estimate              duration estimation
@qflow/speech                shared speech products
@qflow/speech-evidence       acoustic evidence products
@qflow/speech-alignment      speech alignment
@qflow/semantic-track        continuous semantic program skeleton
@qflow/speech-track          ordered speech-take compilation
@qflow/whisperx              WhisperX component
@qflow/caption               caption planning and timing
@qflow/caption-gemini        Gemini caption planner
@qflow/caption-fine          field-free fine caption Track family
@qflow/media-track           unified Media Item/Sequence Track
@qflow/typography-track      typography overlay Track
@qflow/audio-track           arbitrary sample-domain Audio Track
@qflow/deck-track            depth-stack collection Track
@qflow/ranking               three ranking component families
@qflow/screen-overlay        self-contained full-canvas overlays
@qflow/film                  Film composition
@qflow/composition           peer Track composition
@qflow/hyperframes           HyperFrames document compiler
@qflow/render-hyperframes    explicit HyperFrames rendering component
@qflow/image-transform       image processing component
@qflow/image-compose         ordered still-image composition
@qflow/raster                shared deterministic raster execution contract
@qflow/background-removal    external image cutout capability
```

### Layer 5: Providers

Privileged external capabilities. Depend on Runtime ports and shared capability vocabularies,
never on exact-model packages or the CLI.

```text
@qflow/provider-kie                  KIE generation plus background removal
@qflow/provider-media-local          local ffprobe/ffmpeg
@qflow/provider-whisperx-local       local WhisperX service
@qflow/provider-google-vertex        Vertex Gemini caption planning
@qflow/provider-hyperframes-local    local Chrome rendering
@qflow/provider-hyperframes-aws-lambda asynchronous distributed rendering
@qflow/provider-image-opencv-local   local OpenCV Raster execution
@qflow/provider-media-aws-lambda     synchronous AWS media execution
@qflow/provider-xiaomi-mimo           official Xiaomi MiMo TTS API
```

### Layer 6: Runtime

Domain-neutral execution ports plus replaceable deployment implementations. Runtime packages own
queues, stores, credentials and process lifecycle; they never define author syntax.

```text
@qflow/runtime               Scheduler, Worker and Store ports
@qflow/endpoint-kit          Endpoint declarations
@qflow/driver-node           trusted Node command executor
@qflow/runtime-kit           deployment package ABI
@qflow/runtime-host-node     Node Runtime Host ABI
@qflow/runtime-local         local Worker and assembly
@qflow/store-sqlite          SQLite state
@qflow/artifact-store-fs     filesystem Artifacts
@qflow/artifact-store-s3     S3 Artifacts
@qflow/credential-store-env  environment credentials
@qflow/credential-store-keychain macOS Keychain credentials
```

### Layer 7: Applications

```text
@qflow/cli                 generic command engine (requires explicit Distribution)
@qflow/video-cli           video command application (selects Markup compiler, no built-in author packages)
@qflow/svml-playground     development preview for a Source, never runs a Provider
```

## Dependency rules

The package layout follows three dependency rules:

1. **Acyclic production graph.** No dependency cycle among any `@qflow/*` packages.

2. **Domain-neutral Core closure.** Layer 1 contains only `protocol` and `core`; `core` depends only
   on `protocol`. Compiler and Runtime may also be domain neutral, but they remain outside Core.

3. **CLI independence.** Neither `@qflow/cli` nor `@qflow/video-cli` transitively depends on any
   Provider package. The video CLI also does not depend on any author-level video package
   (`@qflow/script`, `@qflow/seedance`, `@qflow/media-track`, `@qflow/typography-track`, `@qflow/film`).
   Author packages are activated through Source imports, not compile-time CLI
   dependencies. These rules are kept visible in package manifests and reviewed as architecture,
   rather than approximated by source-text regex tests.

## Package anatomy

Every package lives under `packages/<name>/` with this structure:

```text
packages/example/
├── package.json
├── src/
│   ├── index.ts          public API entry point
│   └── activation.ts     package contribution descriptor (if installable)
└── test/
    └── example.test.ts
```

### package.json

```json
{
  "name": "@qflow/example",
  "version": "0.0.0-dev",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "qflow": {
    "activation": "./src/activation.ts"
  },
  "dependencies": {
    "@qflow/protocol": "workspace:*"
  }
}
```

- `"exports"` points to TypeScript source directly during development. pnpm's workspace links resolve
  `@qflow/*` imports through the dependency declared by the importing package.
- `"qflow.activation"` is the entry point that the Package Loader reads when this package is
  selected. It must default-export a `NodePackageContribution`.
- The physical package version remains `0.0.0-dev` until publication. Module and Frontend manifests
  use the independent logical protocol version `1`.

### activation.ts

Every installable package exports a passive contribution descriptor — an inventory of what it
offers, not an authority grant. See [Adding an author package](./author-packages.md) and
[Adding a Provider](./providers.md) for concrete examples.

## Five package facets

A physical package may expose independently activated facets:

| Facet | ABI | Authority | Selected by |
|---|---|---|---|
| `static` | Manifest and identity | none | always available after loading |
| `author` | Frontend, Surface, Graph Fragment | author vocabulary only | source `<import>` through the compiler Host |
| `compute` | deterministic Producer, Type Validator | pure computation | compiler Host |
| `endpoint` | privileged external capability | network, filesystem, process, credentials | Runtime Profile |
| `infrastructure` | Scheduler, Worker and Store implementation | persistence, scheduling | Runtime Profile |

A source `<import>` activates only author facets. It never grants network, filesystem, process,
credential or queue authority.

## Package selection

Qflow does not maintain a package registry or a second package-resolution layer. npm or pnpm
installs packages and owns their versions and integrity. Qflow has two explicit selection paths:

| Selection | Packages activated |
|---|---|
| Source imports | Frontends, Surfaces, Producers and Validators |
| Runtime Profile `use` | Runtime Hosts, infrastructure and Provider Endpoints |

A Source import never grants network, filesystem, process, credential or queue authority. Those
remain available only to packages explicitly selected by the Runtime Profile.

### Logical package addresses and Source discovery

Source code names logical language capabilities. By convention the logical name maps directly to
the installed npm package name. A Module and a Run Fragment may share a spelling because their Host
ABIs remain different, and one physical package may offer several logical names.

Compilation reads only the mandatory Source Header first. It resolves that Frontend from installed
packages, calls the Frontend's own `discover()` method, resolves the reported Modules,
Run Fragments and child Sources, and repeats until the exact package subset stops growing. Only
then does semantic decoding begin. Markup is the video Distribution's bootstrap Frontend; Script,
SVS, Run Markup and third-party Frontends otherwise follow the same discovery protocol. The package
selector contains no parser-specific branch.

Frontend implementations are not privileged fields in the physical package format. They advertise
the ordinary `qflow.source-frontend@1` Host facet, exactly as Run Fragments, Markup Surfaces and
Runtime Adapters advertise their own Host ABIs. Only the Source Host interprets that facet.

Runtime Profiles follow the same rule. Each `use` selects a Runtime Host, Endpoint Adapter or
Runtime Infrastructure ABI plus a logical name. A physical npm package advertises that logical
offer. The generic CLI therefore
does not contain a Provider registry, and different Adapter kinds may share
a logical spelling without colliding.

The loader never downloads packages and never scans unrelated installed dependencies for plugins.
It loads only packages selected by Source discovery or the Runtime Profile, plus exact Module
dependencies declared by those packages.
