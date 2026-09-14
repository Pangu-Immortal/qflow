# `@qflow/package-loader-node`

Loads installed Qflow packages selected by source discovery or a Runtime Profile.

The user's package manager owns installation, versions and package bytes. This loader resolves only
the requested packages. An implementation package selected by Source discovery or a Runtime
Profile may expose `qflow.activation`; the loader imports that entry and validates the contribution
boundary consumed by Qflow. It never scans the dependency tree for plugins and is not a package
manager or registry.

A data-only package may instead expose an exact Source subpath through ordinary package `exports`.
The Host can resolve that one requested file without importing `qflow.activation` or granting the
package executable authority. Package-internal relative Sources and assets remain confined to the
package root. Executable activation and Source-data lookup are deliberately separate operations.

Module dependencies declared by selected packages are loaded from ordinary installed dependencies.
Syntax, components and Runtime facets remain inert until a matching Host ABI consumes them.

Physical lookup distinguishes package identity, ESM imports, package resources and npm executables.
It does not use a CommonJS root export as evidence that a package is installed: CLI-only,
import-only and resource-only packages are valid. The active Distribution owns `@qflow/*`;
Distribution code may use upstream dependencies from the machine npm home, while project packages
continue to resolve their own dependencies from the project.

The machine home stores `<package-name>/<exact-version>/node_modules`, with the importing package's
ordinary `dependencies` selecting the version. Loading a second Distribution does not replace an
existing release. ESM, resource and executable lookup use the same selection; project dependencies
retain ordinary project ownership. There is no inventory or source-content matching.

Runtime declaration discovery may use `deferExternalDependencies` to inspect capabilities and
Managed Programs before their execution tools are prepared. Actual JavaScript imports still follow
Node resolution and must be available. A selected Profile remains a valid package configuration;
Endpoint scoping is not permission to execute an invalid or absent Provider implementation.

## Execution-owned module scopes

`NodePackageLoadOptions.importModule` lets the Host own module lifetime while package selection and
contribution validation stay here. The default uses ordinary process imports. The local execution
Host supplies a `NodeModuleScope` for each Build: selected project packages and their transitive
JavaScript dependencies receive scope-local module identities. The installed `@qflow/*` Distribution
remains shared process code. Registries and configured adapter instances are still created per Build.

`NodeModuleScope` uses Node resolution/loading hooks and transpiles scope-owned TypeScript/TSX. Its CommonJS
bridge has a scope-owned module cache, Node-style named-export discovery and synchronous evaluation;
Node's VM dynamic-import support is enabled only for the execution carrier. Public paths such as
`import.meta.url`, `__filename` and relative asset reads remain real filesystem locations. Module
identity URLs are internal names; no copied source directory is created. Closing a scope drops its
live lookup and CommonJS table; the Host retires an empty carrier to release Node's ESM cache.

This is trusted execution, not a sandbox. Builtins, native libraries and process-global state
(including `process.cwd()` and `process.env`) remain shared. Existing module bindings do not change
under an active Build; a file or dependency first
read later uses ordinary filesystem semantics. Scoped loading does not make a project tree immutable.
