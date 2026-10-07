import type { Facet } from "@qflow/facet";
import type { ModuleRef, TypeRef } from "@qflow/protocol";

import type {
  RawSurfaceHandler,
  RegisteredSurface,
  SurfaceVocabulary,
  StructuredSurfaceHandler,
  MarkupSurfaceRegistryLike,
  RawSurfaceDeclaration,
  StructuredSurfaceDeclaration,
} from "./types.js";

export const markupSurfaceFacetAbi = "qflow.markup-surface@1";

type RawMarkupSurfaceFacetOptions =
  | {
      readonly module: ModuleRef;
      readonly surface: string;
      readonly tag: string;
      readonly outputs: readonly TypeRef[];
      readonly vocabulary?: SurfaceVocabulary;
      readonly mode: "raw";
      readonly handler: RawSurfaceHandler;
    }
  | {
      readonly module: ModuleRef;
      readonly declaration: RawSurfaceDeclaration;
      readonly handler: RawSurfaceHandler;
    };

type StructuredMarkupSurfaceFacetOptions =
  | {
      readonly module: ModuleRef;
      readonly surface: string;
      readonly tag: string;
      readonly outputs: readonly TypeRef[];
      readonly vocabulary?: SurfaceVocabulary;
      readonly mode: "structured";
      readonly handler: StructuredSurfaceHandler;
    }
  | {
      readonly module: ModuleRef;
      readonly declaration: StructuredSurfaceDeclaration;
      readonly handler: StructuredSurfaceHandler;
    };

export type { MarkupSurfaceDeclaration } from "./types.js";

export type MarkupSurfaceFacetOptions =
  | RawMarkupSurfaceFacetOptions
  | StructuredMarkupSurfaceFacetOptions;

type MutableMarkupSurfaceRegistry = MarkupSurfaceRegistryLike & {
  register(value: RegisteredSurface): void;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Package-owned Markup Surface declaration carried through the syntax-neutral package loader. */
export function createMarkupSurfaceFacet(options: RawMarkupSurfaceFacetOptions): Facet;
export function createMarkupSurfaceFacet(options: StructuredMarkupSurfaceFacetOptions): Facet;
export function createMarkupSurfaceFacet(options: MarkupSurfaceFacetOptions): Facet {
  const declaration = "declaration" in options
    ? {
        surface: options.declaration.name,
        tag: options.declaration.tag,
        outputs: options.declaration.outputs,
        mode: options.declaration.mode,
        ...(options.declaration.vocabulary === undefined
          ? {}
          : { vocabulary: options.declaration.vocabulary }),
      }
    : options;
  assert(options.module.name.trim().length > 0 && options.module.version.trim().length > 0,
    "Markup Surface module identity is invalid");
  assert(declaration.surface.trim().length > 0, "Markup Surface name is empty");
  assert(declaration.tag.trim().length > 0, "Markup Surface tag is empty");
  const implementation: RegisteredSurface = declaration.mode === "raw"
    ? {
        module: options.module,
        surface: declaration.surface,
        tag: declaration.tag,
        outputs: declaration.outputs,
        ...(declaration.vocabulary === undefined ? {} : { vocabulary: declaration.vocabulary }),
        mode: "raw",
        handler: options.handler as RawSurfaceHandler,
      }
    : {
        module: options.module,
        surface: declaration.surface,
        tag: declaration.tag,
        outputs: declaration.outputs,
        ...(declaration.vocabulary === undefined ? {} : { vocabulary: declaration.vocabulary }),
        mode: "structured",
        handler: options.handler as StructuredSurfaceHandler,
      };
  return {
    abi: markupSurfaceFacetAbi,
    implementation,
  };
}

/** Install only facets owned by the Markup Surface ABI; unrelated facets remain inert. */
export function installMarkupSurfaceFacets(
  facets: readonly Facet[],
  registry: MutableMarkupSurfaceRegistry,
): void {
  for (const facet of facets) {
    if (facet.abi !== markupSurfaceFacetAbi) continue;
    registry.register(facet.implementation as RegisteredSurface);
  }
}
