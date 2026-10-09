import assert from "node:assert/strict";
import test from "node:test";
import { selectReleaseRun } from "../select-release-run.mjs";

const repository = "qflow-ai/qflow";
const passed = {
  id: 42,
  repository: { full_name: repository },
  head_repository: { full_name: repository },
  path: ".github/workflows/ci.yml",
  head_branch: "main",
  head_sha: "tested-commit",
  event: "push",
  status: "completed",
  conclusion: "success",
};

test("a Release selects the successful CI for its exact commit", () => {
  const later = { ...passed, id: 43, head_sha: "later-commit" };
  assert.equal(selectReleaseRun([later, passed], { repository, commit: "tested-commit" }), passed);
  assert.throws(() => selectReleaseRun([later], { repository, commit: "tested-commit" }), /No successful/);
});

test("an explicit successful main CI can be published after main advances", () => {
  const manual = { ...passed, event: "workflow_dispatch" };
  assert.equal(selectReleaseRun([manual], { repository }), manual);
});

test("publication does not accept partial checks, PRs or another workflow's artifacts", () => {
  for (const difference of [
    { status: "in_progress" },
    { conclusion: "failure" },
    { event: "pull_request" },
    { head_branch: "feature" },
    { path: ".github/workflows/npm-package.yml" },
    { head_repository: { full_name: "someone/fork" } },
    { repository: { full_name: "someone/fork" } },
  ]) {
    assert.throws(() => selectReleaseRun([{ ...passed, ...difference }], { repository }), /No successful/);
  }
});
