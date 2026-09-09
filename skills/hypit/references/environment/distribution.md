# Executable Distribution

Read this to locate, install, or update the executable Qflow Distribution after installing the Skill.

## Keep three lifecycles separate

The installed Skill supplies production judgment. The executable Distribution supplies `qflow`,
`qflow studio`, official packages, and Runtime hosts. A video project supplies the work's Sources,
Runs, assets, local packages, Profile selection, and Results. They can live in unrelated locations
and none is installed as a side effect of another. `npx skills add qflow-ai/qflow -g` installs the
Skill's knowledge; the executable is the separate npm package `@qflow/qflow`.

## Find the installation already available

An available launcher can identify its version and physical locations:

```bash
qflow --version
qflow --help
qflow paths
```

`paths` includes the active Distribution, project, and host locations. A missing Runtime Profile is
a separate setup question from whether the executable is installed.

If the shell cannot find `qflow`, inspect the project's and npm's global package records:

```bash
npm ls @qflow/qflow --depth=0
npm ls --global @qflow/qflow --depth=0
npm prefix --global
```

A project installation can run through `npm exec --no -- qflow --version` and
`npm exec --no -- qflow paths`; `--no` declines npm's offer to install a missing package. A global
installation may need its executable directory added to the current shell's PATH: `<prefix>/bin`
on POSIX systems, or the prefix itself on Windows. Use the existing installation or its known
launcher, and retain the working command and location in project notes when useful for resuming.

## Install the executable package

The usual machine-wide installation command for a published release is:

```bash
npm install --global @qflow/qflow
```

A project can instead keep Qflow in its own dependencies and lockfile:

```bash
npm install --save-dev @qflow/qflow
npm exec --no -- qflow --help
```

Use the release version selected by the user or project when one is specified. If the selected
registry reports a missing package or version, that release is unavailable there. An official release
supplied as a tarball can be installed directly, for example
`npm install --global /path/to/qflow-release.tgz`. Report the actual installation error when the
release cannot be obtained.

## Let the installation channel own updates

Install, update, and remove the Distribution through the same package or release channel. Updating
it does not update an installed Skill or edit a video project. Updating the Skill does not replace the
executable Distribution. After installation or an update, use the selected launcher for `--version`,
`--help`, and `paths`, then continue with
`profile.md` for the current project's capabilities and Runtime choices.

The installed Distribution is the authority for exact Surface syntax. If a package or Surface named
by the Skill is absent from `qflow vocabulary`, report the version mismatch and update the selected
installation instead of inventing a translation.

A contributor checkout can execute its own Distribution after its documented workspace setup, but it
is a development arrangement, not an assumed location for ordinary production. Use one only when the
user explicitly supplied or selected that checkout.
