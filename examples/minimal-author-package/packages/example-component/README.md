# Example component fixture

A small complete package for learning Manifest, Surface, Fragment, Producer and activation wiring. Framework-facing imports come from
the narrow `@qflow/qflow/author`, `producer`, `admission` and `markup` subpaths; video-domain imports
use their owning `@qflow/qflow/*` subpaths. Its only Qflow
framework dependency is the released `@qflow/qflow` Distribution; TypeScript and Node types are ordinary
build tooling. No Runtime dependency is bundled into its tarball.

It contains a Module Manifest with nominal Types and deterministic Producers, validators, a structured
Surface decoder returning `records`, `components`, `fragments` and `exports`, and sealed Fragments with
literal `fragment-input`, `fragment-operation` and `output` references. `src/temporal.ts` shows the
Surface-side `@qflow/qflow/temporal/markup` Window/Moment projections; that package is distinct from the
graph-side `@qflow/qflow/temporal` Producers.

The Surfaces demonstrate a box, a text surface, an image slot and a Style decoder. The slot is a graph
input; it is not a file bundled by the package. `preview/Box.png` is a real catalogue frame supplied
by the package's vocabulary. `exampleAppendFragment` and `append-example-items` show a fixed-port
append that can be chained once per child.

`ImageSlot` deliberately accepts only an image Blob. A raw video Blob does not carry the frame
domain or target-to-source sampling relation required by a Visual video element; a component that
needs timed footage should consume normalized media or a typed Surface and author that relation
explicitly. The fixture stays small by not pretending those facts can be inferred from a MIME type.

While the component belongs to one project, keep this directory under that project's `packages/`
and use its owner-scoped package name. If the owner chooses to share it, compile and publish the same
package through npm or a private registry. Consumers install a chosen release with their ordinary
package manager and commit the resulting lockfile. The Source's logical Module import remains the
same whether the package is linked from the project workspace or installed from a registry.

## Use the included source outside the Qflow repository

Copy this directory into the video project's `packages/` and give the package and Module the owner's
name. The checked-in fixture's `workspace:*` dependency connects it to the repository during Qflow
development. In the copied package, replace that development dependency with the selected release:

```bash
npm install --save-dev @qflow/qflow@<selected-release>
npm run build
npm pack
```

If the selected Distribution was supplied as a tarball, use its path in the install command instead.
Installing it as a development dependency supplies public types; the consumer's active Qflow
Distribution supplies the runtime APIs. The resulting component tarball contains its own built code
and preview assets. For registry publication, select a release version and remove the fixture's
`private: true` after the owner chooses to publish it.

The active Distribution's `packages/ranking/README.md` is the richer example for semantic input
projection, persistent visual state and a Companion. Its README and source ship with that Distribution.
