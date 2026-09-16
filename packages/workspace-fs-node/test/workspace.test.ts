import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WorkspaceError } from "@qflow/workspace";
import { NodeFilesystemWorkspace } from "../src/index.js";

test("an in-root Source whose basename starts with .. is admitted", async () => {
  const parent = await mkdtemp(join(tmpdir(), "qflow-workspace-dotdot-name-"));
  const root = join(parent, "project");
  try {
    await mkdir(root);
    const entryPath = join(root, "..keep.svml");
    await writeFile(entryPath, "inside", "utf8");
    await writeFile(join(parent, "outside.svs"), "outside", "utf8");
    const session = await new NodeFilesystemWorkspace({ root }).open(entryPath);
    assert.equal(session.entry.text, "inside");
    await assert.rejects(
      async () => await session.resolveSource(session.entry, { from: "../outside.svs", alias: "escaped" }),
      (error: unknown) => error instanceof WorkspaceError && error.code === "SOURCE_OUTSIDE_ROOT",
    );
    await symlink(parent, join(root, "..linked"), "junction");
    await assert.rejects(
      async () => await session.resolveSource(session.entry, { from: "./..linked/outside.svs", alias: "linked" }),
      (error: unknown) => error instanceof WorkspaceError && error.code === "SOURCE_OUTSIDE_ROOT",
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
