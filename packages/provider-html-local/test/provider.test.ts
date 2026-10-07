import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { mediaTypes, verifyTimelineVisual } from "@qflow/media";
import type { CompositableSurfaceRef, TimelineVisual } from "@qflow/media";
import { sealTimeline } from "@qflow/timeline";
import { sealComposition, sealVisualTrack } from "@qflow/composition";
import assert from "node:assert/strict";
import { MemoryResourceStore, EndpointRegistry } from "@qflow/executor";
import type { EndpointRegistration } from "@qflow/executor";
import type { ImmediateEndpointHandler } from "@qflow/endpoint";
import { compileHtmlProgram } from "@qflow/html-program";
import { htmlProgramCapabilities, htmlProgramTypes, htmlRasterRequest } from "@qflow/html-program";
import { canonicalize } from "@qflow/protocol";
import type { CanonicalValue, Need } from "@qflow/protocol";

import { createLocalHtmlProvider, rasterizeHtmlProgram } from "../src/index.js";
import { localHtmlBrowserProgram } from "../src/program.js";
import { browserExecutablePath } from "../src/browser.js";

const liveEnabled = process.env.QFLOW_BROWSER_TESTS === "1";
const hasFfprobe = spawnSync("ffprobe", ["-version"], { stdio: "ignore", windowsHide: true }).status === 0;

test("rendering with a missing selection fails without installing or substituting a browser", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qflow-missing-render-browser-"));
  try {
    for (const selection of [
      { browserVersion: "0.0.0.1", browserCacheDirectory: directory },
      { chromePath: join(directory, "missing-browser") },
    ]) {
      await assert.rejects(rasterizeHtmlProgram({ program: documentFixture() }, {
        ...selection, resources: new MemoryResourceStore(),
      }), /HTML browser is unavailable/u);
      assert.deepEqual(await readdir(directory), []);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("an explicit browser renders without installing a managed replacement", { skip: !liveEnabled || !hasFfprobe }, async () => {
  const chromePath = process.env.QFLOW_TEST_CHROME_PATH ?? browserExecutablePath({});
  const program = localHtmlBrowserProgram({ chromePath, id: "external", nodePath: process.execPath, ffprobePath: "ffprobe" });
  assert.equal(program.installation, undefined);
  assert.equal((await program.probe()).state, "ready");
  const diagnostics: string[] = [];
  const visual = await rasterizeHtmlProgram({ program: documentFixture() }, {
    chromePath, resources: new MemoryResourceStore(), workers: 1,
    onDiagnostic: async event => { diagnostics.push(event.message); },
  });
  assert.equal(visual.frameCount, 12);
  assert.ok(diagnostics.some(message => message.includes(`browser ${chromePath}`)));
});

function documentFixture(surface?: CompositableSurfaceRef) {
  const timeline = sealTimeline({ id: "test-space", frameCount: 12, frameRate: { numerator: 12, denominator: 1 },
  });
  const track = sealVisualTrack({ timelineId: "test-space",
    visualIr: "qflow.visual-ir@1",
    id: "provider-fixture",
    presents: [{
      id: "card",
      span: { startFrame: 0, endFrameExclusive: 12 },
      order: 0, z: 10,
      elements: [
        {
          id: "background",
          order: 0,
          kind: "box",
          style: [
            { name: "position", value: "absolute" },
            { name: "inset", value: 0 },
            { name: "background", value: "#261447" },
          ],
        },
        ...(surface === undefined ? [] : [{
          id: "surface",
          parent: "background",
          order: 1,
          kind: "surface" as const,
          surface,
          style: [
            { name: "position" as const, value: "absolute" },
            { name: "left" as const, value: "0px" },
            { name: "top" as const, value: "0px" },
            { name: "width" as const, value: "1px" },
            { name: "height" as const, value: "1px" },
          ],
        }]),
      ],
    }],
  });
  return compileHtmlProgram(sealComposition({
    id: "local-html-provider-fixture",
    canvas: { width: 160, height: 96, clearColor: "#000000" },
    tracks: [track],
  }), timeline);
}

function requestNeed(document = documentFixture()): Need {
  const constraints = htmlRasterRequest(document);
  return {
    id: "need:local-html-fixture",
    capability: htmlProgramCapabilities.rasterizeVisual,
    returns: mediaTypes.timelineVisual,
    constraints,
    result: "record:local-html-fixture",
  };
}

async function handlerFor(request: Need): Promise<{
  readonly handler: ImmediateEndpointHandler;
  readonly registration: EndpointRegistration;
}> {
  const registry = new EndpointRegistry();
  await createLocalHtmlProvider({
    workers: 2,
    defaultConcurrency: 1,
    processTimeoutMs: 120_000,
    ...(process.env.QFLOW_TEST_CHROME_PATH === undefined
      ? {} : { chromePath: process.env.QFLOW_TEST_CHROME_PATH }),
  }).install(registry);
  const resolution = registry.resolve(request);
  assert.equal(resolution.status, "resolved");
  assert.equal(resolution.registration.kind, "immediate");
  return { handler: resolution.registration.handler, registration: resolution.registration };
}

test("local HTML renderer Provider exposes visual and frame capabilities and two separate concurrency levels", async () => {
  const provider = createLocalHtmlProvider({ workers: 4, defaultConcurrency: 2 });
  assert.equal(provider.instance.id, "html.local");
  assert.deepEqual(provider.offers, [{
    capability: htmlProgramCapabilities.rasterizeVisual,
    returns: mediaTypes.timelineVisual,
    endpoint: "html.local",
  }, { capability: htmlProgramCapabilities.rasterizeFrames, returns: htmlProgramTypes.frameImages, endpoint: "html.local" }]);
  const resolved = await handlerFor(requestNeed());
  assert.equal(resolved.registration.scheduling?.resources.find((item) =>
    item.id.startsWith("pool:"))?.limit, 1,
    "Runtime request admission must remain separate from HTML renderer frame workers");
});

test("the selected HTML renderer Provider owns one idempotent browser installation", () => {
  const program = localHtmlBrowserProgram({
    id: "html.local",
    nodePath: process.execPath,
    ffprobePath: "ffprobe",
  });
  assert.equal(program.id, "html.local");
  assert.equal(program.start, undefined);
  assert.match(program.installation!.commands[0]!.args.at(-3)!, /browser-install\.js$/u);
});

test("local HTML renderer Provider really renders a silent frame-exact MP4 with parallel workers", {
  skip: !liveEnabled || !hasFfprobe,
}, async () => {
  const resources = new MemoryResourceStore();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const surfaceArtifact = await resources.put(png, "image/png");
  const surface: CompositableSurfaceRef = {
    artifact: surfaceArtifact,
    width: 1,
    height: 1,
    colorSpace: "srgb",
    alphaMode: "straight",
    timing: { kind: "still" },
  };
  const request = requestNeed(documentFixture(surface));
  const { handler } = await handlerFor(request);
  const output = await handler({
    command: { kind: "fulfill-need", id: "command:local-html-fixture", need: request },
    need: request,
    resources,
    credentials: {},
  });
  assert.equal(output.value.kind, "inline");
  const value: CanonicalValue = output.value.kind === "inline" ? output.value.value : canonicalize(null);
  verifyTimelineVisual(value);
  const visual = value as unknown as TimelineVisual;
  assert.equal(visual.frameCount, 12);
  assert.deepEqual(visual.canvas, { width: 160, height: 96 });
  assert.equal(await resources.has(visual.artifact.resource), true);
});
