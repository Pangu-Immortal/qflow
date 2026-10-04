import assert from "node:assert/strict";
import test from "node:test";

import { compositionTypes } from "@qflow/composition";
import { captionTypes } from "@qflow/caption";

import type { CompiledSource } from "../src/compile.js";
import { traceFor } from "../src/studio-trace.js";

test("Track traces retain direct references to author Records", () => {
  const source = {
    compiled: {
      program: {
        records: [{
          id: "source::record::story.caption",
          type: captionTypes.document,
          value: { kind: "inline", value: {} },
        }],
      },
      provenance: {
        elements: [{
          records: [{ local: "story.caption", id: "source::record::story.caption" }],
        }],
      },
    },
    observations: {
      placements: [{
        tag: "caption-fine:Caption",
        surface: "track",
        module: { name: "@qflow/caption-fine", version: "1" },
        id: "captions",
        outputs: ["source::output::captions.track"],
        outputPorts: [{ name: "track", ref: "source::output::captions.track" }],
        resolvedReferenceAttributes: { document: "source::record::story.caption" },
        children: [],
      }],
    },
    exports: [{
      name: "captions.track",
      type: compositionTypes.visualTrack.name,
      typeRef: compositionTypes.visualTrack,
      ref: "source::output::captions.track",
    }],
  } as unknown as CompiledSource;

  assert.deepEqual(traceFor(source, "source::output::captions.track").references, [{
    input: "document",
    name: "story.caption",
    ref: "source::record::story.caption",
    type: captionTypes.document.name,
    typeRef: captionTypes.document,
  }]);
});
