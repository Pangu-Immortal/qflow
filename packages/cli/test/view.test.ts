import assert from "node:assert/strict";
import test from "node:test";

import type { BuildResultManifest, BuildResultRepository } from "@qflow/build-result";
import type { BuildView } from "@qflow/runtime-host-node";
import { buildResultView, buildStatusView } from "../src/view.js";

test("inspection chooses its scope before following any Output reference", async () => {
  const names = ["final", "important", ...Array.from({ length: 50 }, (_, i) => `unused-${i}`)];
  const manifest = {
    id: "bld_20260913T093030369Z_55907CDA9E", source: { path: "main.svml" },
    targets: ["final"], highlightedOutputs: ["important"],
    outputs: Object.fromEntries(names.map((name) => [name, {}])),
  } as unknown as BuildResultManifest;
  const reads: string[] = [];
  const repository = {
    async describeOutput(_build: string, name: string) {
      reads.push(name);
      if (name.startsWith("unused-")) throw new Error("unrelated reference is unavailable");
      return { kind: "scalar", type: { module: { name: "example", version: "1" }, name: "Value" } };
    },
  } as unknown as BuildResultRepository;
  const view = await buildResultView(repository, manifest, { projectRoot: "/project", limit: 1 });
  assert.deepEqual(reads, ["final", "important"]);
  assert.equal(view.outputCount, 52);
  assert.equal(view.otherOutputCount, 50);
  assert.equal(view.omittedOutputs, undefined);
  reads.length = 0;
  await buildResultView(repository, manifest, { projectRoot: "/project", limit: 1, output: "important" });
  assert.deepEqual(reads, ["important"]);
  reads.length = 0;
  const detailed = await buildResultView(repository, manifest, { projectRoot: "/project", limit: 1, verbose: true });
  assert.deepEqual(reads, ["final"]);
  assert.equal(detailed.omittedOutputs, 51);
});

test("status groups identical active requests and retains late failures without verbose", () => {
  const pending = Array.from({ length: 30 }, (_, index) => ({
    id: `op-${index}`, endpoint: "chosen", status: "pending", receipt: { id: `remote-${index}` },
    progress: { phase: "generating" },
  }));
  const runtime = {
    id: "build", targets: ["final"], activity: "running",
    operations: [...pending,
      { id: "done", endpoint: "chosen", status: "completed" },
      { id: "failed", endpoint: "chosen", status: "failed", receipt: { id: "failed-remote" },
        failure: { code: "NETWORK", message: "download failed" } }],
    commands: [{ id: "raw-command-id", endpoint: "renderer", progress: { phase: "capturing", completed: 50, total: 100, unit: "frames" } }],
  } as unknown as BuildView;
  const view = buildStatusView({ id: "build", runtime });
  assert.deepEqual(view.targets, ["final"]);
  assert.equal(view.operations?.length, 2);
  assert.equal(view.operations?.[0]?.count, 30);
  assert.equal(view.operations?.[0]?.receipt, undefined);
  assert.equal(view.operations?.[1]?.failure?.message, "download failed");
  assert.equal(view.operations?.[1]?.receipt?.id, "failed-remote");
  assert.equal(view.commands?.[0]?.progress.completed, 50);
  assert.equal(view.commands?.[0]?.id, undefined);
  const detailed = buildStatusView({ id: "build", runtime, verbose: true });
  assert.equal(detailed.operations?.length, 31);
  assert.equal(detailed.operations?.[0]?.receipt?.id, "remote-0");
});
