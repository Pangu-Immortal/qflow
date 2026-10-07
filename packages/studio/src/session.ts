import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";

import { markupAuthorFrontendId } from "@qflow/qflow/markup";
import type { CliTransientExecution as RuntimeHostTransientExecution } from "@qflow/qflow/cli";
import { recipeFrontendId } from "@qflow/qflow/recipe";

import type { ServedFile } from "./compile.js";
import type { StudioDomain } from "./domain.js";
import type { Observations } from "./observe.js";
import { resolveStudioProjection } from "./projection.js";
import { renderStudioHtmlProgram } from "./preview/render.js";
import type { RunPlan } from "./run.js";
import type { StudioSnapshot } from "./shared.js";
import type { StudioCompanionRegistry } from "./studio-registry.js";
import { snapshot } from "./snapshot.js";
import { inspectStudioRun } from "./studio-preflight.js";
import type { StudioViewRequirement } from "./studio-preflight.js";
import type { StudioSourceFile } from "./parameters.js";

function sourceFiles(run: RunPlan): readonly StudioSourceFile[] {
  const paths = [run.runPath, run.authorSource, ...run.source.compiled.closure.units.map((unit) => unit.id)];
  return [...new Set(paths)].flatMap((path): StudioSourceFile[] => {
    if (!existsSync(path)) return [];
    try {
      const unit = run.source.compiled.closure.units.find((candidate) => candidate.id === path);
      const language = path === run.runPath
        ? "svrun" as const
        : unit?.frontend === recipeFrontendId
          ? "svs" as const
          : unit?.frontend === markupAuthorFrontendId
            ? "svml" as const
            : undefined;
      if (language === undefined) return [];
      return [{
        path,
        text: readFileSync(path, "utf8"),
        language,
        role: path === run.runPath ? "run" : path === run.authorSource ? "author" : "dependency",
        ...(unit === undefined ? {} : { imports: unit.imports }),
      }];
    } catch {
      return [];
    }
  });
}

export type StudioSession = {
  readonly snapshot: StudioSnapshot;
  readonly document: import("@qflow/qflow/html-program").HtmlProgram;
  readonly visualHtml: string;
  readonly material: ReadonlyMap<string, ServedFile>;
  readonly observations: Observations;
  readonly projections: readonly StudioViewRequirement[];
};

export async function readStudioSession(input: {
  readonly domain: StudioDomain;
  readonly registry: StudioCompanionRegistry;
  readonly run: RunPlan;
  readonly revision: number;
  readonly sourcePath?: string;
  readonly workspaceRoot: string;
  readonly transientExecution?: RuntimeHostTransientExecution;
}): Promise<StudioSession> {
  const source = input.run.source;
  const inspection = inspectStudioRun(input.registry, source, input.run);
  const outputRefs = [
    inspection.filmComposition,
    ...inspection.projections.map((projection) => projection.ref),
  ];
  const built = await resolveStudioProjection({
    source,
    registry: input.registry,
    run: input.run,
    domain: input.domain,
    outputRefs,
    compositionRef: inspection.filmComposition,
    timeRef: inspection.timeRef,
    projections: inspection.projections,
    ...(input.transientExecution === undefined ? {} : { transientExecution: input.transientExecution }),
  });
  const rendered = renderStudioHtmlProgram({
    composition: built.composition,
    timeline: built.timeline,
    served: new Set(built.served.keys()),
  });
  const text = readFileSync(input.run.authorSource, "utf8");
  const files = sourceFiles(input.run);
  return {
    document: rendered.document,
    visualHtml: rendered.html,
    snapshot: snapshot(input.registry, built, {
      revision: input.revision,
      path: input.sourcePath ?? input.run.authorSource,
      text,
      run: {
        path: relative(input.workspaceRoot, input.run.runPath),
        targets: input.run.targets,
        satisfactions: input.run.run.graph.satisfactions.map((item) => ({
          output: item.output,
          candidate: item.candidate,
        })),
      },
      canvas: built.canvas,
      frameRate: built.frameRate,
      preview: { kind: "html-program", srcdoc: rendered.preview },
      workspaceRoot: input.workspaceRoot,
      sourceFiles: files,
      surfaces: input.domain.surfaces,
    }),
    material: built.served,
    observations: source.observations,
    projections: inspection.projections,
  };
}
