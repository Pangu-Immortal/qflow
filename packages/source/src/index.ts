export type {
  Awaitable,
  ResolvedSourceAsset,
  ResolvedSource,
  SourceAssetRequest,
  SourceAssetResolver,
  SourceImportRequest,
  SourceResolver,
  SourceUnit,
} from "./unit.js";
export { decodeSourceText } from "./unit.js";
/** Logical package address for Frontend facets selected by a ResolvedSource authority. */
export const sourceFrontendPackageAbi = "qflow.source-frontend@1";
