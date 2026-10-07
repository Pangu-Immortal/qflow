import type { CliCompilerOptions } from "@qflow/qflow/cli";
import { admissionPackagesFromFacets, registerTypeValidatorFacets, TypeValidatorRegistry } from "@qflow/qflow/admission";
import { ModulePackageRegistry, Compiler } from "@qflow/qflow/compiler";
import { AuthorFrontendRegistry, installAuthorFrontendFacets } from "@qflow/qflow/author";
import {
  createMarkupAuthorFrontend,
  installMarkupSurfaceFacets,
  MarkupSurfaceRegistry,
} from "@qflow/qflow/markup";
import {
  resolveNodePackageResourceSpecifier,
  resolveNodePackageSource,
} from "@qflow/qflow/loader/node";
import { NodeFilesystemWorkspace } from "@qflow/qflow/workspace/node";

export function createVideoWorkspace(options: Pick<CliCompilerOptions,
  "workspaceRoot" | "assetRoots" | "packageRoot" | "distributionPackageRoot">) {
  const packageRoot = options.packageRoot ?? options.workspaceRoot ?? process.cwd();
  return new NodeFilesystemWorkspace({
    ...(options.workspaceRoot === undefined ? {} : { root: options.workspaceRoot }),
    ...(options.assetRoots === undefined ? {} : { assetRoots: options.assetRoots }),
    externalSourceResolver(importer, request) {
      const located = resolveNodePackageSource(request.from, {
        from: importer.id,
        workspaceRoots: [packageRoot],
        ...(options.distributionPackageRoot === undefined
          ? {}
          : { distributionRoots: [options.distributionPackageRoot] }),
      });
      return { root: located.root, source: located.source };
    },
    externalAssetResolver(importer, request) {
      const located = resolveNodePackageResourceSpecifier(request.from, {
        from: importer.id,
        workspaceRoots: [packageRoot],
        ...(options.distributionPackageRoot === undefined
          ? {}
          : { distributionRoots: [options.distributionPackageRoot] }),
      });
      return { root: located.root, asset: located.resource };
    },
  });
}

/** Assemble the Markup compiler Host from only the packages selected for this invocation. */
export function createVideoCompiler(options: CliCompilerOptions) {
  const modules = new ModulePackageRegistry();
  const surfaces = new MarkupSurfaceRegistry();
  const frontends = new AuthorFrontendRegistry();
  const validators = new TypeValidatorRegistry();
  for (const item of options.packageContributions) {
    for (const module of item.modules ?? []) modules.register(module);
    const facets = item.facets ?? [];
    installMarkupSurfaceFacets(facets, surfaces);
    installAuthorFrontendFacets(facets, frontends);
    for (const pack of admissionPackagesFromFacets(facets)) {
      registerTypeValidatorFacets(validators, pack.validators ?? []);
    }
  }
  frontends.register(createMarkupAuthorFrontend({
    registry: surfaces,
    resolveModule(request) {
      const resolved = modules.resolve(request.from);
      if (resolved === undefined) throw new Error(`No selected author package satisfies ${request.from}`);
      return resolved;
    },
  }));
  return new Compiler({
    modules,
    frontends,
    validators,
    workspace: createVideoWorkspace(options),
  });
}
