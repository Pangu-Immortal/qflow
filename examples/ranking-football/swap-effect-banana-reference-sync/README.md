# Banana effect reference-sync variant

An independent reference-synchronized effect variant. Its SVML/SVS/SVRun files describe the
composition and its explicitly reused performances.

Run `npm ci` here to install the locked Qflow, `@qflow/ranking` and font dependencies.

From this directory, download the two existing performances before using `build.svrun`:

```sh
node ../download-reused-media.mjs
npx qflow check build.svrun
```

This writes the public example clips to `reused/`, where the Run selects them instead of generating
the same performances again. Downloaded videos stay outside Git.
Keep the parent `ranking-football` directory when copying this example so the downloader remains
available. Review `npx qflow plan build.svrun --runtime ./qflow.runtime.json` before executing the
remaining work; reusing these clips does not mean every other operation is already satisfied.
