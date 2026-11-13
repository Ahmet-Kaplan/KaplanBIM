/**
 * @jest-environment node
 *
 * `mutinybim`'s command line: what it accepts, how it refuses, and that
 * `editor` really serves a page on the port it names and stops when asked.
 *
 * The server test uses a stub editor build (app.js + styles.css + report.json)
 * instead of the real 11.8 MB one: it is the *serving* that is under test
 * here, not the editor's own build.
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DEFAULT_PORT, parseArgs, usage } from "../src/args";
import { main, MISSING_EDITOR, startEditor, type EditorPaths } from "../src/index";

const editor = (argv: readonly string[]) => {
  const parsed = parseArgs(argv);
  if (parsed.kind !== "editor") throw new Error(`expected editor, got ${parsed.kind}`);
  return parsed;
};

describe("parseArgs", () => {
  it("reads --port 3999", () => {
    expect(editor(["editor", "--port", "3999"])).toEqual({ kind: "editor", port: 3999, dataDir: null, open: false });
  });

  it("reads --port=3999", () => {
    expect(editor(["editor", "--port=3999"])).toEqual({ kind: "editor", port: 3999, dataDir: null, open: false });
  });

  it("defaults the port when nobody names one", () => {
    expect(editor(["editor"]).port).toBe(DEFAULT_PORT);
  });

  it("reads --data-dir ./issued and --data-dir=./issued", () => {
    expect(editor(["editor", "--data-dir", "./issued"]).dataDir).toBe("./issued");
    expect(editor(["editor", "--data-dir=./issued"]).dataDir).toBe("./issued");
  });

  it("reads --open", () => {
    expect(editor(["editor", "--open"]).open).toBe(true);
  });

  it("refuses --port with no number", () => {
    const parsed = parseArgs(["editor", "--port"]);
    expect(parsed.kind).toBe("refused");
    expect(parsed.kind === "refused" && parsed.message).toBe("--port needs a number, like --port 3999.");
  });

  it("refuses --port= with no number", () => {
    const parsed = parseArgs(["editor", "--port="]);
    expect(parsed.kind).toBe("refused");
    expect(parsed.kind === "refused" && parsed.message).toBe("--port needs a number, like --port 3999.");
  });

  it("refuses --data-dir with no folder", () => {
    const parsed = parseArgs(["editor", "--data-dir"]);
    expect(parsed.kind).toBe("refused");
    expect(parsed.kind === "refused" && parsed.message).toBe("--data-dir needs a folder, like --data-dir ./issued.");
  });

  it("refuses --data-dir= with no folder", () => {
    const parsed = parseArgs(["editor", "--data-dir="]);
    expect(parsed.kind).toBe("refused");
    expect(parsed.kind === "refused" && parsed.message).toBe("--data-dir needs a folder, like --data-dir ./issued.");
  });

  it("refuses a port that is not a whole number a computer can listen on", () => {
    for (const bad of ["soon", "0", "65536", "-1", "39.99"]) {
      const parsed = parseArgs(["editor", `--port=${bad}`]);
      expect(parsed.kind).toBe("refused");
      expect(parsed.kind === "refused" && parsed.message).toMatch(/^--port takes a whole number between 1 and 65535/);
    }
  });

  it("refuses an option it does not know, in a sentence", () => {
    const parsed = parseArgs(["editor", "--verbose"]);
    expect(parsed.kind).toBe("refused");
    expect(parsed.kind === "refused" && parsed.message).toBe('I do not know the option "--verbose". The options are --port, --data-dir, --open and --help. Try: mutinybim editor --help');
  });

  it("refuses a command it does not know, in a sentence", () => {
    const parsed = parseArgs(["serve"]);
    expect(parsed.kind).toBe("refused");
    expect(parsed.kind === "refused" && parsed.message).toBe('I do not know the command "serve". The commands are: editor. Try: mutinybim editor --help');
  });

  it("asks for a command when none is named", () => {
    const parsed = parseArgs(["--port", "3999"]);
    expect(parsed.kind).toBe("refused");
    expect(parsed.kind === "refused" && parsed.message).toMatch(/^Name the command: mutinybim editor/);
  });

  it("shows the usage for --help, -h and help", () => {
    for (const argv of [["--help"], ["-h"], ["help"], ["editor", "--help"], []]) expect(parseArgs(argv).kind).toBe("help");
  });
});

describe("main", () => {
  const io = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) }, out, err };
  };

  it("--help exits 0 and names the commands", async () => {
    const { io: streams, out, err } = io();
    expect(await main(["--help"], streams)).toBe(0);
    expect(out.join("\n")).toBe(usage());
    expect(out.join("\n")).toContain("Usage");
    expect(out.join("\n")).toContain("Commands");
    expect(out.join("\n")).toMatch(/^\s+editor\s/m);
    expect(err).toEqual([]);
  });

  it("a bad flag exits non-zero with a sentence", async () => {
    const { io: streams, out, err } = io();
    const code = await main(["editor", "--nope"], streams);
    expect(code).not.toBe(0);
    expect(err).toHaveLength(1);
    expect(err[0]).toBe('I do not know the option "--nope". The options are --port, --data-dir, --open and --help. Try: mutinybim editor --help');
    expect(out).toEqual([]);
  });

  it("exits non-zero in a sentence when the editor page it serves is missing", async () => {
    const { io: streams, err } = io();
    const empty = await mkdtemp(path.join(os.tmpdir(), "mutinybim-cli-empty-"));
    try {
      const code = await main(["editor", "--port", "3998"], streams, { editorDir: empty, staticRoot: empty });
      expect(code).toBe(1);
      expect(err[0]).toBe(MISSING_EDITOR(empty));
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});

describe("startEditor", () => {
  let root = "";
  let paths: EditorPaths;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "mutinybim-cli-"));
    paths = { editorDir: path.join(root, "editor"), staticRoot: path.join(root, "static") };
    await mkdir(path.join(paths.editorDir, "chunks"), { recursive: true });
    await mkdir(path.join(paths.staticRoot, "bim-ui"), { recursive: true });
    await writeFile(path.join(paths.editorDir, "app.js"), "/* the editor, in a test */\n");
    await writeFile(path.join(paths.editorDir, "styles.css"), "/* styles */\n");
    await writeFile(path.join(paths.editorDir, "report.json"), JSON.stringify({ builtAt: new Date().toISOString(), ms: 1, jsBytes: 1, cssBytes: 1, files: 2, entryBytes: 1, inputs: [], warnings: [] }));
    await writeFile(path.join(paths.staticRoot, "bim-ui/mutiny-icon.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("answers on the port it names and stops when asked", async () => {
    const server = await startEditor({ port: 0, dataDir: null }, paths);
    try {
      expect(server.port).toBeGreaterThan(0);
      expect(server.editorUrl).toBe(`http://127.0.0.1:${server.port}/m/${encodeURIComponent(server.modelId)}?view=plan`);
      const page = await fetch(`http://127.0.0.1:${server.port}/m/${server.modelId}?view=plan`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("/dist/app.js");
      expect((await fetch(`http://127.0.0.1:${server.port}/dist/app.js`)).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${server.port}/dist/styles.css`)).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${server.port}/assets/bim-ui/mutiny-icon.svg`)).status).toBe(200);
      const metrics = await (await fetch(`http://127.0.0.1:${server.port}/metrics`)).json();
      expect(metrics).toMatchObject({ revision: 0, connections: 0 });
      // The F-a feasibility viewer is not part of this command, and says so in a sentence.
      const feasibility = await fetch(`http://127.0.0.1:${server.port}/feasibility`);
      expect(feasibility.status).toBe(501);
      expect(await feasibility.text()).toMatch(/serves the editor only/);
    } finally {
      await server.close();
    }
    await expect(fetch(`http://127.0.0.1:${server.port}/metrics`)).rejects.toThrow();
  });

  it("says what to do when the editor page it ships is not there", async () => {
    await expect(startEditor({ port: 0, dataDir: null }, { editorDir: path.join(root, "nope"), staticRoot: paths.staticRoot })).rejects.toThrow(/Reinstall @permitzip\/bim-cli/);
  });
});
