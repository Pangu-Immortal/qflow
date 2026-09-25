import { fileReferenceIdentity, locateRepositoryBuildResultOutput, ownedFileReference } from "@qflow/build-result";
import { randomUUID } from "node:crypto";
import type {
  BuildResultRepository,
  BuildResultFileRef,
  BuildResultValuePath,
  RepositoryBuildResultOutput,
} from "@qflow/build-result";
import { NodeRunCompiler } from "@qflow/compiler-node";
import type {
  NodeCompiledRun,
  NodeCompiler,
} from "@qflow/compiler-node";
import type { NodePackageContribution } from "@qflow/package-loader-node";
import type { ArtifactAttachment, WorkspaceSession } from "@qflow/workspace";
import type { BlobRef, CanonicalValue, StoredValue } from "@qflow/protocol";
import {
  installRunFragmentHostFacets,
  runFrontendsFromHostFacets,
  RunFragmentRegistry,
  RunFrontendRegistry,
} from "@qflow/run";
import type { RunFrontend } from "@qflow/run";

export type LoadedRunFile = NodeCompiledRun & {
  readonly path: string;
  readonly compiler: NodeRunCompiler;
  readonly resultResourceReferences: Readonly<Record<string, BuildResultFileRef>>;
};

type BuildResultResolutionSession = {
  readonly files: Map<string, ArtifactAttachment>;
  readonly references: Map<string, BuildResultFileRef>;
  readonly outputs: Map<string, Promise<RepositoryBuildResultOutput | undefined>>;
};

function createBuildResultResolutionSession(): BuildResultResolutionSession {
  return { files: new Map(), outputs: new Map(), references: new Map() };
}

export async function checkRunFile(options: {
  readonly workspace: WorkspaceSession;
  readonly authorCompiler: NodeCompiler;
  readonly frontends: readonly RunFrontend[];
  readonly packageContributions: readonly NodePackageContribution[];
}) {
  const compiler = createRunCompiler(options);
  return await compiler.checkSource(options.workspace.entry, options.workspace);
}

type ResultValueBindingTree = {
  replacement?: BlobRef;
  readonly children: Map<string | number, ResultValueBindingTree>;
};

function bindResultResources(
  value: CanonicalValue,
  bindings: readonly { readonly at: BuildResultValuePath; readonly replacement: BlobRef }[],
): CanonicalValue {
  const root: ResultValueBindingTree = { children: new Map() };
  for (const binding of bindings) {
    let node = root;
    for (const segment of binding.at) {
      let child = node.children.get(segment);
      if (child === undefined) {
        child = { children: new Map() };
        node.children.set(segment, child);
      }
      node = child;
    }
    if (node.replacement !== undefined) {
      throw new Error(`Result Resource path ${JSON.stringify(binding.at)} is bound more than once`);
    }
    node.replacement = binding.replacement;
  }
  const rebuild = (current: CanonicalValue, node: ResultValueBindingTree, path: BuildResultValuePath): CanonicalValue => {
    if (node.replacement !== undefined) {
      if (node.children.size > 0 || current !== null) {
        throw new Error(`Result Resource path ${JSON.stringify(path)} does not address a null Resource slot`);
      }
      return node.replacement;
    }
    if (node.children.size === 0) return current;
    if (Array.isArray(current)) {
      for (const segment of node.children.keys()) {
        if (typeof segment !== "number" || segment < 0 || segment >= current.length) {
          throw new Error(`Result Resource path ${JSON.stringify([...path, segment])} does not address an array item`);
        }
      }
      return current.map((item, index) => {
        const child = node.children.get(index);
        return child === undefined ? item : rebuild(item, child, [...path, index]);
      });
    }
    if (current === null || typeof current !== "object") {
      throw new Error(`Result Resource path ${JSON.stringify(path)} does not address a container`);
    }
    const record = current as Readonly<Record<string, CanonicalValue>>;
    const result: Record<string, CanonicalValue> = { ...record };
    for (const [segment, child] of node.children) {
      if (typeof segment !== "string" || !Object.hasOwn(record, segment)) {
        throw new Error(`Result Resource path ${JSON.stringify([...path, segment])} does not address an object property`);
      }
      result[segment] = rebuild(record[segment]!, child, [...path, segment]);
    }
    return result;
  };
  return rebuild(value, root, []);
}

/** Resolve one historical public Output into an ordinary Run value plus lazy file attachments. */
export async function resolveBuildResultValue(
  repository: BuildResultRepository,
  build: string,
  output: string,
  session: BuildResultResolutionSession = createBuildResultResolutionSession(),
): Promise<{
  readonly type: RepositoryBuildResultOutput["type"];
  readonly value: StoredValue;
  readonly attachments?: readonly ArtifactAttachment[];
  } | undefined> {
  const manifest = await repository.read(build);
  if (manifest?.outcome === undefined) return undefined;
  const resultAttachment = async (owner: string, file: BuildResultFileRef): Promise<ArtifactAttachment> => {
    const address = fileReferenceIdentity(owner, file);
    const existing = session.files.get(address);
    if (existing !== undefined) return existing;
    file = await repository.describeFile(owner, file);
    const artifact: BlobRef = {
      kind: "blob",
      resource: `res_${randomUUID()}`,
      size: file.size,
      mediaType: file.mediaType,
    };
    const attachment = {
      artifact,
      async open() {
        const stream = await repository.openFile(owner, file);
        if (stream === undefined) throw new Error(`File ${address} is unavailable`);
        return stream;
      },
    };
    session.files.set(address, attachment);
    session.references.set(artifact.resource, ownedFileReference(owner, file));
    return attachment;
  };
  const attachments = new Map<string, ArtifactAttachment>();
  const address = `${build}\u0000${output}`;
  let pending = session.outputs.get(address);
  if (pending === undefined) {
    pending = repository.resolve(build, output);
    session.outputs.set(address, pending);
  }
  const resolved = await pending;
  if (resolved === undefined) return undefined;
  const owner = resolved.build === build ? manifest : await repository.read(resolved.build);
  if (owner?.outcome === undefined) return undefined;
  let value: StoredValue;
  if (resolved.value.kind === "build-file" || resolved.value.kind === "external-file") {
    const attachment = await resultAttachment(resolved.build, resolved.value);
    attachments.set(attachment.artifact.resource, attachment);
    value = attachment.artifact;
  } else if (resolved.value.kind === "inline") {
    value = { kind: "inline", value: resolved.value.value };
  } else {
    const bindings: Array<{ readonly at: BuildResultValuePath; readonly replacement: BlobRef }> = [];
    for (const binding of resolved.value.document.resources) {
      const attachment = await resultAttachment(resolved.build, binding.file);
      attachments.set(attachment.artifact.resource, attachment);
      bindings.push({ at: binding.at, replacement: attachment.artifact });
    }
    const composite = bindResultResources(resolved.value.document.value, bindings);
    value = { kind: "inline", value: composite };
  }
  return {
    type: resolved.type,
    value,
    ...(attachments.size === 0 ? {} : { attachments: [...attachments.values()] }),
  };
}

function createRunCompiler(options: {
  readonly authorCompiler: NodeCompiler;
  readonly frontends: readonly RunFrontend[];
  readonly packageContributions: readonly NodePackageContribution[];
  readonly results?: BuildResultRepository;
}, resultSession = createBuildResultResolutionSession()): NodeRunCompiler {
  const fragments = new RunFragmentRegistry();
  for (const item of options.packageContributions) {
    installRunFragmentHostFacets(item.hostFacets ?? [], fragments);
  }
  const frontends = new RunFrontendRegistry();
  for (const frontend of options.frontends) frontends.register(frontend);
  return new NodeRunCompiler({
    authorCompiler: options.authorCompiler,
    frontends,
    fragments,
    ...(options.results === undefined ? {} : {
      async locateHistoricalOutput(id: string, output: string) {
        return await locateRepositoryBuildResultOutput(options.results!, id, output);
      },
      async resolveHistoricalOutput(id: string, output: string) {
        return await resolveBuildResultValue(options.results!, id, output, resultSession);
      },
    }),
  });
}

export function collectRunFrontends(
  packages: readonly NodePackageContribution[],
): readonly RunFrontend[] {
  return packages.flatMap((item) => runFrontendsFromHostFacets(item.hostFacets ?? []));
}

export async function loadRunFile(options: {
  readonly workspace: WorkspaceSession;
  readonly authorCompiler: NodeCompiler;
  readonly frontends: readonly RunFrontend[];
  readonly packageContributions: readonly NodePackageContribution[];
  readonly results?: BuildResultRepository;
}): Promise<LoadedRunFile> {
  const resultSession = createBuildResultResolutionSession();
  const compiler = createRunCompiler(options, resultSession);
  const compiled = await compiler.compileSource(options.workspace.entry, options.workspace);
  const references = new Map<string, BuildResultFileRef>(compiled.attachments.flatMap((attachment) =>
    attachment.location === undefined ? [] : [[attachment.artifact.resource, {
      kind: "external-file" as const, uri: attachment.location,
      size: attachment.artifact.size, mediaType: attachment.artifact.mediaType,
    }]]));
  for (const [resource, file] of resultSession.references) references.set(resource, file);
  return { path: options.workspace.entry.id, compiler, ...compiled, resultResourceReferences: Object.fromEntries(references) };
}
