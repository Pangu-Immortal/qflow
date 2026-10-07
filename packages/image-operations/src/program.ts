import { canonicalize } from "@qflow/qflow/protocol";
import { assertImageTransformOperations } from "./execution.js";

import type { ImageTransformProgram } from "./types.js";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function verifyImageTransformProgram(program: ImageTransformProgram): void {
  assertImageTransformOperations(program.operations);
}

export function sealImageTransformProgram(program: ImageTransformProgram): ImageTransformProgram {
  const sealed = canonicalize(program) as unknown as ImageTransformProgram;
  verifyImageTransformProgram(sealed);
  return sealed;
}
