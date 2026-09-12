import { programSpaceTypes } from "@qflow/program-space";
import { speechTypes } from "@qflow/speech";
import { sealGraphFragment } from "@qflow/elaborator";
import type { FragmentOperation } from "@qflow/elaborator";
import { timelineTypes } from "@qflow/timeline";
import type { TypeRef } from "@qflow/protocol";

import { timelineAuthorProducers, timelineAuthorTypes } from "./manifest.js";
import type { TimelineAuthorFragmentOptions } from "./types.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

export function createTimelineAuthorFragment(options: TimelineAuthorFragmentOptions) {
  const declaredInputs = new Map<string, TypeRef>();
  const addInput = (name: string, type: TypeRef): void => {
    if (!name) throw new Error("Timeline Fragment input names must not be empty");
    const previous = declaredInputs.get(name);
    if (previous !== undefined && (previous.module.name !== type.module.name
      || previous.module.version !== type.module.version || previous.name !== type.name)) {
      throw new Error(`Timeline Fragment input ${name} is reused with another Type`);
    }
    declaredInputs.set(name, type);
  };
  addInput("header", timelineAuthorTypes.header);
  addInput("clock", programSpaceTypes.clock);
  for (const take of options.takes) {
    addInput(take.takeName, speechTypes.semanticTake);
  }
  const operations: FragmentOperation[] = [{
    id: "track:set:empty",
    producer: timelineAuthorProducers.createSet,
    inputs: {},
    result: { kind: "output", name: "set" },
  }];
  let current = "track:set:empty";
  options.takes.forEach((take, index) => {
    const id = `track:set:append:${String(index + 1).padStart(4, "0")}`;
    operations.push({
      id,
      producer: timelineAuthorProducers.appendTake,
      inputs: {
        set: operation(current),
        take: input(take.takeName),
      },
      result: { kind: "output", name: "set" },
    });
    current = id;
  });
  operations.push(
    {
      id: "track:semantic",
      producer: timelineAuthorProducers.assembleTrack,
      inputs: { header: input("header"), set: operation(current), clock: input("clock") },
      result: { kind: "output", name: "track" },
    },
  );
  return sealGraphFragment({
    inputs: [...declaredInputs.entries()].map(([name, type]) => ({ name, type })),
    operations,
    exports: [
      { name: "timeline", type: timelineTypes.track, root: operation("track:semantic") },
    ],
  });
}
