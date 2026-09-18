import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { canonicalize } from "@qflow/protocol";
import { verifyHyperframesFramesRequest } from "@qflow/render-hyperframes";
import { runSnapshotCli } from "../src/snapshot.js";
import type { CreationEnvironment } from "../src/creation.js";

const html = '<!doctype html><div data-composition-id="test" data-fps="30000/1001" data-qflow-frame-count="12" data-width="96" data-height="64"><img src="still.png"></div>';

test("snapshot invokes the selected Profile once and writes original-frame PNGs and paginated grids", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qflow-snapshot-cli-"));
  const bytes = await sharp({ create: { width: 96, height: 64, channels: 3, background: "#264a71" } }).png().toBuffer();
  let calls = 0;
  let output = "";
  try {
    await writeFile(join(directory, "index.html"), html);
    await writeFile(join(directory, "still.png"), bytes);
    const environment: CreationEnvironment = { cwd: directory, openHost: async (profile, workspace) => {
      assert.equal(profile, "selected.json");
      assert.equal(workspace, "project");
      return { profile: "selected.json", host: {
        providers: async requests => requests.map(request => ({ request: request.request, capability: request.capability,
          status: "resolved", endpoint: "chosen.frames", use: "@example/frames", pricing: { kind: "local" } })),
        invoke: async (need, resources) => {
          calls++;
          assert.equal(need.capability.name, "render-frames");
          verifyHyperframesFramesRequest(need.constraints);
          assert.deepEqual(need.constraints.frames, [3, 5, 7, 9, 11]);
          assert.ok("project" in need.constraints);
          const asset = need.constraints.project.assets[0]!;
          assert.deepEqual(Buffer.from((await resources.get(asset.artifact.resource))!), bytes);
          return { value: { kind: "inline", value: canonicalize(await Promise.all(need.constraints.frames.map(() => resources.put(bytes, "image/png")))) } };
        },
      } };
    } };
    await runSnapshotCli(["snapshot", "index.html", "--start-frame", "3", "--end-frame-exclusive", "12", "--step-frames", "2",
      "--grid", "2x2", "--cell", "96", "--to", "evidence", "--runtime", "selected.json", "--workspace", "project", "--json"], {
      write: text => { output += text; },
    }, environment);
    assert.equal(calls, 1);
    const view = JSON.parse(output);
    assert.equal(view.endpoint, "chosen.frames");
    assert.equal(view.frames[0].seconds, 3 * 1001 / 30000);
    assert.equal(view.grids.length, 2);
    assert.equal((await readdir(join(directory, "evidence"))).length, 7);
    assert.deepEqual(await readFile(view.frames[0].path), bytes);
    assert.equal((await sharp(view.grids[0]).metadata()).width, 216);
    await assert.rejects(runSnapshotCli(["snapshot", "index.html", "--at-frame", "12", "--to", "bad"], { write() {} }, environment), /\[0, 12\)/u);
    await assert.rejects(runSnapshotCli(["snapshot", "index.html", "--at-frame", "3,3", "--to", "bad"], { write() {} }, environment), /strictly increasing/u);
    assert.equal(calls, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("snapshot reports a missing binding before invocation and preserves existing output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qflow-snapshot-error-"));
  try {
    await writeFile(join(directory, "index.html"), html.replace('<img src="still.png">', ""));
    const environment: CreationEnvironment = { cwd: directory, openHost: async () => ({ profile: "empty.json", host: {
      providers: async () => [], invoke: async () => { throw new Error("must not run"); },
    } }) };
    await assert.rejects(runSnapshotCli(["snapshot", "index.html", "--at-frame", "0", "--to", "new"], { write() {} }, environment), /No Endpoint/u);
    await assert.rejects(runSnapshotCli(["snapshot", "index.html", "--at-frame", "0", "--to", "index.html"], { write() {} }, environment), /already exists/u);
    assert.deepEqual(await readdir(directory), ["index.html"]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Studio snapshots carry declared resources used only inside JavaScript data", async t => {
  const directory = await mkdtemp(join(tmpdir(), "qflow-studio-snapshot-"));
  const bytes = await sharp({ create: { width: 96, height: 64, channels: 3, background: "red" } }).png().toBuffer();
  const artifact = { kind: "blob" as const, resource: "res_program_image" as const, size: bytes.length, mediaType: "image/png" };
  const document = { visualIr: "qflow.visual-ir@1", frameRate: { numerator: 30000, denominator: 1001 }, frameCount: 12,
    canvas: { width: 96, height: 64 }, artifacts: [artifact], surfaces: [],
    html: html.replace('<img src="still.png">', '<script>const input="qflow-resource://res_program_image";</script>') };
  const fetched: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    const url = String(input);
    fetched.push(url);
    if (url.endsWith("/__studio/document")) return Response.json(document);
    if (url.endsWith("/__studio/material/res_program_image")) return new Response(bytes);
    throw new Error(`Unexpected read ${url}`);
  });
  try {
    const environment: CreationEnvironment = { cwd: directory, openHost: async () => ({ profile: "selected.json", host: {
      providers: async requests => requests.map(request => ({ request: request.request, capability: request.capability,
        status: "resolved", endpoint: "frames", use: "@example/frames" })),
      invoke: async (need, resources) => {
        verifyHyperframesFramesRequest(need.constraints);
        assert.ok("document" in need.constraints);
        assert.deepEqual(need.constraints.document, document);
        assert.deepEqual(Buffer.from((await resources.get(artifact.resource))!), bytes);
        return { value: { kind: "inline", value: canonicalize([await resources.put(bytes, "image/png")]) } };
      },
    } }) };
    await runSnapshotCli(["snapshot", "--studio", "http://studio.example:5191/#comments", "--at-frame", "3", "--to", "evidence"], { write() {} }, environment);
    assert.deepEqual(fetched, ["http://studio.example:5191/__studio/document", "http://studio.example:5191/__studio/material/res_program_image"]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
