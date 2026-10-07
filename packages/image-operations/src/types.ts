import type { ImageTransformOperation } from "./execution-types.js";

export type * from "./execution-types.js";

/** Authored transformation intent. Operation order is author meaning. */
export type ImageTransformProgram = {
  readonly operations: readonly ImageTransformOperation[];
};
