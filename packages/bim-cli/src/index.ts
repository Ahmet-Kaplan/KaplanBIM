/**
 * `mutinybim`: one command to a running editor.
 *
 *   npx @permitzip/bim-cli editor            # http://127.0.0.1:3999
 *   npx @permitzip/bim-cli editor --port 8080 --open
 *
 * The server is the dev server the open-source tree already runs
 * (`npm run demo`, packages/bim-devserver), started as a library with its model
 * in memory. What it differs in: it serves the editor build this package
 * ships (`dist/editor`, made by scripts/build.mjs from packages/bim-editor)
 * instead of building one from a checkout, and it leaves out the F-a
 * feasibility viewer, whose bundle needs esbuild at run time.
 *
 * Terminal text is English, and stays English: the repo's i18n rule covers the
 * editor's screens, not what a command prints.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDevServer, type RunningDevServer } from "@permitzip/bim-devserver";
import { parseArgs, usage, type Command } from "./args";

export interface Io {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const processIo: Io = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

export interface EditorPaths {
  /** The prebuilt editor page and its bundle (app.js, chunks/, styles.css, report.json). */
  readonly editorDir: string;
  /** The files that page fetches at run time: fonts, brand art, wasm, workers, bim-ui assets. */
  readonly staticRoot: string;
}

/** Where this copy of the CLI keeps its editor build: dist/ beside src/ or beside the bundle, so both work. */
export function defaultPaths(here: string = path.dirname(fileURLToPath(import.meta.url))): EditorPaths {
  const dist = path.resolve(here, "..", "dist");
  return { editorDir: path.join(dist, "editor"), staticRoot: path.join(dist, "static") };
}

/** The sentence to print when the shipped editor build is not there. */
export const MISSING_EDITOR = (dir: string): string =>
  `The editor page this command serves is missing: ${dir} has no app.js. Reinstall @permitzip/bim-cli, or to build it from a checkout run "npm run build" in packages/bim-cli.`;

/**
 * Serve the editor and its model on `port` (0 for any free port) and return
 * once it answers. The model is in memory: it stops with the process.
 */
export async function startEditor(
  command: { readonly port: number; readonly dataDir: string | null },
  paths: EditorPaths = defaultPaths(),
): Promise<RunningDevServer> {
  if (!existsSync(path.join(paths.editorDir, "app.js"))) throw new Error(MISSING_EDITOR(paths.editorDir));
  return await startDevServer({
    port: command.port,
    editor: "eager",
    editorOutDir: paths.editorDir,
    editorPrebuilt: true,
    editorStaticRoot: paths.staticRoot,
    feasibility: false,
    issueDir: command.dataDir ?? undefined,
  });
}

/** Open the editor in the browser this computer uses; a failure here is not worth stopping for. */
function openBrowser(url: string, io: Io): void {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  try {
    spawn(opener, [url], { detached: true, stdio: "ignore" }).on("error", () => io.err(`I could not open a browser; open ${url} yourself.`)).unref();
  } catch {
    io.err(`I could not open a browser; open ${url} yourself.`);
  }
}

/** Run one command line; resolves to the exit code. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Io = processIo,
  paths: EditorPaths = defaultPaths(),
): Promise<number> {
  const command: Command = parseArgs(argv);
  if (command.kind === "help") {
    io.out(usage());
    return 0;
  }
  if (command.kind === "refused") {
    io.err(command.message);
    return 2;
  }
  let server: RunningDevServer;
  try {
    server = await startEditor(command, paths);
  } catch (err) {
    io.err(err instanceof Error ? err.message : String(err));
    return 1;
  }
  const url = server.editorUrl ?? `http://127.0.0.1:${server.port}/`;
  io.out(`The editor is at ${url}`);
  io.out("Press ctrl-c to stop it. The model lives in memory, so it stops too.");
  if (command.open) openBrowser(url, io);

  const stopped = await new Promise<NodeJS.Signals>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  await server.close();
  io.out(stopped === "SIGTERM" ? "Stopped (SIGTERM)." : "Stopped.");
  return 0;
}
