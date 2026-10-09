# Banana-from-swap variant

An independent ranking variant using the banana presenter. Its SVML, SVS, SVRun, and project Runtime
Profile describe the full generation and composition. `build.svrun` uses the authored generation
route; the neighboring `swap-effect-banana` variant demonstrates reuse of existing performances.

From this directory, install the locked dependencies and check the Run:

```sh
npm ci
npx qflow check build.svrun
```

The project installs `@qflow/ranking` from npm. Review its Runtime Profile and
`npx qflow plan build.svrun --runtime ./qflow.runtime.json` before paid execution.
