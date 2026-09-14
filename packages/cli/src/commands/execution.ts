import { readExecutionLog } from "@qflow/runtime";
import type { BuildResultManifest, BuildResultRepository } from "@qflow/build-result";
import type { NodeRuntimeHost } from "@qflow/runtime-host-node";

import type { CliCommand, ExecutionCommand } from "../command.js";
import { activityObservationKey, buildProgressLines, buildProgressView, observeBuildView } from "../observation.js";
import type { CliIo } from "../output.js";
import type { CliRuntimeController } from "../runtime-port.js";
import { formatOperationProgress } from "../runtime-view.js";
import { buildStatusView } from "../view.js";
import type { CliBuildStatusView } from "../view.js";
import type { OperationalWriter } from "./types.js";

type OpenProjectResults = () => Promise<{
  readonly repository: BuildResultRepository;
  close(): void | Promise<void>;
}>;

function statusDetailLines(build: CliBuildStatusView | null): string[] {
  return [
    ...(build?.failure === undefined ? [] : [`Reason    ${build.failure}`]),
    ...(build?.commands ?? []).map((command) => `${command.endpoint}: ${formatOperationProgress(command.progress)}`),
    ...(build?.operations ?? []).map((operation) => {
      const label = `${operation.endpoint}${operation.receipt === undefined ? "" : ` · task ${operation.receipt.id}`}`;
      const detail = operation.failure !== undefined ? `${operation.failure.code} — ${operation.failure.message}`
        : operation.progress === undefined ? operation.state : formatOperationProgress(operation.progress);
      return `${label}: ${detail}${operation.count === undefined ? "" : ` ×${operation.count}`}`;
    }),
  ];
}

export function isExecutionCommand(args: CliCommand): args is ExecutionCommand {
  return args.command === "logs" || args.command === "status" || args.command === "cancel" || args.command === "activity"
    || (args.command === "result" && (args.action === "finish" || args.action === "discard"));
}

/** Inspect or control accepted Build work. Observation never owns execution. */
export async function runExecutionCommand(input: {
  readonly args: ExecutionCommand;
  readonly runtimeProfile: string | undefined;
  readonly resolveProjectRuntime?: () => Promise<string | undefined>;
  readonly io: CliIo;
  readonly runtimeHost: (profile: string) => Promise<NodeRuntimeHost>;
  readonly runtimeController: (profile: string) => Promise<CliRuntimeController>;
  readonly openProjectResults: OpenProjectResults;
  readonly write: OperationalWriter;
}): Promise<void> {
  const { args, runtimeProfile, io, runtimeHost, runtimeController, openProjectResults, write } = input;
  if (args.command === "logs") {
    const opened = await openProjectResults();
    let source: "runtime" | "result" | "unavailable" = "unavailable";
    let view: import("@qflow/runtime").ExecutionLogView | undefined;
    let finished = false;
    try {
      const result = await opened.repository.read(args.build);
      finished = result?.outcome !== undefined;
      if (result?.executionLog !== undefined) {
        const chunks = await opened.repository.openFile(args.build, result.executionLog);
        if (chunks === undefined) throw new Error(`Build ${args.build} execution log file is unavailable`);
        view = await readExecutionLog(chunks, args.lines);
        source = "result";
      }
    } finally { await opened.close(); }
    const activeProfile = !finished && view === undefined
      ? runtimeProfile ?? await input.resolveProjectRuntime?.() : undefined;
    if (activeProfile !== undefined) {
      const control = await (await runtimeHost(activeProfile)).openControl({ readOnly: true });
      try { view = await control.logs?.(args.build, args.lines); }
      finally { await control.close(); }
      if (view !== undefined) source = "runtime";
      // Result finishing can move the log between the first read and the active read.
      if (view === undefined) {
        const completed = await openProjectResults();
        try {
          const result = await completed.repository.read(args.build);
          if (result?.executionLog !== undefined) {
            const chunks = await completed.repository.openFile(args.build, result.executionLog);
            if (chunks !== undefined) { view = await readExecutionLog(chunks, args.lines); source = "result"; }
          }
        } finally { await completed.close(); }
      }
    }
    const records = view?.records ?? [];
    const omitted = (view?.total ?? 0) - records.length;
    write({ format: "qflow.cli-logs@1", build: args.build, source, records, omittedRecords: omitted },
      view === undefined ? "Execution log unavailable" : "Build execution log", view === undefined ? "warning" : "info",
      [["Build", args.build], ["Source", source]], [
        ...(view !== undefined ? [] : [finished
          ? "This Result has no saved execution log."
          : activeProfile === undefined
            ? "No saved log found in this project. Select the Build's Runtime with --runtime <profile> to check active execution."
            : "No log found in this project's Results or the selected Runtime. Check the Build id and project selection."]),
        ...(omitted > 0 ? [`Showing last ${records.length} records; ${omitted} earlier records omitted. Use --lines to read more.`] : []),
        ...records.map((record) => `${new Date(record.time).toISOString()}  ${record.endpoint}  ${record.command}  ${
          record.kind === "phase" ? record.phase : record.kind === "diagnostic" || record.kind === "failed"
            ? `${record.kind}: ${record.message}` : record.kind}`),
      ]);
    if (view === undefined) io.setExitCode?.(1);
    return;
  }

  if (args.command === "status" && runtimeProfile === undefined) {
    const openedResults = await openProjectResults();
    let result;
    try {
      result = await openedResults.repository.read(args.build);
    } finally {
      await openedResults.close();
    }
    if (args.watch && result?.outcome === undefined) {
      throw new Error(`Build ${args.build} has no finished Result; select its Runtime to observe active execution`);
    }
    const finished = result?.outcome !== undefined;
    const build = result === undefined ? null : buildStatusView({ id: result.id, result, verbose: args.presentation.verbose });
    const outcome = result?.outcome;
    write({ format: "qflow.cli-status@1", build }, result === undefined
      ? "Build Result not found"
      : outcome === "complete" ? "Build complete"
        : outcome === "failed" ? "Build failed"
          : outcome === "cancelled" ? "Build cancelled" : "Build Result is open",
    result === undefined || !finished ? "warning"
      : outcome === "failed" ? "error"
        : outcome === "cancelled" ? "warning" : "success", [
      ["Build", args.build],
      ...(build?.title === undefined ? [] : [["Title", build.title] as const]),
      ...(outcome === undefined ? [] : [["Outcome", outcome] as const]),
      ...(!finished && result !== undefined ? [["Result", "open"] as const] : []),
      ...(build?.targets?.length ? [["Targets", build.targets.join(", ")] as const] : []),
    ], [
      ...statusDetailLines(build),
      ...(!finished && result !== undefined ? ["Select the Runtime to inspect active work."] : []),
    ]);
    if (result === undefined || !finished || outcome === "failed") io.setExitCode?.(1);
    return;
  }

  if (runtimeProfile === undefined) {
    throw new Error(`${args.command} requires a Runtime; run qflow runtime init, select one with runtime use, or pass --runtime <profile>`);
  }
  const selectedHost = await runtimeHost(runtimeProfile);

  if (args.command === "result" && args.action === "discard") {
    const resultControl = await selectedHost.openResultControl();
    const discarded = await resultControl.discardSubmission(args.build)
      .finally(async () => await resultControl.close());
    write({ format: "qflow.cli-result-discard@1", build: args.build, discarded }, discarded
      ? "Incomplete Build discarded"
      : "Incomplete Build not found", discarded ? "success" : "warning", [
        ["Build", args.build],
        ["State", discarded ? "discarded" : "missing"],
      ], discarded ? ["The incomplete submission was removed."] : []);
    if (!discarded) io.setExitCode?.(1);
    return;
  }

  const runtime = await selectedHost.openControl({ readOnly: args.command !== "cancel" });
  try {
    if (args.command === "activity") {
      const controller = await runtimeController(runtimeProfile);
      let previous: string | undefined;
      const writeActivity = async (): Promise<void> => {
        const [activity, worker] = await Promise.all([
          runtime.activity(),
          controller.worker.status(),
        ]);
        const builds = activity.builds.slice(0, args.limit).map((item) => {
          const status = buildStatusView({ id: item.id, runtime: item });
          return {
            id: item.id,
            work: status.work,
            phases: buildProgressView(item).phases,
            ...(status.attention === undefined ? {} : { attention: status.attention }),
          };
        });
        const currentView = JSON.stringify([activity.builds.length,
          activityObservationKey(worker.state, activity.builds.slice(0, args.limit))]);
        if (args.watch && currentView === previous) return;
        previous = currentView;
        const value = {
          format: "qflow.cli-activity@1" as const,
          at: Date.now(),
          worker: worker.state,
          builds,
          ...(activity.builds.length <= args.limit ? {} : { omittedBuilds: activity.builds.length - args.limit }),
          ...(args.presentation.verbose ? { capacity: activity.capacity } : {}),
        };
        const buildLines = activity.builds.slice(0, args.limit).map((item) => {
          const requestProgress = item.requests === undefined || item.requests.total === 0
            ? ""
            : ` · ${item.requests.completed}/${item.requests.total} steps`;
          return `${item.id}: ${buildStatusView({ id: item.id, runtime: item }).work.state}`
            + requestProgress
            + Object.entries(buildProgressView(item).phases).map(([phase, count]) => ` · ${count} ${phase}`).join("")
            + `${item.stop?.cause === "execution-failed" ? " · stopping after failure" : item.cancellationRequested ? " · cancelling" : ""}`
            + `${item.issue === undefined ? "" : ` · ${item.issue.message}`}`;
        });
        const operationLines = args.presentation.verbose
          ? activity.builds.slice(0, args.limit).flatMap((build) => buildProgressView(build).details
              .map((detail) => `${build.id} · ${detail}`))
          : [];
        write(value, "Runtime activity", activity.builds.length === 0 ? "success" : "info", [
          ["Active Builds", String(activity.builds.length)],
          ["Worker", worker.state],
        ], [
          ...buildLines,
          ...(operationLines.length === 0 ? [] : ["Operations:", ...operationLines]),
        ]);
      };
      if (!args.watch) await writeActivity();
      else while (true) {
        await writeActivity();
        await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
      }
      return;
    }

    if (args.command === "status") {
      let view = await runtime.inspect(args.build);
      let result: BuildResultManifest | undefined;
      let resultReadError: string | undefined;
      let openedResults: Awaited<ReturnType<OpenProjectResults>> | undefined;
      try {
        openedResults = await openProjectResults();
        if (args.watch && view !== undefined && view.issue === undefined) {
          const controller = await runtimeController(runtimeProfile);
          view = await observeBuildView(runtime, args.build, view, {
            ...(args.maxWaitMs === undefined ? {} : { maxWaitMs: args.maxWaitMs }),
            controller,
            ...(args.presentation.json ? {} : {
              onProgress: (progress) => {
                for (const line of buildProgressLines(progress, {
                  verbose: args.presentation.verbose,
                  limit: args.limit,
                })) io.write(`${line}\n`);
              },
            }),
          });
        }
        result = await openedResults.repository.read(args.build);
      } catch (error) {
        resultReadError = error instanceof Error ? error.message : String(error);
      } finally {
        await openedResults?.close();
      }
      const found = view !== undefined || result !== undefined;
      const activity = view?.activity;
      const resultOutcome = result?.outcome;
      const outcome = resultOutcome ?? view?.outcome;
      const savingResult = activity === "saving-result" && resultOutcome === undefined;
      const issue = view?.issue;
      const build = !found ? null : buildStatusView({
        id: view?.id ?? result!.id,
        ...(view === undefined ? {} : { runtime: view }),
        ...(result === undefined ? {} : { result }),
        ...(resultReadError === undefined ? {} : { resultReadError }),
        verbose: args.presentation.verbose,
      });
      const attention = build?.attention;
      const humanTitle = !found
        ? "Build not found"
        : attention !== undefined
          ? "Build needs attention"
          : savingResult
            ? "Saving Build Result"
            : resultOutcome === "complete"
              ? "Build complete"
              : resultOutcome === "failed"
                ? "Build failed"
                : resultOutcome === "cancelled"
                  ? "Build cancelled"
                  : args.watch && activity === undefined ? "Build finished" : "Build active";
      write({ format: "qflow.cli-status@1", build }, !found
        ? "Build not found" : humanTitle,
      !found
        ? "warning"
        : attention !== undefined
          ? "error"
          : outcome === "failed"
            ? "error"
            : outcome === "cancelled"
              ? "warning"
              : resultOutcome === "complete"
                ? "success"
                : args.watch && activity !== undefined ? "warning" : "info", [
          ["Build", args.build],
          ...(build?.title === undefined ? [] : [["Title", build.title] as const]),
          ...(attention !== undefined ? [
            ["Execution", build?.work.outcome ?? build?.work.state ?? "unknown"] as const,
            ["Result", build?.result.state ?? "missing"] as const,
          ] : savingResult ? [
            ["Execution", view?.outcome ?? "complete"] as const,
            ["Result", "saving"] as const,
          ] : resultOutcome !== undefined ? [
            ["Outcome", resultOutcome] as const,
          ] : [["State", build?.work.state ?? "unknown"] as const]),
          ...(build?.targets?.length ? [["Targets", build.targets.join(", ")] as const] : []),
        ], statusDetailLines(build)
          .concat(attention === undefined ? [] : [
            `Attention  ${attention.message}`,
            ...(attention.action === undefined ? [] : [`Action     ${attention.action}`]),
          ]));
      if (!found || issue !== undefined || resultReadError !== undefined || outcome === "failed") io.setExitCode?.(1);
      return;
    }

    if (args.command === "result") {
      const before = await runtime.inspect(args.build);
      if (before !== undefined && before.activity !== "saving-result") {
        throw new Error(`Build ${args.build} is still ${before.activity}; there is no Result write to finish`);
      }
      if (before !== undefined && before.issue === undefined) {
        const worker = await (await selectedHost.controller()).worker.status();
        if (worker.state === "running") {
          throw new Error(`Build ${args.build} Result is currently being written by the Runtime Worker`);
        }
      }
      const resultControl = await selectedHost.openResultControl();
      const finished = await resultControl.finishResult(args.build)
        .finally(async () => await resultControl.close());
      if (finished === undefined) {
        const openedResults = await openProjectResults();
        const existing = await openedResults.repository.read(args.build)
          .finally(async () => await openedResults.close());
        if (existing?.outcome === undefined) {
          write({ format: "qflow.cli-result-finish@1", build: args.build, found: false },
            "Result cannot be finished", "warning", [["Build", args.build]],
            ["No decided Result write exists for this Build."]);
          io.setExitCode?.(1);
          return;
        }
        write({ format: "qflow.cli-result-finish@1", build: args.build, outcome: existing.outcome },
          "Result already finished", "info", [["Build", args.build], ["Outcome", existing.outcome]]);
        return;
      }
      write({
        format: "qflow.cli-result-finish@1",
        build: args.build,
        outcome: finished.outcome,
        ...(finished.issue === undefined ? {} : { attention: {
          message: finished.issue.message,
          action: `qflow result finish ${args.build}`,
        } }),
      }, finished.issue === undefined ? "Result finished" : "Result still needs attention",
      finished.issue === undefined ? "success" : "error", [
        ["Build", args.build],
        ["Outcome", finished.outcome],
      ], finished.issue === undefined ? [] : [`Attention  ${finished.issue.message}`]);
      if (finished.issue !== undefined) io.setExitCode?.(1);
      return;
    }

    const active = await runtime.cancel(args.build, args.reason);
    const openedResults = active === undefined ? await openProjectResults() : undefined;
    const finished = openedResults === undefined
      ? undefined
      : await openedResults.repository.read(args.build).finally(async () => await openedResults.close());
    const build = active === undefined && finished === undefined ? null : buildStatusView({
      id: args.build,
      ...(active === undefined ? {} : { runtime: active }),
      ...(finished === undefined ? {} : { result: finished }),
    });
    const machine = {
      format: "qflow.cli-cancel@1" as const,
      requested: active?.cancellationRequested === true,
      build,
    };
    const alreadyStopping = active?.stop?.cause === "execution-failed";
    const title = active === undefined && finished === undefined
      ? "Build not found"
      : active === undefined ? "Build already finished"
        : alreadyStopping ? "Build already stopping after failure" : "Build cancellation requested";
    write(machine, title,
      active === undefined && finished === undefined ? "warning" : active === undefined || alreadyStopping ? "info" : "success", [
        ["Build", args.build], ...(build === null ? [] : [["Work", build.work.state] as const]),
      ], active === undefined && finished?.outcome !== undefined
        ? [`No running work was changed; this Build is already ${finished.outcome}.`]
        : alreadyStopping ? [active.stop!.reason ?? "Waiting for submitted work to finish."] : []);
    if (active === undefined && finished === undefined) io.setExitCode?.(1);
  } finally {
    await runtime.close();
  }
}
