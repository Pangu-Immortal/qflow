import type { CliCommandModule } from "@qflow/qflow/cli";

export const cliCommandModules = [{
  format: "qflow.cli-command@1",
  id: "@qflow/studio",
  commands: ["studio", "snapshot"],
  writeRootHelp(io) {
    io.write("\nStudio\n  studio --run <build.svrun>\n  snapshot --studio <url> ...\n  qflow studio --help or qflow snapshot --help\n");
  },
  async writeHelp(argv, io) {
    if ((argv[0] === "help" ? argv[1] : argv[0]) === "snapshot") {
      const { writeSnapshotHelp } = await import("./snapshot-cli.js");
      writeSnapshotHelp(io);
    } else {
      const { writeStudioHelp } = await import("./start.js");
      writeStudioHelp(io);
    }
  },
  async run(argv, io, context) {
    if (argv[0] === "snapshot") {
      const { runSnapshotCli } = await import("./snapshot-cli.js");
      await runSnapshotCli(argv, io, context);
    } else {
      const { runStudio } = await import("./start.js");
      await runStudio(argv.slice(1).filter((arg) => arg !== "--debug"), io, context);
    }
  },
}] as const satisfies readonly CliCommandModule[];
