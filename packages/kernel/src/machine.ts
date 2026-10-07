import type {
  BuildDefinition,
  BuildFact,
  BuildState,
  BuildCommand,
  CommandResult,
  Need,
  TypedRecord,
} from "@qflow/protocol";

import { invariant } from "./error.js";
import { producerStep } from "./plan.js";
import {
  buildNeedCommand,
  buildProducerCommand,
  factForBuildResult,
  materializeBuild,
} from "./reducer.js";

function insertDependency(dependents: Map<string, string[]>, record: string, step: string): void {
  const found = dependents.get(record);
  if (found === undefined) dependents.set(record, [step]);
  else found.push(step);
}

function mergeCommands(
  current: readonly BuildCommand[],
  removed: string,
  added: readonly BuildCommand[],
): readonly BuildCommand[] {
  const retained = current.filter((command) => command.id !== removed);
  const additions = [...added].sort((left, right) => left.id.localeCompare(right.id));
  const merged: BuildCommand[] = [];
  let left = 0;
  let right = 0;
  while (left < retained.length || right < additions.length) {
    const existing = retained[left];
    const addition = additions[right];
    if (addition === undefined || existing !== undefined && existing.id.localeCompare(addition.id) < 0) {
      merged.push(existing!);
      left++;
    } else {
      merged.push(addition);
      right++;
    }
  }
  return merged;
}

/**
 * Non-serializable incremental Core machine.
 *
 * Definition + Facts are the stored form. All indexes belong to this one Build execution and are
 * reconstructed from them; none is protocol or Store state.
 */
export class BuildMachine {
  readonly definition: BuildDefinition;
  #state: BuildState;
  #proposal: BuildFact | undefined;
  readonly #records = new Map<string, TypedRecord>();
  readonly #needs = new Map<string, Need>();
  readonly #commands = new Map<string, BuildCommand>();
  readonly #stepIndexes = new Map<string, number>();
  readonly #stepStatuses = new Map<string, "pending" | "complete">();
  readonly #missingInputs = new Map<string, number>();
  readonly #dependents = new Map<string, string[]>();
  readonly #missingGoals = new Set<string>();

  /** Adopt a view just materialized from this Definition's accepted Facts without replaying them again. */
  static fromMaterialized(definition: BuildDefinition, state: BuildState): BuildMachine {
    return new BuildMachine(definition, [], state);
  }

  constructor(definition: BuildDefinition, facts: readonly BuildFact[] = [], materializedState?: BuildState) {
    this.definition = structuredClone(definition);
    this.#state = materializedState ?? materializeBuild(this.definition, facts);
    invariant(this.#state.format === "qflow.build@1", "UNSUPPORTED_BUILD", this.#state.format);
    for (const record of this.#state.records) this.#records.set(record.id, record);
    for (const need of this.#state.needs) this.#needs.set(need.id, need);
    for (const command of this.#state.outstanding) this.#commands.set(command.id, command);
    for (const [index, stepState] of this.#state.steps.entries()) {
      this.#stepIndexes.set(stepState.id, index);
      this.#stepStatuses.set(stepState.id, stepState.status);
      if (stepState.status !== "pending") continue;
      const step = producerStep(this.definition.plan, stepState.id);
      const missing = new Set(Object.values(step.inputs).filter((record) => !this.#records.has(record)));
      this.#missingInputs.set(step.id, missing.size);
      for (const record of missing) insertDependency(this.#dependents, record, step.id);
    }
    for (const goal of this.definition.plan.goals) {
      if (!this.#records.has(goal.record)) this.#missingGoals.add(goal.record);
    }
  }

  get status(): BuildState["status"] {
    return this.#state.status;
  }

  commands(): readonly BuildCommand[] {
    return this.#state.outstanding;
  }

  record(id: string): TypedRecord | undefined {
    return this.#records.get(id);
  }

  /** Materialized read view. It is never the durable Store representation. */
  view(): BuildState {
    return this.#state;
  }

  /** Validate one result without mutating the machine before durable persistence succeeds. */
  evaluate(result: CommandResult): BuildFact | undefined {
    if (this.#proposal !== undefined) {
      throw new Error(`Build result ${this.#proposal.command} has not been durably applied`);
    }
    const fact = factForBuildResult(this.#state, result, {
      command: (id) => this.#commands.get(id),
      stepStatus: (id) => this.#stepStatuses.get(id),
      need: (id) => this.#needs.get(id),
      record: (id) => this.#records.get(id),
    });
    this.#proposal = fact;
    return fact;
  }

  /** Advance memory only after BuildStore.append has committed the proposed Fact. */
  commit(): void {
    const fact = this.#proposal;
    if (fact === undefined) throw new Error("Build machine has no evaluated result to commit");
    this.#proposal = undefined;
    const command = this.#commands.get(fact.command);
    invariant(command !== undefined, "UNKNOWN_COMMAND", `Fact references ${fact.command}`, fact.command);
    this.#commands.delete(fact.command);

    let records = this.#state.records;
    let needs = this.#state.needs;
    let steps = this.#state.steps;
    let diagnostics = this.#state.diagnostics;
    let status = this.#state.status;
    const addedCommands: BuildCommand[] = [];

    if (fact.kind === "command-failed") {
      status = "failed";
      diagnostics = [...diagnostics, fact.diagnostic];
      this.#commands.clear();
    } else {
      const addedRecords = fact.kind === "producer-applied" ? fact.records : [fact.record];
      if (fact.kind === "producer-applied") {
        const stepIndex = this.#stepIndexes.get(fact.step);
        invariant(stepIndex !== undefined, "UNKNOWN_STEP", fact.step, fact.step);
        this.#stepStatuses.set(fact.step, "complete");
        const updatedSteps = [...steps];
        updatedSteps[stepIndex] = { id: fact.step, status: "complete" };
        steps = updatedSteps;
        for (const need of fact.needs) {
          this.#needs.set(need.id, need);
          const next = buildNeedCommand(need);
          this.#commands.set(next.id, next);
          addedCommands.push(next);
        }
        if (fact.needs.length > 0) needs = [...needs, ...fact.needs];
      }

      for (const record of addedRecords) {
        invariant(!this.#records.has(record.id), "DUPLICATE_RECORD", record.id, record.id);
        this.#records.set(record.id, record);
        this.#missingGoals.delete(record.id);
        for (const stepId of this.#dependents.get(record.id) ?? []) {
          const remaining = (this.#missingInputs.get(stepId) ?? 0) - 1;
          invariant(remaining >= 0, "STEP_INPUT_UNDERFLOW", stepId, stepId);
          this.#missingInputs.set(stepId, remaining);
          if (remaining === 0 && this.#stepStatuses.get(stepId) === "pending") {
            const next = buildProducerCommand(producerStep(this.definition.plan, stepId));
            this.#commands.set(next.id, next);
            addedCommands.push(next);
          }
        }
        this.#dependents.delete(record.id);
      }
      if (addedRecords.length > 0) records = [...records, ...addedRecords];

      if (this.#missingGoals.size === 0) {
        status = "complete";
        this.#commands.clear();
      } else if (this.#commands.size === 0) {
        status = "failed";
        diagnostics = [...diagnostics, {
          code: "BUILD_DEADLOCK",
          message: "no command can make progress toward the requested goals",
        }];
      }
    }

    this.#state = {
      ...this.#state,
      status,
      records,
      steps,
      needs,
      outstanding: status === "active" ? mergeCommands(this.#state.outstanding, fact.command, addedCommands) : [],
      diagnostics,
    };
  }
}
