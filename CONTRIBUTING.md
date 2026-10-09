# Contributing to Qflow

[简体中文](./CONTRIBUTING.zh-CN.md)

Pull requests are welcome. Documentation, examples and translations count as much as code.

Video components normally live in the video project's `packages/` directory. When sharing one across
projects, publish it under your own npm scope or private registry and install a versioned release
through the project's package manager. Proposals for the official Distribution belong in an issue
that explains the shared production need.

## Before you start

Pick up an [open issue](https://github.com/qflow-ai/qflow/issues) or open one describing what you
want to work on. For anything that changes a protocol type, a package boundary or a Provider
contract, describe the approach in the issue first.

## Set up

You need Node.js 22.15+ and pnpm 10.33, selected by the root `packageManager` field.

```bash
corepack enable
pnpm install --frozen-lockfile
```

Live Builds additionally need Python 3.10–3.13, uv, ffmpeg and Chromium. The
[Development Guide](https://qflow.ai/guide/develop/) lists what each one is for.

For a Profile selecting local rendering, run `qflow programs up --runtime <profile> --endpoint
<render-instance>` before the first render (or `qflow runtime up --runtime <profile>` to prepare
the Profile and start its Worker). This explicitly prepares Chrome even when pnpm skips dependency
build scripts. `qflow doctor --runtime <profile>` diagnoses missing setup without installing it.
See the [local renderer README](packages/provider-html-local/README.md) for browser overrides.

## Make the change

| Where you are working | Guide |
| --- | --- |
| A new Author Package | [Adding an Author Package](https://qflow.ai/guide/author-packages/) |
| A new Provider | [Adding a Provider](https://qflow.ai/guide/providers/) |
| Component internals | [Component Anatomy](https://qflow.ai/guide/component-anatomy/) |
| Studio interface translations | [Localizing Studio](packages/studio/LOCALIZATION.md) |
| Compilation, Runs and Builds | [Runtime](https://qflow.ai/guide/runtime/) |
| Naming, module boundaries, wire data | [Conventions](https://qflow.ai/guide/conventions/) |
| Tests and environment-gated suites | [Testing](https://qflow.ai/guide/testing/) |

English and Chinese documentation live side by side under `docs/` and `docs/zh/`. A change to one
page belongs with the change to its counterpart.

## Check your work

CI runs these commands on every pull request. Run them locally first:

```bash
pnpm check         # TypeScript type-check
pnpm test          # package and service-adapter tests
```

## Package the Distribution

### SDK imports in 0.3.1

For an existing video project, follow the [Agent migration guide](migrations/0.3.1.md)
for the exact import mapping, dependency update and verification steps.

Video-domain SDKs are independently installed packages. Component code using a former root subpath,
such as `@qflow/qflow/composition`, must import from `@qflow/composition` and declare that package
in its own `dependencies`. The same applies to Timeline, Temporal, Spatial, Media, Narrative,
Caption, Generation, HTML Program, evidence and projection packages. Import the subpath exported by
the owning package when using an API such as `@qflow/temporal/markup` or `@qflow/temporal/studio`.
Generic host APIs remain under `@qflow/qflow/*`. Logical SVML module references retain their `@1`
identities; this change concerns npm ownership and TypeScript imports.

The root release is `0.3.1`, but this SDK import migration is not source-compatible with `0.3.0`.
Update the root and affected component dependencies together, then regenerate the project's ordinary
package-manager lockfile. New-architecture versions of existing domain packages use the `0.2.x`
line so that old `^0.1.1` dependencies do not silently select them. Previously embedded domain
packages start at `0.1.0`; packages that did not change keep their existing versions.

### Build and publish

Run `npm run pack:distribution` to build public types and write the release tarball to
`dist/release/`. This stages npm's selected files in a temporary directory and adapts the English
README for the npm page: public image URLs, both GIFs, and a link to the full video examples.
The repository READMEs remain unchanged. `dist/release/README.md` shows the packaged text.

With FFmpeg and FFprobe available, run
`npm run check:distribution -- dist/release/qflow-qflow-<version>.tgz` to install that tarball outside
the checkout, build its chat example component, prepare its font and local renderer, render and export
the video, and decode the result. It disables implicit Puppeteer downloads, checks missing-browser
diagnostics, and prepares the browser in an isolated cache. It uses a separate Qflow state directory, stops its Runtime Worker,
and retains the temporary project on failure. The `npm package execution` workflow runs this on PRs
and is reused by publication; publication uploads the same tarball that was installed and executed.

For a formal release, use the existing GitHub workflows. Commit the next stable npm version in
`package.json` to `main`, then run **Actions → Publish npm → Run workflow** with **Publish to npm**
unchecked to validate that exact commit on Linux and Windows. After it passes, open
**Releases → Draft a new release**, choose that commit with tag `v<version>` (for example `v0.1.8`),
write the release notes, and publish the Release. The tagged commit must contain this workflow.
`Publish npm` verifies the tag/version match and that the commit belongs to main's history, runs
repository checks and release-candidate construction in parallel, then installs and executes that
one candidate on Linux and Windows. It preflights every package in the release plan against npm,
publishes dependencies first and the Distribution last as `latest`, and attaches the Distribution
tarball to the Release. No npm write occurs unless every check, package installation and registry
preflight succeeds. Checks and packaging use the triggering commit, even if main advances meanwhile.
This path supports stable releases, not prereleases.

**Actions → Publish npm → Run workflow** on `main` remains available: enter the committed version
and leave **Publish to npm** unchecked for an optional package-only rehearsal and downloadable
candidate; check it for a manual npm publication. Both paths build the candidate once and make both
operating systems consume the same uploaded files. To finish a failed Release publication, fix the
external problem and rerun that Release's workflow. A failed check or package preflight does not
consume the npm version. If no
package from the candidate reached npm, the Release and tag may be withdrawn, the code fixed while
retaining the intended version, and the complete candidate validated again. If publication stops
after some independent packages, rerun the same immutable candidate: matching versions are skipped
and publication resumes in dependency order. Only after the root Distribution version exists on npm
does a root code change require a new patch version; a failed asset upload or other external step can
still be rerun without one. An existing Release attachment is retained.
Pushing main, pushing a tag alone, or saving a draft Release does not publish npm. The workflow
does not edit versions or create tags. A visible Release can precede successful npm publication;
check its Actions result before announcing that the npm version is available.

For an independent-package update, use the workflow's **packages** input with the exact space-separated
names to publish, such as `@qflow/studio`. The full candidate is still installed and checked, but only
the selected packages are preflighted and published; this does not require a new root version when
the existing root dependency ranges remain valid. Locally the equivalent selection is
`node scripts/publish-release-candidate.mjs dist/release/release-plan.json --package=@qflow/studio`.
Workspace release dependencies use explicit compatibility ranges, such as `workspace:^0.3.0`;
packing removes the workspace prefix without raising the minimum to the current checkout version.

The npm package's Trusted Publisher settings must allow GitHub Actions from organization `qflow-ai`,
repository `qflow`, workflow `publish-npm.yml`, with direct `npm publish` enabled and no environment
name. The publishing job uses OIDC; no npm token secret is needed. An already published version
cannot be overwritten. npm versions such as `0.1.2` are separate from the logical `@1` interfaces.

Trusted Publisher authority belongs to each npm package rather than to the `@qflow` scope. When a
new independently published package first enters the Distribution, prepare and check the exact
candidate locally, sign in with `npm login`, then run:

```sh
npm run publish:release-dependencies
npm run trust:release-dependencies -- --package=@qflow/new-package
```

The first command publishes only missing independent packages and never the root Distribution;
existing versions are skipped only when their registry integrity matches the candidate. The second
uses npm 11.15 or newer to bind the named package to this repository and workflow. Omit `--package`
only when bootstrapping every independent package in a new release plan. npm's first authorization
page can grant a five-minute window for the remaining package bindings; the command spaces requests
to stay within registry limits. This is package creation, not a normal release step. Do not retain a
long-lived npm publication token or publish the root Distribution from the workstation. After the
package bindings exist, rerun the Release workflow; it verifies matching immutable versions and
continues through OIDC.

Release notes should identify the changed user behavior and the affected installation. The npm
Distribution and an installed Skill update separately: link the relevant Skill changes and describe
both update paths when a release changes both. A saved video project and its existing materials
are independent of either installation. After publication, verify the workflow result and npm's
published version before telling users the update is available.

## Open the pull request

Branch names and commit subjects share the same prefix: `feat/`, `fix/`, `docs/` for branches and
`feat:`, `fix:`, `docs:` for commits.

## Issue and PR analysis

Maintainers can request a preliminary AI analysis of an issue or PR from the **Repository analysis**
Actions workflow. Its advice appears only in that run's summary; issue/PR management stays with
maintainers. See the [operator guide](.github/ISSUE_AUTOMATION_DESIGN.md) for inputs and limits.

## Getting help

Ask in [Discord](https://discord.gg/85hnyQnxpn) or [Telegram](https://t.me/qflowai).
