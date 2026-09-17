# Repository analysis

This workflow provides preliminary advice about one issue or PR. A maintainer explicitly runs
**Repository analysis** in the Actions tab, chooses `issue` or `pr`, and supplies its number.
The result appears in that run's job summary. Run it again to request another analysis, including
when a PR has the same head commit or an issue is already closed.

## Data and authority

1. A trusted Node script reads the selected title, body and human comments through GitHub GET APIs.
   For PRs it also reads the diff, including deletions, and records the head/base being examined.
2. A separate step sends that text to the selected DeepSeek model through Chat Completions.
   The model receives no tools, GitHub credentials, shell, or executable instructions from us.
3. The script writes the returned prose as escaped text to `GITHUB_STEP_SUMMARY`.
   Model output is never evaluated or passed to a GitHub mutation API.

All GitHub token permissions are read-only. There are no issue comments, PR reviews, label changes,
closures, merges, command handlers, schedules or follow-up actions. Failed requests are reported
as failures; there is no automatic retry or switch to another model. There is no processed-content
hash, hidden comment state, label ownership table, cross-run recovery protocol or generated workflow.
Existing issue/PR management remains in the GitHub interface under maintainer control.

## Credentials

`DEEPSEEK_API_KEY` is an Actions repository Secret, supplied only to the inference step as an
HTTP Authorization header. It authorizes model usage against its owner's DeepSeek account; it
provides no GitHub permissions. The GitHub read step uses the run's short-lived `GITHUB_TOKEN`.
Checkout does not persist Git credentials, and the inference step does not receive `GH_TOKEN`.

Confirm the key's owner and billing authorization before enabling inference. The presence of a
Secret name does not identify its owner. GitHub secret-list metadata does not reveal the value.
The script never puts either credential in model messages or prints provider error response bodies.
No API key value belongs in source, workflow YAML or this document.

The workflow selects `deepseek-flash` and an 8192-token maximum output in its inference-step
configuration. It makes one request per manual run. Input comes from the selected public repository
material; actual token usage and billing belong to DeepSeek. This is independent of Qflow's video
Providers, Runtime Profiles and npm release.

## Scope of the analysis

The initial context includes up to 20,000 body characters, the latest 20 human comments (up to
2,000 characters each), and for PRs up to 50 available patches within 120,000 characters. Missing
patches and budget omissions are reported explicitly. GitHub list reads are limited to 20 pages;
exceeding this budget fails rather than pretending the entire discussion was examined.

This is a text-only preliminary pass. It does not retrieve adjacent code, execute tests or prove a
root cause. Its prompt requires evidence, uncertainty, material coverage limits and the next code
or evidence a maintainer should inspect. It cannot approve a PR or decide whether an issue deserves
to stay open. A full technical review remains separate work.

## Maintenance

- `.github/workflows/repository-analysis.yml`: manual entry, read permissions and model selection.
- `.github/automation/analysis.mjs`: GitHub reads, one model request and run-summary output.
- `.github/automation/analysis-prompt.md`: instructions for interpreting the supplied evidence.
- `.github/workflows/automation-check.yml`: offline tests, with no model secret or paid requests.

Run `node --test .github/automation/analysis.test.mjs`. These tests exercise the GET-only client,
fresh repeated analysis, deletion coverage, separation of credentials from model messages,
request failure handling and text-only report output. No package installation is required.

The implementation calls DeepSeek's documented [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/).
It has no gh-aw compiler, Claude Code runner, generated safe-output jobs or automatic governance.
