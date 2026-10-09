---
title: Packages and Extension
description: How video projects select components, models and services as ordinary packages.
---

Qflow separates what a video asks for from the code and services that fulfill it. A new graphic,
model or API source can be supplied by a package and selected by the project. Each package owns its
interface and implementation; the execution system runs the resulting dependency graph.

## What belongs where

| Part | Responsibility | Where it is selected |
| --- | --- | --- |
| Author component | Turns author inputs into media requests, visual behavior or other graph outputs | Source imports |
| Model | Defines an exact generation request and its outputs | Source imports |
| Provider Endpoint | Executes supported requests through an API or local tool | Runtime Profile |
| Credential store | Resolves the named credentials for an Endpoint | Runtime Profile |
| Result repository | Keeps a project's Build records and produced files | Runtime implementation; Local Runtime uses project `.qflow/results` |
| Distribution | Supplies the executable applications and official packages | Installed `@qflow/qflow` release |

For example, a Model describes a requested video, while a Provider maps that request to a service.
A ranking component describes how a board behaves, while the renderer draws its contribution into
the final composition. Both participate in the same graph, with explicit inputs and outputs.

## Components follow the work

A video's spatial structure is organized where that organization is useful. Visual Track can present
an ordinary clip or picture; a project component can coordinate a moving video viewport, labels and
a diagram inside one scene. Independent captions or overlays can remain separate contributions.
Each component owns the content whose behavior belongs together.

For a spoken video, a Narrative Projection can reveal Script Selections and Moments as the absolute
Windows and Instants those components consume. An authored animation can produce the same values
directly from seconds or frames on its declared clock.
[Film and Rendering](../quickstart/composition.md) explains how these contributions fit together.

New components normally live in the video's `packages/` directory and use the owner's package
scope. The project declares them with its ordinary package manager. When cross-project reuse is
useful, the owner can publish the same component as a versioned npm or private-registry package.
The consumer installs a chosen version and keeps its lockfile with the project.

## Installation and Source imports

The Skill, executable Distribution and video project are installed and updated separately. The
`@qflow/qflow` Distribution embeds Core, installs product-selected default author packages as ordinary
npm dependencies, and exposes public extension APIs. Its selected Runtime adapters can prepare their
declared services and other runtime materials through
`qflow runtime up`. npm dependencies are installed with the package that owns them: Distribution
dependencies with the Distribution, and project component dependencies with the project.

Source uses a logical Module address such as `@your-studio/scoreboard@1`. npm's installed package
version selects the implementation; the logical `@1` identifies its author interface. Building a
video uses those installed versions. Missing packages are reported with the information needed to
install them.

When upgrading an existing production, read the selected release's migration notes before changing
its executable or component dependencies. The [0.3.1 project migration guide](https://github.com/qflow-ai/qflow/blob/main/migrations/0.3.1.md)
covers SDK import changes and verification while preserving existing material and Results.

## Write and share an extension

An external package develops against the narrow public owners it uses, such as
`@qflow/qflow/author`, `@qflow/qflow/producer`, `@qflow/qflow/admission`,
`@qflow/qflow/markup`, `@qflow/composition`, `@qflow/generation/model` or
`@qflow/qflow/endpoint`. Use the selected `@qflow/qflow` release as a
development dependency, compile the extension to JavaScript, and ship its own code and assets. Its
`package.json` names an activation entry describing what it provides. The active Distribution
supplies the public Qflow APIs when it loads the selected extension.

- [Adding an Author Package](./author-packages.md) starts from an included, buildable component.
- [Component Anatomy](./component-anatomy.md) explains the roles within a component.
- [Models and Providers](./providers.md) explains new models, services and credentials.
- [Runtime](./runtime.md) covers Endpoint and credential configuration.

Exact SDK types and implementation examples live with the corresponding package README and
repository source. An installed package supplies its public types and executable code.
