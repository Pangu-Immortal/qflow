import type {
  ModuleContribution,
  PackageContribution,
} from "./types.js";

function assertPackage(value: PackageContribution): void {
  if (value.format !== "qflow.package@1") {
    throw new Error("Package contribution has an unsupported format");
  }
  for (const facet of value.facets ?? []) {
    if (facet.abi.trim().length === 0) throw new Error("Package contribution has an empty Facet ABI");
    const offers = facet.offers ?? [];
    if (offers.some((item) => item.trim().length === 0)) {
      throw new Error(`Package contribution has an empty logical name for Facet ${facet.abi}`);
    }
    if (new Set(offers).size !== offers.length) {
      throw new Error(`Package contribution repeats a logical name for Facet ${facet.abi}`);
    }
  }
}

/** Validate declarations and logical offers without interpreting any executable Facet. */
export function verifyPackageContributions(packages: readonly PackageContribution[]): void {
  const manifests = new Map<string, ModuleContribution>();
  const moduleSpecifiers = new Map<string, string>();
  const offers = new Set<string>();
  for (const item of packages) {
    assertPackage(item);
    for (const module of item.modules ?? []) {
      const key = `${module.manifest.name}@${module.manifest.version}`;
      if (manifests.has(key)) throw new Error(`Packages repeat Module ${key}`);
      for (const specifier of new Set([key, ...(module.specifiers ?? [])])) {
        if (specifier.trim().length === 0) throw new Error(`${key} declares an empty Module specifier`);
        const owner = moduleSpecifiers.get(specifier);
        if (owner !== undefined) throw new Error(`Module specifier ${specifier} is already bound to ${owner}`);
        moduleSpecifiers.set(specifier, key);
      }
      manifests.set(key, module);
    }
    for (const facet of item.facets ?? []) {
      for (const offered of facet.offers ?? []) {
        const key = `${facet.abi}\u0000${offered}`;
        if (offers.has(key)) throw new Error(`Packages repeat ${facet.abi} offer ${offered}`);
        offers.add(key);
      }
    }
  }
}
