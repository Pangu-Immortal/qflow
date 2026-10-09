import { execFileSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/** Publication consumes CI's existing result; it never reconstructs an unverified candidate. */
export function selectReleaseRun(runs, { repository, commit }) {
  const run = runs.find((candidate) => candidate.repository?.full_name === repository
    && candidate.head_repository?.full_name === repository
    && candidate.path?.split("@")[0] === ".github/workflows/ci.yml"
    && candidate.head_branch === "main"
    && ["push", "workflow_dispatch"].includes(candidate.event)
    && candidate.status === "completed" && candidate.conclusion === "success"
    && (commit === undefined || candidate.head_sha === commit));
  if (run === undefined) {
    throw new Error("No successful main CI candidate matches this request. Run CI on the intended commit first.");
  }
  return run;
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("GITHUB_REPOSITORY is required.");
  const release = process.env.GITHUB_EVENT_NAME === "release";
  if (release && process.env.RELEASE_PRERELEASE === "true") throw new Error("Only stable releases are supported.");
  const requested = process.env.CANDIDATE_RUN?.trim();
  if (!release && !/^\d+$/.test(requested ?? "")) throw new Error("Select an explicit successful CI run ID.");
  const api = (path) => JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8" }));
  const commit = release ? process.env.GITHUB_SHA : undefined;
  if (release && !commit) throw new Error("Release commit is required.");
  const runs = release
    ? api(`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${commit}&branch=main&status=success&per_page=100`).workflow_runs
    : [api(`repos/${repository}/actions/runs/${requested}`)];
  const run = selectReleaseRun(runs, { repository, commit });
  execFileSync("git", ["merge-base", "--is-ancestor", run.head_sha, "origin/main"]);
  const artifacts = api(`repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`).artifacts;
  if (!artifacts.some((artifact) => artifact.name === "npm-package" && !artifact.expired)) {
    throw new Error("The tested npm-package artifact is missing or expired. Run CI again; publication does not rebuild it.");
  }
  console.log(`Using tested candidate from ${run.html_url} (${run.head_sha}).`);
  await appendFile(process.env.GITHUB_OUTPUT, `run_id=${run.id}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
