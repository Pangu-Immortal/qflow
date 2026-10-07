import type { CliCommandModule } from "@qflow/qflow/cli";

import { runVocabularyCli, writeVocabularyHelp } from "./vocabulary.js";

/** The Video application owns only its installed author-vocabulary view. */
export const cliCommandModules = [{
  format: "qflow.cli-command@1",
  id: "@qflow/video",
  commands: ["vocabulary"],
  writeRootHelp(io) {
    io.write("\nVideo author vocabulary\n  vocabulary\n  qflow vocabulary --help for package and Surface inspection\n");
  },
  writeHelp(_argv, io) {
    writeVocabularyHelp(io);
  },
  async run(argv, io, context) {
    await runVocabularyCli(argv, io, context.cwd, context.distribution.packageRoot);
  },
}] as const satisfies readonly CliCommandModule[];
