import assert from "node:assert/strict";
import test from "node:test";
import { releaseDependencyVersion } from "../release-dependencies.mjs";
import { selectReleasePackages, releaseCandidatePackages } from "../release-candidate.mjs";
import { distributionEmbeddedPackageDirectories } from "../distribution-ownership.mjs";
import { fileURLToPath } from "node:url";

test("release ranges preserve the author's compatibility minimum", () => {
  assert.equal(releaseDependencyVersion("script", "qflow", "workspace:^0.3.0"), "^0.3.0");
  assert.equal(releaseDependencyVersion("script", "caption", "workspace:0.0.0-dev"), "0.0.0-dev");
  assert.throws(() => releaseDependencyVersion("script", "qflow", "workspace:^"), /explicit compatibility/);
});

test("publication selection does not force a root or sibling release", () => {
  const plan = { independent: [{ name: "protocol" }, { name: "studio" }], distribution: { name: "root" } };
  assert.deepEqual(selectReleasePackages(plan, ["studio"]), [{ name: "studio" }]);
  assert.deepEqual(selectReleasePackages(plan, ["studio", "protocol"]), plan.independent);
  assert.throws(() => selectReleasePackages(plan, ["missing"]), /does not contain/);
});

test("default domain dependencies remain independent through the Video product", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const embedded = await distributionEmbeddedPackageDirectories(root);
  assert.equal(embedded.has("temporal"), false);
  assert.equal(embedded.has("narrative-temporal"), false);
  assert.equal(embedded.has("compiler"), true);
  const plan = await releaseCandidatePackages();
  const index = name => plan.independent.findIndex(item => item.name === `@qflow/${name}`);
  assert.ok(index("timeline") >= 0);
  assert.ok(index("timeline") < index("temporal"));
  assert.ok(index("temporal") < index("video"));
});
