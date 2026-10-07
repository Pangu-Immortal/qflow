import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ModulePackageRegistry,
  Compiler,
  CompilerError,
  RunCompiler,
} from "@qflow/compiler";
import {
  AuthorFrontendRegistry,
  sealGraphFragment,
} from "@qflow/author";
import type {
  AuthorSourceAssetRequest,
  AuthorSourceImport,
  AuthorSourceUnit,
} from "@qflow/author";
import type {
  BlobRef,
  ModuleManifest,
  ModuleRef,
  ProducerRef,
  TypeRef,
} from "@qflow/protocol";
import { decodeSourceText } from "@qflow/source";
import { resolveSelfDescribedTextSource, SourceHeaderError } from "@qflow/source/text";
import {
  RunFragmentRegistry,
  RunFrontendRegistry,
} from "@qflow/run";
import { runMarkupFrontend } from "@qflow/markup/run";
import type { BlobAttachment, Workspace } from "@qflow/workspace";
import { WorkspaceError } from "@qflow/workspace";
import {
  createMarkupAuthorFrontend,
  MarkupSurfaceRegistry,
} from "@qflow/markup";
import { NodeFilesystemWorkspace } from "@qflow/workspace/node";

const rawSourceAdapter = (unit: import("@qflow/source").SourceUnit) => ({ unit, frontend: "test.frontend@1" });

function emptyManifest(name: string, version = "1"): ModuleManifest {
  return {
    format: "qflow.module@1",
    name,
    version,
    dependencies: [],
    types: [],
    capabilities: [],
    producers: [],
  };
}

test("registered module imports close transitive module dependencies", () => {
  const base = emptyManifest("example.base");
  const feature: ModuleManifest = {
    ...emptyManifest("example.feature"),
    dependencies: [{
      module: { name: base.name, version: base.version },
    }],
  };
  const modules = new ModulePackageRegistry();
  modules.register({ manifest: base });
  modules.register({ manifest: feature, specifiers: ["example.feature@stable"] });

  assert.deepEqual(modules.resolve("example.feature@stable"), { name: feature.name, version: feature.version });
  assert.deepEqual(
    modules.createClosure(["example.feature@stable"]).modules.map((item) => item.manifest.name).sort(),
    ["example.base", "example.feature"],
  );
});

test("module registration is atomic", () => {
  const first = emptyManifest("example.first");
  const second = emptyManifest("example.second");
  const modules = new ModulePackageRegistry();
  modules.register({ manifest: first, specifiers: ["example.shared@1"] });
  assert.throws(
    () => modules.register({ manifest: second, specifiers: ["example.shared@1"] }),
    (error: unknown) => error instanceof CompilerError && error.code === "DUPLICATE_MODULE_SPECIFIER",
  );
  assert.equal(modules.resolve("example.second@1"), undefined);

});

const laboratory = { name: "example.compiler-lab", version: "1" } as const;
const resultType = { module: laboratory, name: "Result" } satisfies TypeRef;
const producer = { module: laboratory, name: "produce" } satisfies ProducerRef;
const resultSurface = {
  name: "result", tag: "Result", mode: "structured", outputs: [],
} as const;
const laboratoryManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: laboratory.name,
  version: laboratory.version,
  dependencies: [],
  types: [{ name: resultType.name }],
  capabilities: [],
  producers: [{
    name: producer.name,
    inputs: [],
    outputs: [{ name: "result", type: resultType }],
    needs: [],
  }],
};
const fragment = sealGraphFragment({
  inputs: [],
  operations: [{
    id: "produce",
    producer,
    inputs: {},
    result: { kind: "output", name: "result" },
  }],
  exports: [{
    name: "result",
    type: resultType,
    root: { kind: "fragment-operation", operation: "produce" },
  }],
});

const assetLaboratory = { name: "example.asset-lab", version: "1" } as const;
const assetType = { module: assetLaboratory, name: "Asset" } satisfies TypeRef;
const assetSurface = {
  name: "asset", tag: "Asset", mode: "structured", outputs: [assetType],
} as const;
const assetManifest: ModuleManifest = {
  ...emptyManifest(assetLaboratory.name),
  types: [{ name: assetType.name }],
};

function compiler(
  root: string,
  additional: readonly ModuleManifest[] = [],
  onDiscover?: () => void,
): Compiler {
  const modules = new ModulePackageRegistry();
  modules.register({ manifest: laboratoryManifest });
  for (const manifest of additional) modules.register({ manifest });
  const surfaces = new MarkupSurfaceRegistry();
  surfaces.registerStructured({
    module: laboratory,
    declaration: resultSurface,
    handler: ({ element }) => {
    const id = element.attributes.id;
    if (typeof id !== "string") throw new Error("Result id is required");
    return {
      records: [],
      components: [{
        id,
        fragment: fragment.id,
        inputs: {},
        outputs: { result: `${id}.result` },
        range: element.range,
      }],
      fragments: [fragment],
    };
    },
  });
  const frontends = new AuthorFrontendRegistry();
  const frontend = createMarkupAuthorFrontend({
    registry: surfaces,
    resolveModule(request): ModuleRef {
      const resolved = modules.resolve(request.from);
      if (resolved === undefined) throw new Error(`unknown module ${request.from}`);
      return resolved;
    },
  });
  frontends.register({
    ...frontend,
    discover(source) {
      onDiscover?.();
      return frontend.discover(source);
    },
  });
  return new Compiler({ modules, frontends, workspace: new NodeFilesystemWorkspace({ root }) });
}

const previewModule = { name: "example.compiler-preview", version: "1" } as const;
const previewProducer = { module: previewModule, name: "preview" } satisfies ProducerRef;
const consumeProducer = { module: previewModule, name: "consume" } satisfies ProducerRef;
const previewManifest: ModuleManifest = {
  ...emptyManifest(previewModule.name),
  dependencies: [{
    module: laboratory,
  }],
  producers: [{
    name: previewProducer.name,
    inputs: [],
    outputs: [{ name: "result", type: resultType }],
    needs: [],
  }, {
    name: consumeProducer.name,
    inputs: [{ name: "source", type: resultType }],
    outputs: [{ name: "result", type: resultType }],
    needs: [],
  }],
};
const previewFragment = sealGraphFragment({
  inputs: [],
  operations: [{
    id: "preview",
    producer: previewProducer,
    inputs: {},
    result: { kind: "output", name: "result" },
  }],
  exports: [{
    name: "result",
    type: resultType,
    root: { kind: "fragment-operation", operation: "preview" },
  }],
});
const consumeFragment = sealGraphFragment({
  inputs: [{ name: "source", type: resultType }],
  operations: [{
    id: "consume",
    producer: consumeProducer,
    inputs: { source: { kind: "fragment-input", name: "source" } },
    result: { kind: "output", name: "result" },
  }],
  exports: [{
    name: "result",
    type: resultType,
    root: { kind: "fragment-operation", operation: "consume" },
  }],
});

function assetCompiler(environment: { readonly root: string } | { readonly workspace: Workspace }): Compiler {
  const modules = new ModulePackageRegistry();
  modules.register({ manifest: assetManifest });
  modules.register({ manifest: laboratoryManifest });
  const surfaces = new MarkupSurfaceRegistry();
  surfaces.registerStructured({
    module: laboratory,
    declaration: resultSurface,
    handler: ({ element }) => {
      const id = element.attributes.id;
      if (typeof id !== "string") throw new Error("Result id is required");
      return {
        records: [],
        components: [{ id, fragment: fragment.id, inputs: {}, outputs: { result: `${id}.result` }, range: element.range }],
        fragments: [fragment],
      };
    },
  });
  surfaces.registerStructured({
    module: assetLaboratory,
    declaration: assetSurface,
    handler: async ({ element, resolveAsset }) => {
    const id = element.attributes.id;
    const src = element.attributes.src;
    if (typeof id !== "string" || typeof src !== "string") throw new Error("Asset id and src are required");
    const resolved = await resolveAsset({
      from: src,
      mediaType: "application/octet-stream",
      ...(src === "package:example.asset-lab/embedded.bin"
        ? { bytes: new Uint8Array([8, 6, 7, 5, 3, 0, 9]) }
        : {}),
      range: element.range,
    });
    return {
      records: [{ id, type: assetType, value: resolved.artifact, range: element.range }],
      components: [],
      fragments: [],
    };
    },
  });
  const frontends = new AuthorFrontendRegistry();
  frontends.register(createMarkupAuthorFrontend({
    registry: surfaces,
    resolveModule(request): ModuleRef {
      const resolved = modules.resolve(request.from);
      if (resolved === undefined) throw new Error(`unknown module ${request.from}`);
      return resolved;
    },
  }));
  return new Compiler({
    modules,
    frontends,
    workspace: "workspace" in environment
      ? environment.workspace
      : new NodeFilesystemWorkspace({ root: environment.root }),
  });
}

function memoryWorkspace(sourceText: string, assetBytes: Uint8Array): Workspace {
  return {
    async open(entryLocator) {
      const entry = resolveSelfDescribedTextSource({ id: entryLocator, name: "main.svml", text: sourceText });
      let attachment: { readonly artifact: BlobRef; readonly open: () => AsyncIterable<Uint8Array> } | undefined;
      return {
        entry,
        async resolveSource(_importer: AuthorSourceUnit, request: AuthorSourceImport) {
          throw new WorkspaceError("UNKNOWN_MEMORY_SOURCE", `No memory source satisfies ${request.from}`, request.from);
        },
        async resolveAsset(importer: AuthorSourceUnit, request: AuthorSourceAssetRequest) {
          if (importer !== entry.unit || request.from !== "./reference.bin") {
            throw new WorkspaceError("UNKNOWN_MEMORY_ASSET", `No memory asset satisfies ${request.from}`, request.from);
          }
          const bytes = Uint8Array.from(assetBytes);
          const artifact: BlobRef = {
            kind: "blob",
            resource: "res_memory-reference",
            size: bytes.byteLength,
            mediaType: request.mediaType,
          };
          attachment = { artifact, open: async function* () { yield Uint8Array.from(bytes); } };
          return { artifact: { ...artifact } };
        },
        attachments() {
          return attachment === undefined
            ? []
            : [{ artifact: { ...attachment.artifact }, open: attachment.open }];
        },
      };
    },
  };
}

async function readAttachment(attachment: BlobAttachment | undefined): Promise<Uint8Array | undefined> {
  if (attachment === undefined) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of await attachment.open()) {
    chunks.push(Uint8Array.from(chunk));
    size += chunk.byteLength;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

test("Node Compiler discovers real imports and emits a named public Author Graph export", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-compiler-node-"));
  const file = join(root, "main.svml");
  await writeFile(file, `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="lab" from="example.compiler-lab@1"/>
    <lab:Result id="hello"/>
  </svml>`, "utf8");

  let discoveries = 0;
  const compiled = await compiler(root, [], () => { discoveries += 1; }).compileEntry(file);
  assert.equal(compiled.exports[0]?.name, "hello.result");
  assert.equal(compiled.graph.outputs.length, 1);
  assert.equal(discoveries, 1, "the frozen Import Prologue must not execute Frontend discovery twice");

});

test("the self-described text adapter requires a Header and ignores the filename suffix", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-self-described-source-"));
  const text = `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="lab" from="example.compiler-lab@1"/>
    <lab:Result id="hello"/>
  </svml>`;
  const svml = join(root, "main.svml");
  const arbitrary = join(root, "main.anything");
  await writeFile(svml, text, "utf8");
  await writeFile(arbitrary, text, "utf8");
  const first = await compiler(root).compileEntry(svml);
  const second = await compiler(root).compileEntry(arbitrary);
  assert.equal(first.exports[0]?.name, "hello.result");
  assert.equal(second.exports[0]?.name, "hello.result");

  const missing = join(root, "missing.svml");
  await writeFile(missing, "<svml/>", "utf8");
  await assert.rejects(
    compiler(root).compileEntry(missing),
    (error: unknown) => error instanceof SourceHeaderError && error.code === "SOURCE_HEADER_MISSING",
  );
});

test("Run-only Fragment modules extend the execution closure without polluting the Author Graph", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-dual-graph-closure-"));
  const unused = emptyManifest("example.unused-video-feature");
  const authorFile = join(root, "main.svml");
  const runFile = join(root, "build.svrun");
  await writeFile(authorFile, `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="lab" from="example.compiler-lab@1"/>
    <import as="unused" from="example.unused-video-feature@1"/>
    <lab:Result id="hello"/>
  </svml>`, "utf8");
  await writeFile(runFile, `<?svml using="@qflow/markup/run@1"?>
  <svrun version="1">
    <author source="./main.svml"/>
    <import from="@example/preview" as="preview"/>
    <target output="hello.result"/>
    <fragment id="one" using="preview:result"/>
    <satisfy output="hello.result" candidate="one.result"/>
  </svrun>`, "utf8");

  const authorCompiler = compiler(root, [previewManifest, unused]);
  const frontends = new RunFrontendRegistry();
  frontends.register(runMarkupFrontend);
  const fragments = new RunFragmentRegistry();
  fragments.register({ name: "@example/preview", fragments: { result: previewFragment } });
  const runCompiler = new RunCompiler({ authorCompiler, frontends, fragments });
  const compiled = await runCompiler.compileEntry(runFile);
  const planned = runCompiler.planCompilation(compiled);

  assert.deepEqual(
    compiled.author.program.closure.modules.map((item) => item.manifest.name),
    [laboratory.name, unused.name],
  );
  assert.deepEqual(
    compiled.program.closure.modules.map((item) => item.manifest.name).sort(),
    [laboratory.name, previewModule.name, unused.name].sort(),
  );
  assert.deepEqual(
    planned.state.program.closure.modules.map((item) => item.manifest.name).sort(),
    [laboratory.name, previewModule.name].sort(),
    "the durable Build keeps only modules needed by its selected execution slice",
  );
  assert.equal(planned.definition.plan, planned.state.plan);
  assert.equal(planned.definition.targets, planned.state.targets);
  assert.equal(planned.definition.plan.steps.length, 1);
  assert.equal(planned.definition.plan.steps[0]?.producer.name, previewProducer.name);
});

test("static Run checking accepts a future BuildRecord without opening project Results", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-future-build-record-"));
  const authorFile = join(root, "main.svml");
  const runFile = join(root, "reuse.svrun");
  await writeFile(authorFile, `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="lab" from="example.compiler-lab@1"/>
    <lab:Result id="hello"/>
  </svml>`, "utf8");
  await writeFile(runFile, `<?svml using="@qflow/markup/run@1"?>
  <svrun version="1">
    <author source="./main.svml"/>
    <target output="hello.result"/>
    <build-record id="prior" build="future-build" output="hello.result"/>
    <satisfy output="hello.result" candidate="prior"/>
  </svrun>`, "utf8");
  const authorCompiler = compiler(root);
  const frontends = new RunFrontendRegistry();
  frontends.register(runMarkupFrontend);
  const runCompiler = new RunCompiler({
    authorCompiler,
    frontends,
    fragments: new RunFragmentRegistry(),
  });
  const workspace = await new NodeFilesystemWorkspace({ root }).open(runFile);
  const checked = await runCompiler.checkResolvedSource(workspace.entry, workspace);
  assert.deepEqual(checked.unresolvedHistoricalOutputs, [{
    id: "prior",
    build: "future-build",
    output: "hello.result",
  }]);
  await assert.rejects(
    runCompiler.compileResolvedSource(workspace.entry, workspace),
    /requires a project Result Store/u,
  );

  await writeFile(authorFile, `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="lab" from="example.compiler-lab@1"/>
    <lab:Result id="hello"/><lab:Result id="unused-history"/>
    <lab:Result id="unused-value"/><lab:Result id="unused-file"/>
  </svml>`, "utf8");
  await writeFile(runFile, `<?svml using="@qflow/markup/run@1"?>
  <svrun version="1">
    <author source="./main.svml"/>
    <target output="hello.result"/>
    <build-record id="prior" build="future-build" output="unused-history.result"/>
    <value id="fixed" type="example.compiler-lab@1#Result" from="./missing-value.json"/>
    <file id="media" type="example.compiler-lab@1#Result" from="./missing-file.mp4" media-type="video/mp4"/>
    <satisfy output="unused-history.result" candidate="prior"/>
    <satisfy output="unused-value.result" candidate="fixed"/>
    <satisfy output="unused-file.result" candidate="media"/>
  </svrun>`, "utf8");
  const unusedWorkspace = await new NodeFilesystemWorkspace({ root }).open(runFile);
  const compiled = await runCompiler.compileResolvedSource(unusedWorkspace.entry, unusedWorkspace);
  assert.equal(runCompiler.planCompilation(compiled).state.plan.steps.length, 1,
    "unreachable zero-input Candidates are never opened or substituted into the selected execution");

  await writeFile(join(root, "selected-value.json"), JSON.stringify({ kind: "inline", value: "ready" }), "utf8");
  await writeFile(join(root, "selected-file.mp4"), new Uint8Array([1, 2, 3]));
  await writeFile(runFile, `<?svml using="@qflow/markup/run@1"?>
  <svrun version="1">
    <author source="./main.svml"/>
    <target output="unused-value.result"/><target output="unused-file.result"/>
    <value id="fixed" type="example.compiler-lab@1#Result" from="./selected-value.json"/>
    <file id="media" type="example.compiler-lab@1#Result" from="./selected-file.mp4" media-type="video/mp4"/>
    <satisfy output="unused-value.result" candidate="fixed"/>
    <satisfy output="unused-file.result" candidate="media"/>
  </svrun>`, "utf8");
  const selectedWorkspace = await new NodeFilesystemWorkspace({ root }).open(runFile);
  const selected = runCompiler.planCompilation(await runCompiler.compileResolvedSource(selectedWorkspace.entry, selectedWorkspace));
  assert.deepEqual(selected.definition.initialRecords.map((record) => record.value.kind).sort(), ["blob", "inline"]);
});

test("a historical Output is materialized only when a selected Producer consumes it", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-consumed-build-record-"));
  const authorFile = join(root, "main.svml");
  const runFile = join(root, "reuse.svrun");
  await writeFile(authorFile, `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="lab" from="example.compiler-lab@1"/>
    <lab:Result id="source"/><lab:Result id="final"/>
  </svml>`, "utf8");
  await writeFile(runFile, `<?svml using="@qflow/markup/run@1"?>
  <svrun version="1">
    <author source="./main.svml"/>
    <import from="@example/preview" as="preview"/>
    <target output="final.result"/>
    <build-record id="prior" build="old-build" output="source.result"/>
    <fragment id="consumer" using="preview:consume"><input name="source" from="source.result"/></fragment>
    <satisfy output="source.result" candidate="prior"/>
    <satisfy output="final.result" candidate="consumer.result"/>
  </svrun>`, "utf8");

  const frontends = new RunFrontendRegistry();
  frontends.register(runMarkupFrontend);
  const fragments = new RunFragmentRegistry();
  fragments.register({
    name: "@example/preview",
    fragments: { result: previewFragment, consume: consumeFragment },
  });
  let located = 0;
  let resolved = 0;
  const runCompiler = new RunCompiler({
    authorCompiler: compiler(root, [previewManifest]),
    frontends,
    fragments,
    locateHistoricalOutput(build, output) {
      located += 1;
      assert.equal(build, "old-build");
      assert.equal(output, "source.result");
      return { build: "value-owner", output: "original.result", type: resultType };
    },
    resolveHistoricalOutput(build, output) {
      resolved += 1;
      assert.equal(build, "old-build");
      assert.equal(output, "source.result");
      return { type: resultType, value: { kind: "inline", value: "historical" } };
    },
  });

  const planned = await runCompiler.planEntry(runFile);
  assert.equal(located, 1, "the selected historical address is validated from its manifest");
  assert.equal(resolved, 1, "a Producer dependency materializes the historical value exactly once");
  assert.equal(planned.state.plan.steps.length, 1);
  assert.equal(planned.state.plan.steps[0]?.producer.name, consumeProducer.name);
  assert.deepEqual(planned.definition.initialRecords.map((record) => record.value), [{
    kind: "inline",
    value: "historical",
  }]);
  assert.equal(planned.resultForwards.length, 1);
  assert.match(planned.resultForwards[0]!.output, /::output::source\.result$/u);
  assert.deepEqual({ ...planned.resultForwards[0], output: "source.result" }, {
    output: "source.result",
    build: "value-owner",
    sourceOutput: "original.result",
    type: resultType,
  });
});

test("source assets become graph values and a Host transfer bundle without closure metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-source-assets-"));
  const file = join(root, "main.svml");
  const asset = join(root, "reference.bin");
  await writeFile(file, `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="asset" from="example.asset-lab@1"/>
    <asset:Asset id="reference" src="./reference.bin"/>
  </svml>`, "utf8");
  await writeFile(asset, new Uint8Array([1, 2, 3, 4]));

  const first = await assetCompiler({ root }).compileEntry(file);
  const attachment = first.attachments[0];
  assert.deepEqual(await readAttachment(attachment), new Uint8Array([1, 2, 3, 4]));
  assert.equal(first.program.records[0]?.value.kind, "blob");
  assert.equal(first.program.records[0]?.value.kind === "blob" ? first.program.records[0].value.resource : undefined, attachment?.artifact.resource);
  await writeFile(asset, new Uint8Array([9, 8, 7]));
  const second = await assetCompiler({ root }).compileEntry(file);
  assert.notEqual(second.attachments[0]?.artifact.resource, attachment?.artifact.resource);
});

test("an installed package Surface can contribute embedded bytes without an author file or network", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-embedded-assets-"));
  const file = join(root, "main.svml");
  await writeFile(file, `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="asset" from="example.asset-lab@1"/>
    <asset:Asset id="embedded" src="package:example.asset-lab/embedded.bin"/>
  </svml>`, "utf8");

  const compiled = await assetCompiler({ root }).compileEntry(file);
  const attachment = compiled.attachments[0];
  assert.deepEqual(await readAttachment(attachment), new Uint8Array([8, 6, 7, 5, 3, 0, 9]));
  assert.equal(compiled.program.records[0]?.value.kind, "blob");
  assert.equal(compiled.program.records[0]?.value.kind === "blob"
    ? compiled.program.records[0].value.resource
    : undefined, attachment?.artifact.resource);
});

test("Run compilation retains embedded Author attachments for later Runtime staging", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-run-author-attachments-"));
  const authorFile = join(root, "main.svml");
  const runFile = join(root, "build.svrun");
  await writeFile(authorFile, `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="asset" from="example.asset-lab@1"/>
    <import as="lab" from="example.compiler-lab@1"/>
    <asset:Asset id="embedded" src="package:example.asset-lab/embedded.bin"/>
    <lab:Result id="hello"/>
  </svml>`, "utf8");
  await writeFile(runFile, `<?svml using="@qflow/markup/run@1"?>
  <svrun version="1">
    <author source="./main.svml"/>
    <target output="hello.result"/>
  </svrun>`, "utf8");

  const authorCompiler = assetCompiler({ root });
  const frontends = new RunFrontendRegistry();
  frontends.register(runMarkupFrontend);
  const runCompiler = new RunCompiler({
    authorCompiler,
    frontends,
    fragments: new RunFragmentRegistry(),
  });
  const compiled = await runCompiler.compileEntry(runFile);
  assert.deepEqual(compiled.attachments.map((item) => item.artifact), compiled.author.attachments.map((item) => item.artifact));
  assert.deepEqual(await readAttachment(compiled.attachments[0]), new Uint8Array([8, 6, 7, 5, 3, 0, 9]));
});

test("filesystem Workspace captures source text and asset identity once", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "qflow-source-host-"));
  const root = join(parent, "project");
  await mkdir(root);
  const entryPath = join(root, "main.svml");
  const includedPath = join(root, "included.svs");
  const outsidePath = join(parent, "outside.svs");
  const assetPath = join(root, "asset.bin");
  await writeFile(entryPath, "first", "utf8");
  await writeFile(includedPath, "included-first", "utf8");
  await writeFile(outsidePath, "outside", "utf8");
  await writeFile(assetPath, new Uint8Array([1, 2, 3]));
  const workspace = await new NodeFilesystemWorkspace({ root, sourceAdapter: rawSourceAdapter }).open(entryPath);
  const entry = workspace.entry;
  await writeFile(entryPath, "second", "utf8");
  assert.equal(decodeSourceText((await new NodeFilesystemWorkspace({ root, sourceAdapter: rawSourceAdapter }).open(entryPath)).entry.unit), "second");
  assert.equal(decodeSourceText(entry.unit), "first");
  assert.equal(await readFile(entryPath, "utf8"), "second");
  const sourceRequest = { from: "./included.svs", alias: "included" };
  const firstIncluded = await workspace.resolveSource(entry.unit, sourceRequest);
  await writeFile(includedPath, "included-second", "utf8");
  assert.deepEqual(await workspace.resolveSource(entry.unit, sourceRequest), firstIncluded);
  assert.equal(decodeSourceText(firstIncluded.unit), "included-first");
  const firstAsset = await workspace.resolveAsset(entry.unit, { from: "./asset.bin", mediaType: "application/octet-stream" });
  await writeFile(assetPath, new Uint8Array([4, 5, 6, 7]));
  const capturedAsset = await workspace.resolveAsset(entry.unit, { from: "./asset.bin", mediaType: "application/octet-stream" });
  assert.deepEqual(capturedAsset, firstAsset, "one Workspace keeps an asset edge bound to the first bytes read");
  const detached = await workspace.attachments();
  assert.deepEqual(await readAttachment(detached[0]), new Uint8Array([4, 5, 6, 7]),
    "attachment bytes are opened lazily; Runtime rejects them if they no longer match the captured identity");
  assert.equal((await workspace.attachments())[0]?.artifact.resource, firstAsset.artifact.resource);
  await assert.rejects(
    async () => await workspace.resolveSource(entry.unit, {
      from: "../outside.svs",
      alias: "escaped",
    }),
    (error: unknown) => error instanceof WorkspaceError && error.code === "SOURCE_OUTSIDE_ROOT",
  );
  await assert.rejects(
    async () => await workspace.resolveAsset(entry.unit, {
      from: "../outside.svs",
      mediaType: "application/octet-stream",
    }),
    (error: unknown) => error instanceof WorkspaceError && error.code === "SOURCE_ASSET_OUTSIDE_ROOT",
  );
  await t.test("symlink escapes are rejected when the OS permits creating the link", async (t) => {
    try {
      await symlink(outsidePath, join(root, "escaped.svs"));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || (code !== "EPERM" && code !== "EACCES")) throw error;
      t.skip("Windows does not grant file symlink creation permission");
      return;
    }
    await assert.rejects(
      async () => await workspace.resolveSource(entry.unit, {
        from: "./escaped.svs",
        alias: "escaped",
      }),
      (error: unknown) => error instanceof WorkspaceError && error.code === "SOURCE_OUTSIDE_ROOT",
    );
    await assert.rejects(
      async () => await workspace.resolveAsset(entry.unit, {
        from: "./escaped.svs",
        mediaType: "application/octet-stream",
      }),
      (error: unknown) => error instanceof WorkspaceError && error.code === "SOURCE_ASSET_OUTSIDE_ROOT",
    );
  });
});

test("an asset root widens bytes without widening Source imports", async () => {
  const parent = await mkdtemp(join(tmpdir(), "qflow-asset-root-"));
  const project = join(parent, "project");
  const library = join(parent, "library");
  await mkdir(project);
  await mkdir(library);
  const entryPath = join(project, "main.svml");
  const assetPath = join(library, "shared.bin");
  const sourcePath = join(library, "shared.svs");
  await writeFile(entryPath, "entry", "utf8");
  await writeFile(assetPath, new Uint8Array([2, 7, 1, 8]));
  await writeFile(sourcePath, "shared source", "utf8");
  const workspace = await new NodeFilesystemWorkspace({ root: project, assetRoots: [library], sourceAdapter: rawSourceAdapter }).open(entryPath);
  assert.equal((await workspace.resolveAsset(workspace.entry.unit, {
    from: "../library/shared.bin",
    mediaType: "application/octet-stream",
  })).artifact.size, 4);
  await assert.rejects(async () => await workspace.resolveSource(workspace.entry.unit, {
    from: "../library/shared.svs",
    alias: "shared",
  }), (error: unknown) => error instanceof WorkspaceError && error.code === "SOURCE_OUTSIDE_ROOT");
});

test("a Host-resolved Source keeps relative imports inside its own read boundary", async () => {
  const parent = await mkdtemp(join(tmpdir(), "qflow-external-source-"));
  const project = join(parent, "project");
  const packageRoot = join(parent, "package");
  await mkdir(project);
  await mkdir(packageRoot);
  const entryPath = join(project, "main.svml");
  const kitPath = join(packageRoot, "kit.svs");
  const childPath = join(packageRoot, "child.svs");
  const outsidePath = join(parent, "outside.svs");
  await writeFile(entryPath, "entry", "utf8");
  await writeFile(kitPath, "kit", "utf8");
  await writeFile(childPath, "child", "utf8");
  await writeFile(outsidePath, "outside", "utf8");
  const workspace = await new NodeFilesystemWorkspace({
    root: project,
    sourceAdapter: rawSourceAdapter,
    externalSourceResolver(_importer, request) {
      assert.equal(request.from, "@acme/kits/example");
      return { root: packageRoot, source: kitPath };
    },
  }).open(entryPath);
  const kit = await workspace.resolveSource(workspace.entry.unit, {
    from: "@acme/kits/example",
    alias: "kit",
  });
  assert.equal(decodeSourceText((await workspace.resolveSource(kit.unit, { from: "./child.svs", alias: "child" })).unit), "child");
  await assert.rejects(
    async () => await workspace.resolveSource(kit.unit, { from: "../outside.svs", alias: "outside" }),
    (error: unknown) => error instanceof WorkspaceError && error.code === "SOURCE_OUTSIDE_ROOT",
  );
});

test("filesystem and in-memory Workspaces load identical asset bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-workspace-equivalence-"));
  const file = join(root, "main.svml");
  const source = `<?svml using="@qflow/markup@1"?>
  <svml>
    <import as="asset" from="example.asset-lab@1"/>
    <asset:Asset id="reference" src="./reference.bin"/>
  </svml>`;
  const bytes = new Uint8Array([3, 1, 4, 1, 5]);
  await writeFile(file, source, "utf8");
  await writeFile(join(root, "reference.bin"), bytes);

  const filesystem = await assetCompiler({ root }).compileEntry(file);
  const memory = await assetCompiler({ workspace: memoryWorkspace(source, bytes) }).compileEntry("memory:main");

  const memoryArtifact = memory.attachments[0]?.artifact;
  const filesystemArtifact = filesystem.attachments[0]?.artifact;
  assert.ok(memoryArtifact?.resource);
  assert.ok(filesystemArtifact?.resource);
  assert.notEqual(memoryArtifact.resource, filesystemArtifact.resource,
    "separate admissions keep separate resource identities even for equal bytes");
  assert.deepEqual(
    { size: memoryArtifact.size, mediaType: memoryArtifact.mediaType },
    { size: filesystemArtifact.size, mediaType: filesystemArtifact.mediaType },
  );
  assert.deepEqual(await readAttachment(memory.attachments[0]),
    await readAttachment(filesystem.attachments[0]));
});
