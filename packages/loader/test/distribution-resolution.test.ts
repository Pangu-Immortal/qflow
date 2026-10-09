import assert from "node:assert/strict";
import test from "node:test";

import { resolve } from "node:path";

import {
  installDistributionPackageResolution,
  resolveDistributionPackageImport,
} from "../src/node/distribution-resolution.js";

test("one Distribution resolves its internal and public package spellings", () => {
  assert.equal(
    resolveDistributionPackageImport(process.cwd(), "@qflow/recipe"),
    resolve(process.cwd(), "packages/recipe/src/index.ts"),
  );
  assert.equal(
    resolveDistributionPackageImport(process.cwd(), "@qflow/qflow/recipe"),
    resolve(process.cwd(), "packages/recipe/src/index.ts"),
  );
  assert.equal(resolveDistributionPackageImport(process.cwd(), "example-package"), undefined);
  assert.equal(resolveDistributionPackageImport(process.cwd(), "@qflow/script"), undefined);
  assert.equal(resolveDistributionPackageImport(process.cwd(), "@qflow/temporal"), undefined);
});

test("an external Author Package imports the active Distribution public API", async () => {
  installDistributionPackageResolution([process.cwd()]);
  const author = await import(String("@qflow/qflow/author")) as { readonly sealGraphFragment?: unknown };
  const composition = await import(String("@qflow/composition")) as { readonly sealVisualTrack?: unknown };
  assert.equal(typeof author.sealGraphFragment, "function");
  assert.equal(typeof composition.sealVisualTrack, "function");
});
