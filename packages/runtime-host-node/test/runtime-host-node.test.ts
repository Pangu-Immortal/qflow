import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  diagnoseRuntimeExecutable,
  qflowHostPackageRoot,
  parseRegistryPackageSpec,
  prepareHostPackages,
  resolveRuntimeExecutable,
} from "@qflow/runtime-host-node";

test("configured executable paths are rooted at the Runtime Profile project", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-runtime-host-node-"));
  try {
    const path = join(root, "tools", "fixture");
    await mkdir(join(root, "tools"), { recursive: true });
    await writeFile(path, "#!/bin/sh\n", "utf8");
    await chmod(path, 0o755);
    assert.equal(resolveRuntimeExecutable(root, "./tools/fixture"), path);
    assert.deepEqual(await diagnoseRuntimeExecutable({
      root,
      configured: "./tools/fixture",
      fallback: "unused",
      subject: "fixture",
    }), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("machine packages reuse exact releases without overwriting another version", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-machine-packages-"));
  try {
    const packageRoot = qflowHostPackageRoot(root);
    const installation = join(packageRoot, "hyperframes", "0.7.101");
    await mkdir(join(installation, "node_modules", "hyperframes"), { recursive: true });
    await writeFile(join(installation, "node_modules", "hyperframes", "package.json"), JSON.stringify({
      name: "hyperframes",
      version: "0.7.101",
    }));
    assert.deepEqual(parseRegistryPackageSpec("hyperframes@0.7.101"), {
      name: "hyperframes",
      version: "0.7.101",
      specifier: "hyperframes@0.7.101",
    });
    assert.throws(() => parseRegistryPackageSpec("@qflow/seedance@1.0.0"), /external npm registry package/u);
    const reports = await prepareHostPackages(["hyperframes@0.7.101"], { root: packageRoot });
    assert.equal(reports[0]?.action, "already-installed");
    assert.equal(reports[0]?.root, installation);
    const other = join(packageRoot, "hyperframes", "0.7.102");
    await mkdir(join(other, "node_modules", "hyperframes"), { recursive: true });
    await writeFile(join(other, "node_modules", "hyperframes", "package.json"), JSON.stringify({ name: "hyperframes", version: "0.7.102" }));
    assert.equal((await prepareHostPackages(["hyperframes@0.7.102"], { root: packageRoot }))[0]?.root, other);
    assert.equal((await prepareHostPackages(["hyperframes@0.7.101"], { root: packageRoot }))[0]?.action, "already-installed");
    assert.equal((await prepareHostPackages(["hyperframes@0.7.101", "hyperframes@0.7.102"], { root: packageRoot })).length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
