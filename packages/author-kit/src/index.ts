/**
 * Stable framework-facing author-package surface.
 *
 * Domain values stay with their owning packages; this module only joins the small set of framework
 * interfaces needed to declare a Module, lower a Surface into a Fragment and provide deterministic
 * handlers. It performs no discovery, registration, installation or execution.
 */
export {
  canonicalize,
  isResourceId,
  sameType,
} from "@qflow/protocol";
export type {
  BlobRef,
  CanonicalValue,
  ModuleManifest,
  ModuleRef,
  ProducerRef,
  StoredValue,
  TypeRef,
  TypedRecord,
  ValueSchema,
} from "@qflow/protocol";

export type {
  ComponentPackage,
  ProducerFacet,
  ProducerHandler,
  ProducerHandlerContext,
  ProducerHandlerResult,
  TypeValidatorFacet,
  TypeValidatorHandler,
} from "@qflow/component-kit";

export {
  sealGraphFragment,
} from "@qflow/elaborator";
export type {
  FragmentOperation,
  GraphFragment,
} from "@qflow/elaborator";

export {
  assertAttributes,
  assertEmptyElement,
  assertExactAttributes,
  createMarkupSurfaceHostFacet,
  localName,
  optionalTextAttribute,
  textAttribute,
} from "@qflow/markup";
export type {
  MarkupSurfaceHostFacetOptions,
  StructuredElement,
  StructuredSurfaceHandler,
  SurfaceComponentDraft,
  SurfaceRecordDraft,
  SurfaceResolvedReference,
} from "@qflow/markup";
