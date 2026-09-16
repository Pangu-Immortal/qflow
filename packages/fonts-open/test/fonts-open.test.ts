import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeOpenFontFaceSurface,
  decodeOpenFontStackSurface,
} from "@qflow/fonts-open";
import type { FontArtifactRef, FontStackRef } from "@qflow/media";
import type { StructuredElement, StructuredSurfaceHandler } from "@qflow/markup";

const range = { start: 0, end: 80 };

async function decode(
  handler: StructuredSurfaceHandler,
  element: StructuredElement,
) {
  const requests: { readonly from: string; readonly bytes: Uint8Array }[] = [];
  const output = await handler({
    sourceName: "main.svml",
    element,
    resolveReference: () => undefined,
    resolveAsset(request) {
      assert.ok(request.bytes);
      const bytes = Uint8Array.from(request.bytes);
      requests.push({ from: request.from, bytes });
      return {
        artifact: {
          kind: "blob",
          resource: `res_font-${requests.length}`,
          size: bytes.byteLength,
          mediaType: request.mediaType,
        },
      };
    },
  });
  const stored = output.records[0]!.value;
  assert.equal(stored.kind, "inline");
  return { value: stored.kind === "inline" ? stored.value : undefined!, requests, output };
}

async function decodeFace(family: string, weight: string, style: string) {
  const result = await decode(decodeOpenFontFaceSurface, {
    kind: "element",
    name: "fonts:Face",
    attributes: { id: "selected", family, weight, style },
    children: [],
    range,
  });
  return { ...result, font: result.value as unknown as FontArtifactRef };
}

test("one Latin variable face contributes one exact installed source", async () => {
  const { font, requests } = await decodeFace("inter", "700", "italic");
  assert.equal(font.weight, 700);
  assert.equal(font.style, "italic");
  assert.equal(font.sources.length, 1);
  assert.equal(requests[0]!.from.endsWith("/inter-latin-wght-italic.woff2"), true);
  assert.ok(requests[0]!.bytes.byteLength > 10_000);
});

test("one CJK face preserves every Fontsource Unicode-range source", async () => {
  const { font, requests } = await decodeFace("noto-sans-sc", "700", "normal");
  assert.equal(font.sources.length, 101);
  assert.equal(requests.length, 101);
  assert.equal(font.sources.every((source) => source.unicodeRange?.startsWith("U+") === true), true);
  assert.ok(requests.reduce((total, request) => total + request.bytes.byteLength, 0) > 4_000_000);
});

test("static split CJK and color emoji faces retain their complete installed shards", async () => {
  const cjk = await decodeFace("zcool-kuaile", "400", "normal");
  assert.ok(cjk.font.sources.length > 10);
  const color = await decodeFace("noto-color-emoji", "400", "normal");
  assert.equal(color.font.sources.length, 11);
  assert.ok(color.requests.reduce((total, request) => total + request.bytes.byteLength, 0) > 1_500_000);
});

test("Stack makes exact CJK and emoji fallback a single reusable author edge", async () => {
  const result = await decode(decodeOpenFontStackSurface, {
    kind: "element",
    name: "fonts:Stack",
    attributes: { id: "caption-fonts", family: "inter", weight: "700", style: "normal", emoji: "color" },
    children: [{
      kind: "element",
      name: "fonts:Fallback",
      attributes: { family: "noto-sans-sc", weight: "700", style: "normal" },
      children: [],
      range,
    }],
    range,
  });
  const stack = result.value as unknown as FontStackRef;
  assert.equal(stack.faces.length, 3);
  assert.equal(stack.faces[0]!.weight, 700);
  assert.equal(stack.faces[1]!.sources.length, 101);
  assert.equal(stack.faces[2]!.sources.length, 11);
  assert.equal(stack.faces[2]!.weight, 400);
});

test("unavailable family, weight, style and emoji combinations fail before reading bytes", async () => {
  await assert.rejects(async () => await decodeFace("comic-sans", "700", "normal"), /family must be one of/u);
  await assert.rejects(async () => await decodeFace("bebas-neue", "700", "normal"), /weight is unavailable/u);
  await assert.rejects(async () => await decodeFace("manrope", "700", "italic"), /style is unavailable/u);
  await assert.rejects(async () => await decode(decodeOpenFontStackSurface, {
    kind: "element", name: "fonts:Stack",
    attributes: { id: "bad", family: "inter", weight: "700", style: "normal", emoji: "surprise" },
    children: [], range,
  }), /emoji must be color or mono/u);
});

test("font installation guidance applies only to absent packages and uses the owning manifest", async (t) => {
  const { cp, mkdir, mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const directory = await mkdtemp(join(tmpdir(), "qflow-font-installation-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const installed = join(directory, "node_modules", "@qflow", "fonts-open");
  await mkdir(join(installed, "src"), { recursive: true });
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  manifest.optionalDependencies["@fontsource-variable/inter"] = "9.8.7";
  await writeFile(join(installed, "package.json"), JSON.stringify(manifest));
  for (const name of ["surface.ts", "catalog.ts"]) {
    await cp(new URL(`../src/${name}`, import.meta.url), join(installed, "src", name));
  }
  for (const name of ["media", "package-loader-node"]) {
    const root = join(directory, "node_modules", "@qflow", name);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ name: `@qflow/${name}`, type: "module", exports: "./index.mjs" }));
    await writeFile(join(root, "index.mjs"), `export * from ${JSON.stringify(import.meta.resolve(`@qflow/${name}`))};`);
  }
  const module = await import(pathToFileURL(join(installed, "src", "surface.ts")).href);
  const face = () => decode(module.decodeOpenFontFaceSurface, {
    kind: "element", name: "fonts:Face", attributes: { id: "selected", family: "inter", weight: "700", style: "normal" },
    children: [], range,
  });
  await assert.rejects(face(), /qflow packages install @fontsource-variable\/inter@9\.8\.7/u);
  const font = join(directory, "node_modules", "@fontsource-variable", "inter");
  await mkdir(font, { recursive: true });
  await writeFile(join(font, "package.json"), JSON.stringify({ name: "@fontsource-variable/inter", version: "9.8.7" }));
  await assert.rejects(face(), error => {
    assert.match(String(error), /does not contain files/u);
    assert.doesNotMatch(String(error), /Install it once/u);
    return true;
  });
  await writeFile(join(font, "package.json"), "broken manifest");
  await assert.rejects(face(), SyntaxError);
});
