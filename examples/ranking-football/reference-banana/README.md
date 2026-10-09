# Banana reference variant

An independent ranking variant with a banana presenter. Read `reference-banana.svml`, its SVS
recipes, and `build.svrun` together; the Run starts with no generated media satisfied.

From this directory, install the locked dependencies and check the Run:

```sh
npm ci
npx qflow check build.svrun
```

The project installs `@qflow/ranking` from npm. Review its Runtime Profile and
`npx qflow plan build.svrun --runtime ./qflow.runtime.json` before paid execution.
