import type { CliCommandModule } from "@qflow/qflow/cli";

import { isMediaCommand, mediaCommands, runMediaCli, writeMediaHelp } from "./files.js";

export const cliCommandModules = [{
  format: "qflow.cli-command@1",
  id: "@qflow/media-local",
  commands: ["media"],
  writeRootHelp(io) {
    io.write(`\nLocal media\n  media ${mediaCommands.join(" | ")}\n  qflow media --help for exact options\n`);
  },
  writeHelp(argv, io) {
    const subcommand = argv[0] === "help" ? argv[2] : argv[1];
    writeMediaHelp(io, isMediaCommand(subcommand) ? subcommand : undefined);
  },
  async run(argv, io, context) {
    await runMediaCli(argv, io, context.cwd);
  },
}] as const satisfies readonly CliCommandModule[];

export { isMediaCommand, mediaCommands, runMediaCli, writeMediaHelp } from "./files.js";
export type { MediaCommand, MediaProbe } from "./files.js";
