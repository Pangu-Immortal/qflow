import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadNodePackageSelection } from "@qflow/loader/node";

async function installedPackage(
  root: string,
  name: string,
  contribution: string,
  dependencies: Readonly<Record<string, string>> = {},
): Promise<void> {
  const directory = join(root, "node_modules", name);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "package.json"), JSON.stringify({
    name,
    version: "1.0.0",
    type: "module",
    exports: "./activation.mjs",
    qflow: { activation: "./activation.mjs" },
    dependencies,
  }), "utf8");
  await writeFile(join(directory, "activation.mjs"), `export default ${contribution};\n`, "utf8");
}

async function projectPackage(
  root: string,
  name: string,
  contribution: string,
  dependencies: Readonly<Record<string, string>> = {},
): Promise<void> {
  const directory = join(root, "packages", name.split("/").at(-1)!);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "package.json"), JSON.stringify({
    name,
    version: "0.0.0-dev",
    type: "module",
    qflow: { activation: "./activation.mjs" },
    dependencies,
  }), "utf8");
  await writeFile(join(directory, "activation.mjs"), `export default ${contribution};\n`, "utf8");
}

test("loads an explicitly selected installed package", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-package-loader-"));
  try {
    await installedPackage(root, "example-cards", `{
      format: "qflow.package@1",
      facets: [{ abi: "example.cards@1", offers: ["cards"] }]
    }`);
    const loaded = await loadNodePackageSelection(["example-cards"], root);
    assert.deepEqual(loaded.map((item) => item.specifier), ["example-cards"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an embedded Distribution package resolves a dependency installed with its Distribution", async () => {
  const project = await mkdtemp(join(tmpdir(), "qflow-cli-only-project-"));
  const distribution = await mkdtemp(join(tmpdir(), "qflow-cli-only-distribution-"));
  try {
    await projectPackage(distribution, "@qflow/provider-example", `{
      format: "qflow.package@1",
      facets: [{ abi: "example.provider@1", offers: ["example"] }]
    }`, { "cli-only": "1.2.3" });
    const cli = join(distribution, "node_modules", "cli-only");
    await mkdir(join(cli, "bin"), { recursive: true });
    await writeFile(join(cli, "package.json"), JSON.stringify({
      name: "cli-only",
      version: "1.2.3",
      type: "module",
      bin: { "cli-only": "./bin/cli.mjs" },
    }), "utf8");
    await writeFile(join(cli, "bin", "cli.mjs"), "export {};\n", "utf8");
    const loaded = await loadNodePackageSelection(["@qflow/provider-example"], project, {
      fallbackRoots: [distribution],
    });
    assert.deepEqual(loaded.map((item) => item.specifier), ["@qflow/provider-example"]);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(distribution, { recursive: true, force: true });
  }
});

test("resolves a logical request to its conventional installed package", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-package-selection-"));
  try {
    await installedPackage(root, "example-provider", `{
      format: "qflow.package@1",
      facets: [{ abi: "example.endpoint@1", offers: ["example-provider"] }]
    }`);
    const loaded = await loadNodePackageSelection({
      selected: [],
      logical: [{ abi: "example.endpoint@1", name: "example-provider" }],
    }, root);
    assert.deepEqual(loaded.map((item) => item.specifier), ["example-provider"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("loads an explicit project package without linking it into the Distribution", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-project-package-"));
  try {
    await projectPackage(root, "@acme/cards", `{
      format: "qflow.package@1",
      facets: [{ abi: "example.cards@1", offers: ["cards"] }]
    }`);
    const loaded = await loadNodePackageSelection(["@acme/cards"], root);
    assert.deepEqual(loaded.map((item) => item.specifier), ["@acme/cards"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("falls back to an explicit read-only Distribution root", async () => {
  const project = await mkdtemp(join(tmpdir(), "qflow-project-root-"));
  const distribution = await mkdtemp(join(tmpdir(), "qflow-distribution-root-"));
  try {
    await installedPackage(distribution, "@qflow/cards", `{
      format: "qflow.package@1",
      facets: [{ abi: "example.cards@1", offers: ["cards"] }]
    }`);
    const loaded = await loadNodePackageSelection(["@qflow/cards"], project, {
      fallbackRoots: [distribution],
    });
    assert.deepEqual(loaded.map((item) => item.specifier), ["@qflow/cards"]);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(distribution, { recursive: true, force: true });
  }
});

test("a project-installed official extension wins over the Distribution fallback", async () => {
  const project = await mkdtemp(join(tmpdir(), "qflow-project-root-"));
  const distribution = await mkdtemp(join(tmpdir(), "qflow-distribution-root-"));
  try {
    await installedPackage(project, "@qflow/cards", `{
      format: "qflow.package@1",
      facets: [{ abi: "example.cards@1", offers: ["project-shadow"] }]
    }`);
    await installedPackage(distribution, "@qflow/cards", `{
      format: "qflow.package@1",
      facets: [{ abi: "example.cards@1", offers: ["distribution"] }]
    }`);
    const loaded = await loadNodePackageSelection(["@qflow/cards"], project, {
      fallbackRoots: [distribution],
    });
    assert.deepEqual(loaded.map((item) => item.specifier), ["@qflow/cards"]);
    assert.deepEqual(loaded[0]!.contribution.facets?.[0]?.offers, ["project-shadow"]);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(distribution, { recursive: true, force: true });
  }
});

test("an exact package embedded by the active Distribution cannot be shadowed", async () => {
  const project = await mkdtemp(join(tmpdir(), "qflow-project-root-"));
  const distribution = await mkdtemp(join(tmpdir(), "qflow-distribution-root-"));
  try {
    await installedPackage(project, "@qflow/cards", `{
      format: "qflow.package@1",
      facets: [{ abi: "example.cards@1", offers: ["project-shadow"] }]
    }`);
    await projectPackage(distribution, "@qflow/cards", `{
      format: "qflow.package@1",
      facets: [{ abi: "example.cards@1", offers: ["embedded-host"] }]
    }`);
    const loaded = await loadNodePackageSelection(["@qflow/cards"], project, {
      fallbackRoots: [distribution],
    });
    assert.deepEqual(loaded[0]!.contribution.facets?.[0]?.offers, ["embedded-host"]);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(distribution, { recursive: true, force: true });
  }
});

test("official extensions use the Build module scope while embedded host packages stay shared", async () => {
  const project = await mkdtemp(join(tmpdir(), "qflow-project-root-"));
  const distribution = await mkdtemp(join(tmpdir(), "qflow-distribution-root-"));
  try {
    await installedPackage(distribution, "@qflow/cards", `{ format: "qflow.package@1" }`);
    await projectPackage(distribution, "@qflow/facet-cards", `{ format: "qflow.package@1" }`);
    const scoped: string[] = [];
    const importModule = async (url: string): Promise<unknown> => {
      scoped.push(url);
      return await import(url);
    };
    await loadNodePackageSelection(["@qflow/cards"], project, {
      fallbackRoots: [distribution], importModule,
    });
    assert.equal(scoped.length, 1);
    await loadNodePackageSelection(["@qflow/facet-cards"], project, {
      fallbackRoots: [distribution], importModule,
    });
    assert.equal(scoped.length, 1);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(distribution, { recursive: true, force: true });
  }
});
