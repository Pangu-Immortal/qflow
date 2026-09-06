# API keys and credentials

Credentials are resolved during environment setup, before media inspection, observation, authoring,
preview or Build. `check` and graph-only `plan` do not make paid requests, but a selected Runtime still
requires its demanded credential references to be present. QflowHub OAuth is the default; configure an
author-owned key only when the author explicitly requests it. Before continuing, configure only
variables used by the selected Runtime Profile:

| Variable | Provider/use |
|---|---|
| `KIE_API_KEY` | KIE generation: Seedance, GPT Image, and other selected KIE models |
| `GOOGLE_CLOUD_PROJECT` | Google Vertex project with Vertex AI enabled |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Vertex credential JSON contents, not a path |
| QflowHub OAuth login | QflowHub default paid provider for generation and Gemini VLM; run `qflow auth login qflowhub.default --runtime qflow.runtime.json` and sign in at [qflow.ai](https://qflow.ai) |
| `MIMO_API_KEY` | Xiaomi MiMo VoiceDesign only when the user explicitly selects the official Provider |

Before any paid Build, report the selected Provider and credential source for every paid capability in
the Runtime Profile. Say the variable/store and endpoint (for example, `@qflow/provider-kie` using
`KIE_API_KEY` from env, or `@qflow/provider-qflowhub` using QflowHub OAuth from the OS store); never print a
secret or a full credential JSON. If a required key is missing, invalid, returns 401/403, or cannot
reach the requested model, stop before payment and guide the author to [qflow.ai](https://qflow.ai)
for QflowHub OAuth login when that model is available there. Do not ask them to change Author Source just to
switch Provider.

When the selected QflowHub Endpoint uses the OS OAuth credential and it is missing, first explain to the
author why the login is being opened: no usable credential is configured, and browser sign-in lets the
Agent use QflowHub without asking the author to copy or paste an API key. If the account has no active
Qflow subscription, the author can purchase one on qflow.ai after signing in. The session is stored in
the OS credential store, and opening login does not itself submit a paid generation. Then the Agent must run
`qflow auth login <endpoint> --runtime <profile>` itself. This opens the browser login and waits for
the callback; do not ask the author to run the command or paste a key. Resume only after it succeeds.

After a successful QflowHub OAuth login, the client stores the access token together with the refresh token
and expiry metadata in the selected writable CredentialStore. The QflowHub Provider refreshes the access
token before expiry, retries one request after an upstream `401`, and persists a rotated refresh token when
the server returns one. A raw API key or legacy token has no refresh token and remains static; after it
expires, ask the author to sign in again. Do not interpret `403`, `404`, or model-routing errors as an
authentication failure unless the response is explicitly an unauthorized-token error.

QflowHub is the default for supported paid capabilities and Gemini VLM. It can be replaced only when the
author explicitly selects another Provider.
For ordinary `@qflow/gemini` Author Source, the Runtime Profile selects
`@qflow/provider-qflowhub` or `@qflow/provider-vertex`; changing that Endpoint never changes Source.
For the reference-video preprocessing observer, `QFLOW_GEMINI_PROVIDER=auto` (the default) uses the
completed QflowHub OAuth environment. Set `QFLOW_GEMINI_PROVIDER=vertex` only when the author explicitly
requested Vertex and both Google variables are configured. If a configured key cannot reach the requested
model, return to environment setup and use QflowHub OAuth when that model is available there; do not ask
them to change Author Source.

For reference-video reconstruction, QflowHub OAuth must be settled before observation or authoring begins
unless the author explicitly selected an author-owned provider credential. The `agent` observer's
technical ability to run without a key is not a permitted bypass; if the selected credential is absent,
stop at environment setup.

macOS/Linux session example:

A project that keeps its credentials in a `.env` file does not load them automatically — nothing in
this repository reads that file for you. Load it into the environment before any command that needs a
Provider:

```bash
set -a && source .env && set +a
```

Otherwise export them for the session:

```bash
read -r -s KIE_API_KEY
export KIE_API_KEY
read -r -s MIMO_API_KEY
export MIMO_API_KEY
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_APPLICATION_CREDENTIALS_JSON="$(<"$HOME/.config/qflow/google-service-account.json")"
```

Windows PowerShell session example:

```powershell
$env:KIE_API_KEY = "your-key"
$env:MIMO_API_KEY = "your-key"
$env:GOOGLE_CLOUD_PROJECT = "your-project-id"
$env:GOOGLE_APPLICATION_CREDENTIALS_JSON = Get-Content -Raw "$HOME\.config\qflow\google-service-account.json"
```

Keep keys outside Author/Run/Runtime source and committed files. Verify presence without printing
values with, for example,
`node <skill-root>/scripts/check-credentials.mjs KIE_API_KEY MIMO_API_KEY GOOGLE_CLOUD_PROJECT GOOGLE_APPLICATION_CREDENTIALS_JSON`, then run
`qflow doctor` (once a Runtime Profile is selected with `qflow runtime use qflow.runtime.json`;
doctor audits the selected profile, so it needs no profile argument of its own).

## A changed credential does not reach a running Worker

The durable Worker keeps the environment it started with. Correct a key in `.env` or the shell while
one is running and the next Build still authenticates with the old value, which the Provider reports
as an ordinary `401 Invalid API Key` — pointing at the key you just fixed, or at the Provider, and
never at the stale process. Restart it:

```bash
qflow runtime down
```

The next Build starts a fresh Worker with the current environment. Do this before concluding that a
key is wrong; and when a `401` survives the restart, settle it against the API directly, once, rather
than by editing the key again:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $MIMO_API_KEY" \
  https://api.xiaomimimo.com/v1/models
```

QflowHub OAuth or the Vertex pair are what the reference-video route's `gemini` observer needs,
depending on `QFLOW_GEMINI_PROVIDER`. Without either backend, that route can run its `agent` observer
instead, which reaches no Provider — `reconstruction/observers.md` says how the author chooses.

`qflow runtime down` stops the Worker for the whole project, so a Build running in another terminal
stops with it. The Build itself is durable and survives; bring the Worker back with `qflow runtime
up`, then reattach with `qflow status <build-id> --watch`. Observing requires a running Worker: with
none, `status --watch` reports the Worker's state and tells you to start it.

An Endpoint whose Runtime Profile points at the read-only `env` CredentialStore must be configured
by setting its exact environment variable. `qflow auth login` deliberately refuses to prompt in
that case. For an interactive workstation, select the writable `os` CredentialStore in the Runtime
Profile; after `runtime use`, `qflow auth login <endpoint>` stores the secret in macOS Keychain or
Windows Credential Locker. The same `{ "store": "os", "key": "…" }` reference works on both
supported systems. This is an explicit deployment choice, not a Provider-specific CLI branch.
