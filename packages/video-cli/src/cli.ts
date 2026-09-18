#!/usr/bin/env node
import { renderCliError, writeCliHelp } from "@qflow/cli";
import type { CliIo } from "@qflow/cli";
import { creationCommands, isCreationCommand, writeCreationHelp } from "./creation.js";
import { isMediaCommand, mediaCommands, writeMediaHelp } from "./media.js";
import { writeVocabularyHelp } from "./vocabulary.js";
import { writeSnapshotHelp } from "./snapshot.js";
import { writeCaptureHelp } from "./capture.js";
import { runVersionCli, writeVersionHelp } from "./version.js";
import { acceptSecretBytes } from "./secret-input.js";

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const debug = argv.includes("--debug");
const colorIndex = argv.indexOf("--color");
const colorMode = argv.includes("--no-color")
  ? "never"
  : colorIndex >= 0 ? argv[colorIndex + 1] : "auto";
const color = !json && colorMode !== "never" && process.env.TERM !== "dumb"
  && (colorMode === "always" || (process.env.NO_COLOR === undefined && process.stdout.isTTY === true));
const unicode = process.env.TERM !== "dumb";

async function readSecret(prompt: string): Promise<string> {
  if (process.stdin.isTTY !== true || typeof process.stdin.setRawMode !== "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8");
  }
  process.stderr.write(prompt);
  return await new Promise<string>((resolve, reject) => {
    const raw: number[] = [];
    const finish = (error?: Error): void => {
      process.stdin.off("data", input);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write("\n");
      if (error === undefined) resolve(Buffer.from(raw).toString("utf8"));
      else reject(error);
    };
    const input = (chunk: Buffer): void => {
      const result = acceptSecretBytes(raw, chunk);
      if (result === "cancelled") finish(new Error("credential input cancelled"));
      if (result === "done") finish();
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", input);
  });
}

const io: CliIo = {
  write: (text) => process.stdout.write(text),
  writeProgress: (text) => process.stderr.write(text),
  setExitCode: (code) => { process.exitCode = code; },
  readSecret,
  terminal: {
    isTTY: process.stdout.isTTY === true,
    color,
    unicode,
    columns: process.stdout.columns ?? 100,
  },
};

async function main(): Promise<void> {
  const commandArgs = argv[0] === "capture" && argv.includes("--") ? argv.slice(0, argv.indexOf("--")) : argv;
  if (argv.length === 0 || argv[0] === "help" || commandArgs.includes("--help")) {
    const topic = argv[0] === "help" ? argv[1]
      : argv[0] === "--help" ? undefined
      : argv.includes("--help") ? argv[0] : undefined;
    if (topic === "snapshot") { writeSnapshotHelp(io); return; }
    if (topic === "version") { writeVersionHelp(io); return; }
    if (isCreationCommand(topic)) {
      writeCreationHelp(io, topic);
      return;
    }
    if (topic === "media") {
      const sub = argv[0] === "help" ? argv[2] : argv[1];
      writeMediaHelp(io, isMediaCommand(sub) ? sub : undefined);
      return;
    }
    if (topic === "vocabulary") {
      writeVocabularyHelp(io);
      return;
    }
    if (topic === "capture") {
      writeCaptureHelp(io);
      return;
    }
    writeCliHelp(io, topic);
    if (topic === undefined) {
      io.write(`\nInstallation\n  version [--check] [--registry <url>] [--json]\n\nCreation tools (one request through the selected Runtime Profile, no Build)\n${
        [...creationCommands, "snapshot"].map((item) => `  ${item}`).join("\n")}\n  qflow help <tool> for each\n`
        + `\nStudio\n  studio --run <build.svrun>\n  qflow studio --help for session options\n\nPreparation (local tools and project files)\n  media ${mediaCommands.join(" | ")}\n  capture screenshot | run | install-browser\n  vocabulary\n  qflow help media, qflow help capture, qflow help vocabulary\n`);
    }
    return;
  }
  if (argv[0] === "version") { await runVersionCli(argv, io); return; }
  const { runVideoCli } = await import("./index.js");
  await runVideoCli(argv, io);
}

main().catch((error: unknown) => {
  const rendered = renderCliError(error, {
    json,
    color: !json && colorMode !== "never" && process.env.TERM !== "dumb"
      && (colorMode === "always" || (process.env.NO_COLOR === undefined && process.stderr.isTTY === true)),
    unicode,
    debug,
  });
  (json ? process.stdout : process.stderr).write(rendered);
  process.exitCode = 1;
});
