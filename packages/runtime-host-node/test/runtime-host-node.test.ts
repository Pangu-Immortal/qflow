import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("declared dependency installation environment reaches npm without changing the caller", {
  skip: process.platform === "win32",
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-package-install-env-"));
  const originalPath = process.env.PATH;
  const originalValue = process.env.QFLOW_TEST_INSTALL_OPTION;
  try {
    const npm = join(root, "npm");
    await writeFile(npm, `#!${process.execPath}
const fs = require('node:fs');
fs.writeFileSync('received.json', JSON.stringify({option: process.env.QFLOW_TEST_INSTALL_OPTION}));
fs.mkdirSync('node_modules/example-sdk', {recursive: true});
fs.writeFileSync('node_modules/example-sdk/package.json', JSON.stringify({name:'example-sdk', version:'1.2.3'}));
`);
    await chmod(npm, 0o755);
    process.env.PATH = root;
    const reports = await prepareHostPackages([{ specifier: "example-sdk@1.2.3", env: { QFLOW_TEST_INSTALL_OPTION: "selected" } }], { root: join(root, "packages") });
    assert.equal(JSON.parse(await readFile(join(reports[0]!.root, "received.json"), "utf8")).option, "selected");
    assert.equal(process.env.QFLOW_TEST_INSTALL_OPTION, originalValue);
    assert.equal("env" in reports[0]!, false, "installation parameters are not output metadata");
    await assert.rejects(prepareHostPackages([
      { specifier: "example-sdk@1.2.3", env: { OPTION: "a" } },
      { specifier: "example-sdk@1.2.3", env: { OPTION: "b" } },
    ], { root }), /Conflicting installation environment/u);
  } finally {
    if (originalPath === undefined) delete process.env.PATH; else process.env.PATH = originalPath;
    await rm(root, { recursive: true, force: true });
  }
});

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
