import type { RunFrontend } from "@qflow/run";
import { decodeSourceText } from "@qflow/source";

import { parseRunDocument } from "./syntax.js";

export const runMarkupFrontendId = "@qflow/markup/run@1";

export const runMarkupFrontend: RunFrontend = {
  id: runMarkupFrontendId,
  discover(source) {
    const document = parseRunDocument(source.name, decodeSourceText(source));
    return { author: document.author, imports: document.imports };
  },
  decode(source) {
    return { document: parseRunDocument(source.name, decodeSourceText(source)) };
  },
};
