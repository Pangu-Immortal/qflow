import { resolve } from "node:path";

import { MemoryResourceStore } from "@qflow/executor";
import type { Need } from "@qflow/protocol";
import type { ResourceStore } from "@qflow/runtime";

import type { CliApplicationContext } from "./application.js";
import type { CliCapabilityProvider, CliRuntimeHost } from "./runtime-port.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Ephemeral resources for one immediate CLI request; no Build or Result state is created. */
export function createCliScratchResources(): ResourceStore {
  return new MemoryResourceStore();
}

/** Open the Runtime Profile explicitly named by a command, or the one selected by its project. */
export async function openCliRuntimeHost(
  application: CliApplicationContext,
  runtime: string | undefined,
  project: string | undefined,
): Promise<{ readonly profile: string; readonly host: CliRuntimeHost; readonly projectRoot: string }> {
  const projectRoot = await application.resolveProjectRoot(
    project === undefined ? undefined : resolve(application.cwd, project),
  );
  const profile = runtime === undefined
    ? (await application.distribution.resolveProjectRuntime?.(projectRoot))?.profile
    : resolve(application.cwd, runtime);
  assert(profile !== undefined,
    `No Runtime Profile is selected for ${projectRoot}; run qflow runtime use <profile> there, or pass --runtime <profile>`);
  const host = await application.distribution.openRuntimeHost(profile, {
    packageRoot: projectRoot,
    ...(application.distribution.packageRoot === undefined
      ? {}
      : { distributionPackageRoot: application.distribution.packageRoot }),
  });
  return { profile, host, projectRoot };
}

function capabilityName(need: Need): string {
  return `${need.capability.module.name}@${need.capability.module.version}#${need.capability.name}`;
}

/** Resolve one immediate request before spending, preserving the selected Endpoint's explanation. */
export async function selectCliProvider(
  host: Pick<CliRuntimeHost, "providers">,
  need: Need,
  profile: string,
): Promise<CliCapabilityProvider> {
  const [provider] = await host.providers([{
    request: need.id,
    capability: need.capability,
    returns: need.returns,
    constraints: need.constraints,
  }]);
  const subject = capabilityName(need);
  assert(provider !== undefined && provider.status !== "unresolved",
    `No Endpoint in ${profile} serves ${subject}; configure an Endpoint that supports this capability and check its binding in that Profile`);
  assert(provider.status !== "ambiguous",
    `Several Endpoints in ${profile} serve ${subject}: ${(provider.endpoints ?? []).join(", ")}; select one with bindings[${JSON.stringify(subject)}] in that Profile`);
  assert(provider.status !== "unsupported",
    `The configured Endpoints in ${profile} do not support this request for ${subject}`
    + (provider.binding === undefined ? "" : ` (binding: ${provider.binding})`)
    + `: ${(provider.rejections ?? []).map((item) => `${item.endpoint}: ${item.message}`).join("; ") || "no support reason supplied"}`
    + "; adjust the request or select a compatible Endpoint in that Profile");
  return provider;
}

export function cliProviderView(provider: CliCapabilityProvider) {
  return {
    endpoint: provider.endpoint ?? null,
    use: provider.use ?? null,
    pricing: provider.pricing ?? null,
  };
}

export function cliProviderLine(provider: CliCapabilityProvider): string {
  const price = provider.pricing === undefined
    ? "price source unknown"
    : provider.pricing.kind === "local" ? "local, no Provider charge" : provider.pricing.url;
  return `${provider.endpoint} (${provider.use})  ·  ${price}`;
}
