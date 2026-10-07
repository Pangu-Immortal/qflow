import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runInstalledCliApplication } from "../src/installed-application.js";
import type { CliDistribution } from "../src/distribution.js";

const unusedDistribution = {
  bootstrapPackages: [],
  createCompiler() { throw new Error("compiler must not open in command contribution tests"); },
  async openRuntimeHost() { throw new Error("runtime must not open in command contribution tests"); },
  async openProjectResults() { throw new Error("results must not open in command contribution tests"); },
  async diagnoseProjectResults() { throw new Error("results must not open in command contribution tests"); },
} as unknown as CliDistribution;

async function fixture(command = "greet"): Promise<{
  readonly root: string;
  readonly distribution: string;
  readonly project: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "qflow-cli-composition-"));
  const distribution = join(root, "distribution");
  const project = join(root, "project");
  const extension = join(project, "node_modules", "@acme", "tools");
  await mkdir(distribution, { recursive: true });
  await mkdir(extension, { recursive: true });
  await writeFile(join(distribution, "package.json"), JSON.stringify({
    name: "@qflow/qflow", version: "0.3.0", qflow: { cli: { use: [] } },
  }));
  await writeFile(join(project, "package.json"), JSON.stringify({
    name: "example", private: true, devDependencies: { "@acme/tools": "1.2.3" },
    qflow: { project: true },
  }));
  await writeFile(join(extension, "package.json"), JSON.stringify({
    name: "@acme/tools", version: "1.2.3", type: "module", exports: { "./cli": "./cli.mjs" },
  }));
  await writeFile(join(extension, "cli.mjs"), `export const cliCommandModules = [{
    format: "qflow.cli-command@1",
    id: "@acme/tools",
    commands: [${JSON.stringify(command)}],
    writeRootHelp(io) { io.write("\\nAcme\\n  ${command} <name>\\n"); },
    writeHelp(_argv, io) { io.write("${command} help\\n"); },
    run(argv, io) { io.write("hello " + (argv[1] ?? "world") + "\\n"); }
  }];\n`);
  return { root, distribution, project };
}

test("the root Host enables and removes one installed project command contribution", async () => {
  const value = await fixture();
  try {
    const options = { distribution: unusedDistribution, distributionRoot: value.distribution, cwd: value.project };
    let selected = "";
    await runInstalledCliApplication(["cli", "use", "@acme/tools/cli"], {
      write: text => { selected += text; },
    }, options);
    assert.match(selected, /selected: @acme\/tools\/cli/u);
    const manifest = JSON.parse(await readFile(join(value.project, "package.json"), "utf8"));
    assert.deepEqual(manifest.qflow.cli.use, ["@acme/tools/cli"]);

    let output = "";
    await runInstalledCliApplication(["greet", "Qflow"], { write: text => { output += text; } }, options);
    assert.equal(output, "hello Qflow\n");

    let status = "";
    await runInstalledCliApplication(["cli", "status", "--json"], {
      write: text => { status += text; },
    }, options);
    assert.deepEqual(JSON.parse(status).contributions[0], {
      origin: "project", specifier: "@acme/tools/cli", package: "@acme/tools",
      version: "1.2.3", commands: ["greet"],
    });

    await runInstalledCliApplication(["cli", "remove", "@acme/tools/cli"], { write() {} }, options);
    await assert.rejects(
      runInstalledCliApplication(["greet"], { write() {} }, options),
      /Unknown command/u,
    );
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("installing a package does not grant commands before explicit project selection", async () => {
  const value = await fixture();
  try {
    await assert.rejects(runInstalledCliApplication(["greet"], { write() {} }, {
      distribution: unusedDistribution, distributionRoot: value.distribution, cwd: value.project,
    }), /Unknown command/u);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("a project command contribution cannot replace a root command", async () => {
  const value = await fixture("build");
  try {
    await assert.rejects(runInstalledCliApplication(["cli", "use", "@acme/tools/cli"], { write() {} }, {
      distribution: unusedDistribution, distributionRoot: value.distribution, cwd: value.project,
    }), /cannot replace generic command "build"/u);
    const manifest = JSON.parse(await readFile(join(value.project, "package.json"), "utf8"));
    assert.deepEqual(manifest.qflow, { project: true });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("a project cannot select a package that its package.json does not own", async () => {
  const value = await fixture();
  try {
    const manifestPath = join(value.project, "package.json");
    await writeFile(manifestPath, JSON.stringify({ name: "example", private: true, qflow: { project: true } }));
    await assert.rejects(runInstalledCliApplication(["cli", "use", "@acme/tools/cli"], { write() {} }, {
      distribution: unusedDistribution, distributionRoot: value.distribution, cwd: value.project,
    }), /not a direct dependency/u);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});
