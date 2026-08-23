import { resolve } from "node:path";

export { qflowHostStateRoot } from "@qflow/runtime-host-node";

export function qflowProjectStateRoot(projectRoot: string): string {
  return resolve(projectRoot, ".qflow");
}
