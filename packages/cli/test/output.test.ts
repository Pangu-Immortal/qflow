import assert from "node:assert/strict";
import test from "node:test";

import { renderCliError, writeCliHelp, writeCliOutput } from "../src/output.js";

function capture(
  options: Parameters<typeof writeCliOutput>[1],
  presentation: Parameters<typeof writeCliOutput>[2],
): string {
  let output = "";
  writeCliOutput({ write(text) { output += text; } }, options, presentation);
  return output;
}

const human = { json: false, color: "auto", verbose: false } as const;

test("author check keeps the default summary compact and reserves Output types for verbose", () => {
  const presentation = {
    kind: "check-author",
    machine: {
      format: "qflow.cli-check@1",
      sourceKind: "author",
      ok: true,
      source: "/project/main.svml",
      frontend: "@qflow/markup@1",
      units: 2,
      assets: 1,
      modules: 1,
      outputCount: 1,
      outputs: [{ name: "story", type: "@qflow/narrative@1/Narrative" }],
    },
  } as const;
  const output = capture(human, presentation);
  assert.match(output, /✓ Source is valid/u);
  assert.doesNotMatch(output, /story|@qflow\/narrative/u);
  assert.doesNotMatch(output, /resource|logical-output|res_/u);

  const verbose = capture({ ...human, verbose: true }, presentation);
  assert.match(verbose, /story\s+@qflow\/narrative@1\/Narrative/u);
});

test("JSON mode writes exactly the stable command view", () => {
  const machine = {
    format: "qflow.cli-doctor@1" as const,
    ok: false,
    project: "/project",
    profile: "/project/qflow.runtime.ts",
    diagnosticCount: 1,
    diagnostics: [{ severity: "error" as const, code: "MISSING", message: "not found" }],
  };
  const output = capture({ json: true, color: "always", verbose: true }, { kind: "doctor", machine });
  assert.deepEqual(JSON.parse(output), machine);
  assert.doesNotMatch(output, /Qflow Doctor|\u001b\[/u);
});

test("plan presents useful choices and readable requests without default graph internals", () => {
  const presentation = {
    kind: "plan",
    machine: {
      format: "qflow.cli-plan@1",
      ok: true,
      run: "/project/build.svrun",
      targetCount: 1,
      targets: ["take.video"],
      steps: 2,
      requestCount: 1,
      requestIssueCount: 0,
      preflight: {
        ok: true,
        capabilityCount: 1,
        capabilities: ["@qflow/media@1/inspect"],
        diagnosticCount: 0,
        diagnostics: [],
      },
      choiceCount: 1,
      choices: [{ output: "take.video", candidate: "preview" }],
      unreached: [{ output: "unused.image", operation: "@qflow/gpt-image@1/request-gpt-image-2" }],
    },
  } as const;
  const output = capture(human, presentation);
  assert.match(output, /take\.video\s+← preview/u);
  assert.match(output, /Requests\s+1/u);
  assert.match(output, /Preflight\s+ready/u);
  assert.doesNotMatch(output, /Runtime\s+ready/u);
  assert.doesNotMatch(output, /@qflow\/media|unused\.image|Declared but not reached|logical:|record:|step-/u);

  const verbose = capture({ ...human, verbose: true }, presentation);
  assert.match(verbose, /Requests\s+1/u);
  assert.match(verbose, /unused\.image/u);
});

test("plan names the Provider and price page behind each request, and points at --runtime when it cannot", () => {
  const base = {
    format: "qflow.cli-plan@1",
    ok: true,
    run: "/project/build.svrun",
    targetCount: 1,
    targets: ["take.video"],
    steps: 3,
    requestCount: 2,
    requestIssueCount: 0,
    choiceCount: 0,
    choices: [],
  } as const;
  const without = capture(human, { kind: "plan", machine: base });
  assert.match(without, /Pass --runtime <profile>/u);
  assert.doesNotMatch(without, /Providers and price pages/u);

  const output = capture(human, { kind: "plan", machine: { ...base, providerRequestCount: 2, localRequestCount: 1, unresolvedRequestCount: 0, unsupportedRequestCount: 1, providers: [
    {
      request: "seedance:one",
      capability: "@qflow/seedance@1#seedance-2-mini",
      status: "resolved",
      endpoint: "qflowhub.default",
      use: "@qflow/provider-qflowhub",
      pricing: { kind: "page", url: "https://qflow.ai/commercial/pricing/" },
    },
    { request: "media:one", capability: "@qflow/media@1#inspect", status: "resolved", endpoint: "media.local", use: "@qflow/provider-media-local", pricing: { kind: "local" } },
    { request: "whisper:one", capability: "@qflow/whisperx@1#whisperx-alignment", status: "resolved", endpoint: "whisperx.remote", use: "@qflow/provider-example" },
    {
      request: "image:one",
      capability: "@qflow/gpt-image@1#gpt-image-2",
      status: "unsupported",
      endpoint: "qflowhub.default",
      use: "@qflow/provider-qflowhub",
      rejections: [{
        endpoint: "qflowhub.default",
        message: "transparent background is available only at 1K; requested 2K",
      }],
    },
  ], needs: [{
    request: "seedance:one",
    step: "video::component::presenter.generate",
    port: "request",
    capability: "@qflow/seedance@1#seedance-2-mini",
    summary: { fields: { prompt: "42 chars", duration: 10, resolution: "720p" }, references: { image: 1 } },
    pending: [{ input: "referenceImages", record: "presenter:image", sourceStep: "presenter.generate", kind: "image" }],
  }] } });
  assert.match(output, /Providers and price pages/u);
  assert.match(output, /@qflow\/seedance#seedance-2-mini\n\s+qflowhub\.default \(@qflow\/provider-qflowhub\)\s+·\s+https:\/\/qflow\.ai\/commercial\/pricing\//u);
  assert.match(output, /media\.local .*·\s+local, no Provider charge/u);
  assert.match(output, /whisperx\.remote .*·\s+price source unknown/u);
  assert.match(output, /Unsupported\s+1/u);
  assert.match(output, /gpt-image#gpt-image-2\n\s+qflowhub\.default: transparent background is available only at 1K; requested 2K\n/u);
  assert.match(output, /prompt 42 chars · duration 10 · resolution 720p · 1 image reference · input produced during Build/u);
  assert.doesNotMatch(output, /Pass --runtime/u);
  assert.doesNotMatch(output, /seedance@1#/u);

  const verbose = capture({ ...human, verbose: true }, { kind: "plan", machine: { ...base, providers: [
    { request: "seedance:one", capability: "@qflow/seedance@1#seedance-2-mini", status: "ambiguous", endpoints: ["qflowhub.default", "kie.default"] },
  ] } });
  assert.match(verbose, /@qflow\/seedance@1#seedance-2-mini\n\s+qflowhub\.default, kie\.default all offer it/u);
});

test("pricing presents Provider-owned material beside the corresponding Needs", () => {
  const presentation = { kind: "pricing", machine: {
    format: "qflow.cli-pricing@1",
    run: "/project/build.svrun",
    requestCount: 2,
    pricing: [{
      request: "seedance:one", capability: "@qflow/seedance@1#seedance-2", status: "resolved",
      endpoint: "qflowhub.default", use: "@qflow/provider-qflowhub",
      pricing: { kind: "page", url: "https://qflow.ai/commercial/pricing/" },
      pricingDocuments: [{
        source: "https://qflow.ai/v1/pricing?model=bytedance%2Fseedance-2",
        data: { model: "bytedance/seedance-2", pricing: { mode: "per_second", per_second_usd: 0.1045 } },
      }],
    }, {
      request: "image:one", capability: "@qflow/gpt-image@1#gpt-image-2", status: "resolved",
      endpoint: "kie.default", use: "@qflow/provider-kie",
      pricing: { kind: "page", url: "https://kie.ai/pricing" },
    }],
    needs: [{
      request: "seedance:one", step: "video::component::presenter.generate", port: "generation",
      capability: "@qflow/seedance@1#seedance-2", endpoint: "qflowhub.default",
      summary: { fields: { duration: 5, resolution: "720p" }, references: {} }, pending: [],
    }, {
      request: "image:one", step: "video::component::portrait.generate", port: "generation",
      capability: "@qflow/gpt-image@1#gpt-image-2", endpoint: "kie.default", pending: [],
    }],
  } } as const;
  const output = capture(human, presentation);
  assert.match(output, /Provider pricing information/u);
  assert.match(output, /https:\/\/qflow\.ai\/v1\/pricing\?model=bytedance%2Fseedance-2/u);
  assert.match(output, /use --json or --verbose for the Provider document/u);
  assert.doesNotMatch(output, /"per_second_usd": 0\.1045/u);
  assert.match(output, /duration 5 · resolution 720p/u);
  assert.match(output, /Pricing page\s+https:\/\/kie\.ai\/pricing/u);

  const verbose = capture({ ...human, verbose: true }, presentation);
  assert.match(verbose, /"per_second_usd": 0\.1045/u);
});

test("run check treats historical reuse as a normal summary", () => {
  const output = capture(human, {
    kind: "check-run",
    machine: {
      format: "qflow.cli-check@1",
      sourceKind: "run",
      ok: true,
      run: "/project/build.svrun",
      author: "/project/main.svml",
      frontend: "@qflow/run-markup@1",
      targetCount: 1,
      targets: ["final.video"],
      candidates: 1,
      satisfactions: 1,
      unresolvedHistoricalOutputs: [{ candidate: "previous", build: "bld_previous", output: "take.video" }],
    },
  });
  assert.match(output, /Targets\s+final\.video/u);
  assert.match(output, /Reuse\s+1 historical Output/u);
  assert.doesNotMatch(output, /unresolved|bld_previous|Candidate/u);
});

test("help is concise and describes stable rather than complete output", () => {
  let output = "";
  writeCliHelp({ write(text) { output += text; } });
  assert.match(output, /^Qflow\n/u);
  assert.match(output, /Results/u);
  assert.match(output, /stable machine view/u);
  assert.doesNotMatch(output, /Typical flow|complete machine-readable|image --prompt/u);
});

test("human errors expose stable codes while JSON errors stay parseable", () => {
  const error = Object.assign(new Error("credential is absent"), { code: "RUNTIME_CREDENTIAL_MISSING" });
  assert.match(renderCliError(error, { json: false, color: false, unicode: true, debug: false }),
    /RUNTIME_CREDENTIAL_MISSING/u);
  const machine = JSON.parse(renderCliError(error, {
    json: true, color: true, unicode: true, debug: false,
  })) as { readonly error: { readonly code: string } };
  assert.equal(machine.error.code, "RUNTIME_CREDENTIAL_MISSING");
});

test("Result help makes exact Output addressing explicit", () => {
  let output = "";
  writeCliHelp({ write(text) { output += text; } }, "get");
  assert.match(output, /--output <name> --to <path>/u);
  assert.match(output, /Composite Output becomes a directory/u);
});
