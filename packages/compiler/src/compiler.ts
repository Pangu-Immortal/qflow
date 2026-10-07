import { link } from "@qflow/kernel";
import type {
  AuthorFrontendRegistryLike,
  AuthorSourceDiscovery,
  CompiledSourceClosure,
  AuthorRecordAdmitter,
} from "@qflow/author";
import type { ResolvedSource, SourceUnit } from "@qflow/source";
import type { BlobAttachment, Workspace, WorkspaceSession } from "@qflow/workspace";
import type { BlobRef, LinkedProgram } from "@qflow/protocol";
import {
  TypeValidatorRegistry,
  createRecordAdmitter,
} from "@qflow/admission";
import type { TypeValidatorRegistryLike } from "@qflow/admission";

import { CompilerError } from "./error.js";
import type { ModulePackageRegistryLike } from "./modules.js";
import { compileSourceClosure } from "./source.js";

type DiscoveredUnit = {
  readonly source: ResolvedSource;
  readonly frontend: string;
  readonly discovery: AuthorSourceDiscovery;
};

function attachmentKey(artifact: BlobRef): string {
  return `${artifact.resource}\u0000${artifact.mediaType}`;
}

export function mergeAttachments(groups: readonly (readonly BlobAttachment[])[]): readonly BlobAttachment[] {
  const merged = new Map<string, BlobAttachment>();
  for (const item of groups.flat()) {
    const key = attachmentKey(item.artifact);
    const existing = merged.get(key);
    if (existing !== undefined) {
      if (existing.artifact.size !== item.artifact.size) {
        throw new CompilerError(
          "SOURCE_ATTACHMENT_CONFLICT",
          `Artifact attachment ${item.artifact.resource} carries conflicting sizes`,
          item.artifact.resource,
        );
      }
      continue;
    }
    merged.set(key, {
      artifact: { ...item.artifact },
      open: item.open,
      ...(item.location === undefined ? {} : { location: item.location }),
    });
  }
  return [...merged.values()]
    .sort((left, right) => attachmentKey(left.artifact).localeCompare(attachmentKey(right.artifact)));
}

async function discoverClosure(
  entry: ResolvedSource,
  frontends: AuthorFrontendRegistryLike,
  workspace: WorkspaceSession,
): Promise<readonly DiscoveredUnit[]> {
  const units = new Map<string, DiscoveredUnit>();
  const visiting = new Set<string>();
  const visit = async (source: ResolvedSource): Promise<void> => {
    const selectedFrontend = source.frontend;
    const key = `${source.unit.id}\u0000${selectedFrontend}`;
    if (units.has(key)) return;
    if (visiting.has(key)) {
      throw new CompilerError("SOURCE_IMPORT_CYCLE", `Source imports cycle through ${source.unit.name}`, source.unit.id);
    }
    const frontend = frontends.resolve(selectedFrontend);
    if (frontend === undefined) {
      throw new CompilerError("UNKNOWN_FRONTEND", `Frontend ${selectedFrontend} is not registered`, selectedFrontend);
    }
    visiting.add(key);
    const discovery = await frontend.discover(source.unit);
    for (const request of discovery.sources) {
      await visit(await workspace.resolveSource(source.unit, request));
    }
    visiting.delete(key);
    units.set(key, { source, frontend: selectedFrontend, discovery });
  };
  await visit(entry);
  return [...units.values()];
}

export type CompilerOptions = {
  readonly modules: ModulePackageRegistryLike;
  readonly frontends: AuthorFrontendRegistryLike;
  /** Explicit definition environment selected by the Host. */
  readonly workspace: Workspace;
  /** Trusted Type-owner validators used to admit authored Records before linking. */
  readonly validators?: TypeValidatorRegistryLike;
};

export type CompiledAuthorSource = CompiledSourceClosure & {
  /** Host-side transfer bundle; bytes are not serialized into Core BuildState. */
  readonly attachments: readonly BlobAttachment[];
};

/** Domain-neutral compiler from a resolved Author Source to a verified Source Closure and Graph. */
export class Compiler {
  readonly #options: CompilerOptions;
  readonly #admitRecord: AuthorRecordAdmitter;

  constructor(options: CompilerOptions) {
    this.#options = options;
    this.#admitRecord = createRecordAdmitter(options.validators ?? new TypeValidatorRegistry());
  }

  supportsFrontend(id: string): boolean {
    return this.#options.frontends.resolve(id) !== undefined;
  }

  /** Open one read-once Workspace session for an explicitly selected entry locator. */
  async openEntry(locator: string): Promise<WorkspaceSession> {
    return await this.#options.workspace.open(locator);
  }

  async compileEntry(locator: string): Promise<CompiledAuthorSource> {
    const workspace = await this.openEntry(locator);
    return await this.compileResolvedSource(workspace.entry, workspace);
  }

  /** Compile an explicitly resolved Source inside one already isolated Workspace. */
  async compileResolvedSource(entry: ResolvedSource, workspace: WorkspaceSession): Promise<CompiledAuthorSource> {
    const discovered = await discoverClosure(
      entry,
      this.#options.frontends,
      workspace,
    );
    const closure = this.#options.modules.createClosure(
      discovered.flatMap((unit) => unit.discovery.modules),
    );
    const discoveries = new Map(discovered.map((unit) => [
      `${unit.source.unit.id}\u0000${unit.frontend}`,
      unit.discovery,
    ]));
    const compilation = await compileSourceClosure({
      entry,
      closure,
      frontends: this.#options.frontends,
      discover(source, frontend) {
        const discovery = discoveries.get(`${source.id}\u0000${frontend.id}`);
        if (discovery === undefined) {
          throw new CompilerError(
            "SOURCE_DISCOVERY_MISSING",
            `Source ${source.name} was not present in the frozen discovery closure`,
            source.id,
          );
        }
        return discovery;
      },
      resolveSource: workspace.resolveSource,
      resolveAsset: workspace.resolveAsset,
      admitRecord: this.#admitRecord,
    });
    return {
      ...compilation,
      attachments: mergeAttachments([await workspace.attachments()]),
    };
  }

  /**
   * Add modules used only by Run implementations. Author records stay unchanged.
   */
  extendExecutionProgram(program: LinkedProgram, requests: readonly string[]): LinkedProgram {
    const existing = program.closure.modules.map((item) => `${item.manifest.name}@${item.manifest.version}`);
    if (requests.every((request) => existing.includes(request))) return program;
    const closure = this.#options.modules.createClosure([...existing, ...requests]);
    return link(closure, program.records);
  }

  /** Admit one selected Run value through the same Type-owner boundary as authored Records. */
  async admitRecord(program: LinkedProgram, record: import("@qflow/protocol").TypedRecord): Promise<void> {
    await this.#admitRecord(program.closure, record);
  }

}
