import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";

import { resolveNodePackageResource } from "@qflow/package-loader-node";

import { isVideoUrl } from "../src/download.js";

test("only http and https links are fetched; Windows paths stay files", () => {
  assert.equal(isVideoUrl("https://youtu.be/example"), true);
  assert.equal(isVideoUrl("http://example.test/clip.mp4"), true);
  assert.equal(isVideoUrl("C:\\clip.mp4"), false);
  assert.equal(isVideoUrl("c:\\clip.mp4"), false);
  assert.equal(isVideoUrl("file:///tmp/clip.mp4"), false);
  assert.equal(isVideoUrl("/tmp/clip.mp4"), false);
});

test("the pinned yt-dlp project is a Distribution package asset", () => {
  const project = dirname(resolveNodePackageResource(
    "@qflow/yt-dlp-service-runtime",
    "pyproject.toml",
    { from: import.meta.url },
  ));
  assert.ok(existsSync(join(project, "pyproject.toml")));
  assert.ok(existsSync(join(project, "uv.lock")));
});
