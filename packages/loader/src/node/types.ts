import type { LogicalPackageAddress } from "../types.js";

export type NodePackageSelectionRequest = {
  /** Physical packages selected by Source discovery or a Runtime Profile. */
  readonly selected: readonly string[];
  /** Logical capabilities that the selected packages must provide. */
  readonly logical?: readonly LogicalPackageAddress[];
};

export type NodePackageLoadOptions = {
  /** Host-owned module scope. Omitting this uses Node's ordinary process imports. */
  readonly importModule?: (url: string) => Promise<unknown>;
  /**
   * Additional read-only Distribution roots. Exact embedded packages are protected host code;
   * ordinary packages installed for the Distribution are fallbacks after project dependencies.
   */
  readonly fallbackRoots?: readonly string[];
};
