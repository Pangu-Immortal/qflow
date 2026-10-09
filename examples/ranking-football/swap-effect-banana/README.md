# Banana effect variant

An independent effect-swap variant built from the banana presenter. Read the SVML source, local SVS
recipes, and `reuse.svrun` together.

Run `npm ci` here to install the locked Qflow, `@qflow/ranking` and font dependencies.

From this directory, download the two existing performances before using `reuse.svrun`:

```sh
node ../download-reused-media.mjs
npx qflow check reuse.svrun
```

This writes the public example clips to `reused/`, where the Run selects them instead of generating
the same performances again. Downloaded videos stay outside Git.
Keep the parent `ranking-football` directory when copying this example so the downloader remains
available. Review `npx qflow plan reuse.svrun --runtime ./qflow.runtime.json` before executing the
remaining work; reusing these clips does not mean every other operation is already satisfied.
