/**
 * MutinyBIM local dev server: the full Building Model editor in a browser,
 * the model it edits (an in-process sequencer behind the same sync protocol
 * the real model server speaks, with branches and versions), and the small
 * F-a feasibility viewer. Everything lives in memory until it stops. Not a
 * production service.
 *
 * A library: `startDevServer()` hands back the address it listens on and a
 * `close()`. ./server.ts starts it from the environment for `npm run demo`;
 * packages/bim-cli starts it from a command. What it reads from the
 * environment when no option says otherwise is in DevServerOptions.
 *
 * Routes: `/` and `/m/<model>` the editor, `/dist/*` its bundle, `/sync`
 * the model, `/feasibility` the feasibility viewer, `/metrics`, `/export.pdf`
 * and `/issue` as before. Host app APIs the editor asks for answer 501 in
 * plain words.
 *
 * BIM_DEV_EDITOR: `eager` builds the editor at start (the default), `lazy`
 * on the first editor page (the default with BIM_DEV_MODEL, so browser tests
 * that only need the model don't pay for it), `off` serves no editor.
 *
 * BIM_DEV_AUTHORITY_URL (with BIM_DEV_SIGNIN_URL): the editor opens that model
 * server instead of the in-process one, signed in through the local sign-in
 * service (`docker compose up`; services/bim-authority/src/local-stack). `/demo-config.json` tells
 * the page which.
 */
import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { branchModelId, buildSheetScene, demoSheetDefinition, executeCommand, isBranchId, parseBranchModelId, type Command, type ModelState, type RunSegment } from "@permitzip/bim-kernel";
import { createDemoModel, createPlacedDemoModel } from "@permitzip/bim-pack-mechanical/seed";
import { captureSnapshot, issueFromSnapshot, renderSheetPdf } from "@permitzip/bim-sheets";
import { InMemoryBranchHost, type SyncHub } from "@permitzip/bim-sync";
import { installFirstPartyAddOns } from "@permitzip/bim-first-party";
import { buildSampleMarketGas } from "../../bim-kernel/__tests__/fixtures/sample-market-gas";
import { createEditorDemo, type EditorDemo } from "../../bim-editor/demo/server";

// The kernel carries no trade: gas, plumbing and air systems are first-party add-ons, installed before any model is built.
installFirstPartyAddOns();

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const RENDERER = "mutinybim-devserver/0.2 pdf-lib/1.17.1";

/** 7301 Demo Site: the demo system placed inside the linked architecture (same origin as the feasibility site model). */
const SITE_7301_ORIGIN = { x: 119_500, y: -26_000 } as const;
/**
 * The demo with one routed run already invalid (tilted 5 mm), as an older
 * model or an import leaves it: edits elsewhere must still save (bug log #18,
 * e2e/building-model-open-issue.spec.ts).
 */
function openIssueModel(): ModelState {
  let m = createDemoModel("f-a-demo");
  const steps: Command[] = [
    { type: "create_level", levelId: "lvl-1", name: "Level 1", elevationMm: 0 },
    { type: "route_run", idPrefix: "bad", levelId: "lvl-1", domain: "duct", size: { shape: "rect", width: 304.8, height: 203.2 }, elevationMm: 2743.2, system: { id: "sys-sa", kind: "supply_air", name: "Supply Air 1" }, points: [{ x: 0, y: 24_384 }, { x: 6096, y: 24_384 }] },
  ];
  for (const command of steps) {
    const r = executeCommand(m, command);
    if (!r.ok) throw new Error(`[bim-devserver] open-issue model: ${command.type}: ${r.error.message}`);
    m = { ...r.model, revision: (m.revision + 1) as ModelState["revision"] };
  }
  const seg = m.elements["bad-s1"] as RunSegment;
  return { ...m, elements: { ...m.elements, [seg.id]: { ...seg, end: { ...seg.end, z: seg.end.z + 5 } } } };
}

/** The 7492 Sample Market propane system as drawn, every pipe 3/4" (e2e/building-model-gas-zones.spec.ts). */
const sampleMarketGasModel = (): ModelState => buildSampleMarketGas();

export interface DevServerOptions {
  /** The port to listen on. Default: BIM_DEV_PORT, else 3095. */
  readonly port?: number;
  /** Which starting model to build. Default: BIM_DEV_MODEL (`f-a-demo` when unset). */
  readonly model?: string;
  /** Where the editor build lives. Default: bim-editor/demo/build.ts's own choice. */
  readonly editorOutDir?: string;
  /**
   * Serve the build in `editorOutDir` as it is, without checking its sources.
   * For a build made on another machine (the npx CLI ships one). Default: false.
   */
  readonly editorPrebuilt?: boolean;
  /**
   * A folder holding the files the editor fetches at run time (fonts, brand art,
   * WebAssembly, workers) instead of this checkout and its node_modules.
   * Default: the checkout.
   */
  readonly editorStaticRoot?: string;
  /** `eager` builds at start, `lazy` on the first editor page, `off` serves no editor. Default: BIM_DEV_EDITOR, else eager (lazy with BIM_DEV_MODEL). */
  readonly editor?: "eager" | "lazy" | "off";
  /** Serve the small F-a feasibility viewer. Default: true. */
  readonly feasibility?: boolean;
  /** Where issued snapshots and PDFs go. Default: BIM_ISSUE_DIR. */
  readonly issueDir?: string;
  /** Open the editor against that model server instead of the in-process one. Default: BIM_DEV_AUTHORITY_URL. */
  readonly authorityUrl?: string | null;
  /** The local sign-in service that token `authorityUrl`. Default: BIM_DEV_SIGNIN_URL. */
  readonly signInUrl?: string | null;
}

export interface RunningDevServer {
  readonly port: number;
  /** The model everyone opens: Main. */
  readonly modelId: string;
  /** The editor page, or null with `editor: "off"`. */
  readonly editorUrl: string | null;
  /** The model server the page opens. */
  readonly syncUrl: string;
  /** Stop listening, drop every connection and return once the sockets are closed. */
  close(): Promise<void>;
}

/**
 * Start the local dev server: the editor page, the model it edits (an in-process
 * sequencer behind the sync protocol), and the F-a feasibility viewer. A library,
 * so a command can start it (packages/bim-cli); `server.ts` below does that when
 * this file is what you ran.
 */
export async function startDevServer(options: DevServerOptions = {}): Promise<RunningDevServer> {
  const requestedPort = options.port ?? Number(process.env.BIM_DEV_PORT ?? 3095);
  /** The port it listens on: `requestedPort`, or the free one the system gave for 0. */
  let port = requestedPort;
  const modelName = options.model ?? process.env.BIM_DEV_MODEL;
  const ISSUE_DIR = options.issueDir ?? process.env.BIM_ISSUE_DIR ?? "/tmp/mutinybim-issued/dev";
  const feasibility = options.feasibility ?? true;

  const startingModel =
    modelName === "site-7301"
      ? createPlacedDemoModel("site-7301", SITE_7301_ORIGIN)
      : modelName === "open-issue"
        ? openIssueModel()
        : modelName === "sample-market-gas"
          ? sampleMarketGasModel()
          : createDemoModel("f-a-demo");
  // Main plus branches, versions and copies, all in memory (bim-sync's in-memory branch host).
  const models = await InMemoryBranchHost.start(startingModel);
  const { sequencer, hub } = models.main;
  const mainModelId = startingModel.modelId;

  /**
   * The hub a connection's first hello names. Main, or a branch or copy made on
   * this server. A plain model id this server doesn't know (a host app's
   * project model, or no id at all) gets Main, as this server always did; an
   * unknown branch gets null.
   */
  async function hubFor(modelId: string | null): Promise<SyncHub | null> {
    if (modelId === null) return hub;
    const served = await models.open(modelId);
    if (served) return served.hub;
    return parseBranchModelId(modelId) ? null : hub;
  }

  /** The model id a connection's first message asks for: undefined when it is not a hello, null when the hello names none. */
  function helloModelId(raw: string): string | null | undefined {
    if (!raw.startsWith('{"type":"hello"')) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "modelId" in parsed && typeof parsed.modelId === "string") return parsed.modelId;
    return null;
  }

  const editorMode = options.editor ?? process.env.BIM_DEV_EDITOR ?? (modelName ? "lazy" : "eager");
  if (!["eager", "lazy", "off"].includes(editorMode)) {
    throw new Error(`BIM_DEV_EDITOR="${editorMode}" is not one of eager, lazy, off`);
  }

  const editor: EditorDemo | null =
    editorMode === "off"
      ? null
      : createEditorDemo({
          outDir: options.editorOutDir,
          prebuilt: options.editorPrebuilt,
          staticRoot: options.editorStaticRoot,
          mainModelId: async () => mainModelId,
          authority: async (branch) => {
            const url = `ws://127.0.0.1:${port}/sync`;
            if (branch === null) return { url, modelId: mainModelId };
            if (!isBranchId(branch)) return { error: "That branch address isn't usable. Pick the branch again from the Branch list." };
            return { url, modelId: branchModelId(mainModelId, branch), mainModelId, branchId: branch };
          },
        });

  async function bundleClient(): Promise<string> {
    // esbuild is a checkout tool, not a shipped one: a bundled copy of this file never loads it (BIM_DEV_FEASIBILITY off, as the npx CLI does).
    const { build } = await import("esbuild");
    const result = await build({
      entryPoints: [path.join(root, "packages/bim-viewer/src/main.ts")],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      target: "es2022",
      sourcemap: "inline",
      tsconfig: path.join(root, "packages/tsconfig.bim.json"),
      // manifold-3d, web-ifc and friends import node: modules only when they run under Node; the browser never takes that branch (as in bim-editor/demo/build.ts).
      external: ["node:*"],
      logLevel: "silent",
    });
    const out = result.outputFiles[0];
    if (!out) throw new Error("esbuild produced no output");
    return out.text;
  }

  const INDEX_HTML = `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><title>MutinyBIM - feasibility</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/png" sizes="16x16" href="/brand/mutinybim-mark-16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/brand/mutinybim-mark-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/brand/mutinybim-mark-192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/brand/mutinybim-mark-180.png">
  <link rel="stylesheet" href="/feasibility/viewer.css"></head>
  <body><div id="app"></div><script type="module" src="/feasibility/client.js"></script></body></html>`;

  function send(res: ServerResponse, status: number, type: string, body: string | Uint8Array, headers: Record<string, string> = {}) {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store", ...headers });
    res.end(body);
  }

  async function exportPdf(res: ServerResponse) {
    // Capture an immutable snapshot at the current head; render only from it.
    const snapshot = await sequencer.exportSnapshot();
    const sha = createHash("sha256").update(snapshot.canonical).digest("hex");
    const scene = buildSheetScene(snapshot.model, demoSheetDefinition());
    const started = performance.now();
    const pdf = (
      await renderSheetPdf(scene, {
        title: "M-101 Mechanical Plan",
        modelRevision: snapshot.revision,
        snapshotSha256: sha,
        renderer: RENDERER,
      })
    ).bytes;
    const ms = Math.round(performance.now() - started);
    console.log("[bim-devserver] exported M-101", { revision: snapshot.revision, sha256: sha.slice(0, 12), ms, bytes: pdf.length });
    send(res, 200, "application/pdf", pdf, {
      "content-disposition": `inline; filename="M-101-rev${snapshot.revision}.pdf"`,
      "x-model-revision": String(snapshot.revision),
      "x-snapshot-sha256": sha,
      "x-render-ms": String(ms),
    });
  }

  const externalAuthority = options.authorityUrl ?? process.env.BIM_DEV_AUTHORITY_URL ?? null;
  const signInUrl = options.signInUrl ?? process.env.BIM_DEV_SIGNIN_URL ?? null;
  if (externalAuthority && !signInUrl) {
    throw new Error("BIM_DEV_AUTHORITY_URL needs BIM_DEV_SIGNIN_URL: the model server only opens to someone signed in");
  }

  /** Which model server the editor page opens, and the sign-in it presents there. */
  async function demoConfig(res: ServerResponse, url: URL): Promise<void> {
    if (!externalAuthority || !signInUrl) return send(res, 200, "application/json", JSON.stringify({ authority: "in-process" }));
    const name = (url.searchParams.get("name") ?? "You").slice(0, 60);
    const answer = await fetch(`${signInUrl}/token?name=${encodeURIComponent(name)}`);
    if (!answer.ok) {
      console.error("[bim-devserver] the local sign-in service refused a token", { status: answer.status });
      return send(res, 502, "application/json", JSON.stringify({ error: `The local sign-in service answered ${answer.status}. Is it running (docker compose ps)?` }));
    }
    const body: unknown = await answer.json();
    if (typeof body !== "object" || body === null || !("access_token" in body) || !("user_id" in body) || typeof body.access_token !== "string" || typeof body.user_id !== "string") {
      console.error("[bim-devserver] the local sign-in service answered without a token");
      return send(res, 502, "application/json", JSON.stringify({ error: "The local sign-in service answered without a token." }));
    }
    return send(res, 200, "application/json", JSON.stringify({ authority: "external", authorityUrl: externalAuthority, token: body.access_token, userId: body.user_id, displayName: name }));
  }

  /** Brand art: this checkout's, or the shipped copy's (`static/brand`). */
  const assetDir = options.editorStaticRoot ? path.join(options.editorStaticRoot, "brand") : path.join(root, "packages/bim-viewer/assets");

  async function handle(req: IncomingMessage, res: ServerResponse, clientJs: () => Promise<string>, css: string) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (req.method === "GET" && url.pathname === "/demo-config.json") return demoConfig(res, url);
    if (url.pathname.startsWith("/feasibility") && !feasibility) {
      return send(res, 501, "text/plain; charset=utf-8", "This server serves the editor only. The F-a feasibility viewer starts with the full demo: npm run demo in a checkout.");
    }
    if (req.method === "GET" && url.pathname === "/feasibility") return send(res, 200, "text/html; charset=utf-8", INDEX_HTML);
    if (req.method === "GET" && url.pathname === "/feasibility/client.js") return send(res, 200, "text/javascript", await clientJs());
    if (req.method === "GET" && url.pathname === "/feasibility/viewer.css") return send(res, 200, "text/css", css);
    if (req.method === "GET" && url.pathname === "/" && !editor) {
      res.writeHead(302, { location: "/feasibility" });
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/export.pdf") return exportPdf(res);
    if (req.method === "POST" && url.pathname === "/issue") {
      // Capture the pinned snapshot first; rendering reads only that file.
      const head = await sequencer.head();
      const capturedAt = new Date().toISOString();
      const snap = await captureSnapshot(ISSUE_DIR, head);
      const manifest = await issueFromSnapshot(ISSUE_DIR, snap.file, demoSheetDefinition(), RENDERER, capturedAt);
      console.log("[bim-devserver] issued", { revision: manifest.modelRevision, pdf: manifest.pdfFile, snapshot: manifest.snapshotSha256.slice(0, 12) });
      return send(res, 200, "application/json", JSON.stringify({ pdfUrl: `/issued/${manifest.pdfFile}`, revision: manifest.modelRevision, manifest }));
    }
    const issued = url.pathname.match(/^\/issued\/([\w.-]+\.(?:pdf|json))$/);
    if (req.method === "GET" && issued?.[1]) {
      const { readFile } = await import("node:fs/promises");
      const data = await readFile(path.join(ISSUE_DIR, issued[1]));
      return send(res, 200, issued[1].endsWith(".pdf") ? "application/pdf" : "application/json", data);
    }
    const brand = url.pathname.match(/^\/brand\/(mutinybim-mark-(?:16|32|48|180|192|512)\.png)$/);
    if (req.method === "GET" && brand?.[1]) {
      const { readFile } = await import("node:fs/promises");
      try {
        const png = await readFile(path.join(assetDir, brand[1]));
        return send(res, 200, "image/png", png, { "cache-control": "public, max-age=86400" });
      } catch {
        return send(res, 404, "text/plain; charset=utf-8", `There is no ${brand[1]} here.`);
      }
    }
    if (req.method === "GET" && url.pathname === "/favicon.ico") {
      const { readFile } = await import("node:fs/promises");
      try {
        const png = await readFile(path.join(assetDir, "mutinybim-mark-32.png"));
        return send(res, 200, "image/png", png, { "cache-control": "public, max-age=86400" });
      } catch {
        return send(res, 404, "text/plain; charset=utf-8", "There is no icon here.");
      }
    }
    if (req.method === "GET" && url.pathname === "/metrics") {
      const m = hub.metrics;
      const sorted = [...m.commitMs].sort((a, b) => a - b);
      const pct = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : null);
      return send(res, 200, "application/json", JSON.stringify({
        revision: (await sequencer.head()).revision,
        connections: hub.connectionCount(),
        commits: m.commits,
        rejections: m.rejections,
        broadcasts: m.broadcasts,
        droppedBroadcasts: m.droppedBroadcasts,
        bytesOut: m.bytesOut,
        serverCommitMs: { p50: pct(0.5), p95: pct(0.95), max: sorted.at(-1) ?? null },
        memoryMb: Math.round(process.memoryUsage().rss / 1e6),
      }, null, 2));
    }
    if (req.method === "POST" && url.pathname === "/debug/drop-next-broadcast") {
      hub.dropNextBroadcasts(1);
      return send(res, 200, "application/json", JSON.stringify({ ok: true }));
    }
    if (req.method === "GET" && url.pathname === "/debug/head") {
      const served = await models.open(url.searchParams.get("model") ?? mainModelId);
      if (!served) return send(res, 404, "application/json", JSON.stringify({ error: "No such model or branch here." }));
      const head = await served.sequencer.head();
      return send(res, 200, "application/json", JSON.stringify({ modelId: head.modelId, revision: head.revision, elements: Object.keys(head.elements).length, connections: served.hub.connectionCount() }));
    }
    if (editor && (await editor.handle(req, res, url))) return;
    send(res, 404, "text/plain", "Not found");
  }

  async function main(): Promise<RunningDevServer> {
    const { readFile } = await import("node:fs/promises");
    const css = feasibility ? await readFile(path.join(root, "packages/bim-viewer/src/viewer.css"), "utf8") : "";
    let cached: string | null = null;
    const clientJs = async () => {
      // Rebuild on each request in dev so edits show up on reload.
      try {
        cached = await bundleClient();
      } catch (err) {
        console.error("[bim-devserver] client bundle failed", err);
        if (!cached) throw err;
      }
      return cached;
    };
    // The F-a viewer's own bundle is only built when someone opens it, and only with esbuild present (a checkout, not a shipped CLI).
    if (feasibility) await clientJs();

    const server = createServer((req, res) => {
      handle(req, res, clientJs, css).catch((err) => {
        console.error("[bim-devserver] request failed", { url: req.url, err });
        send(res, 500, "text/plain", "Server error: see devserver log");
      });
    });

    const wss = new WebSocketServer({ server, path: "/sync" });
    wss.on("connection", (socket) => {
      const conn = { id: randomUUID(), send: (data: string) => socket.send(data) };
      // One address serves Main and every branch (as the model server does): the first hello names the model.
      let joined: SyncHub | null = null;
      let queue: Promise<void> = Promise.resolve();
      const receive = async (raw: string) => {
        if (!joined) {
          const modelId = helloModelId(raw);
          if (modelId === undefined) {
            conn.send(JSON.stringify({ type: "error", message: "Say hello first: this connection has not named a model yet." }));
            return;
          }
          const target = await hubFor(modelId);
          if (!target) {
            console.error("[bim-devserver] a connection asked for a branch this server doesn't have", { id: conn.id, modelId });
            conn.send(JSON.stringify({ type: "denied", reason: "This branch isn't on the local dev server (it keeps branches only until it restarts). Switch back to Main." }));
            return;
          }
          joined = target;
          joined.join(conn);
        }
        await joined.handle(conn, raw);
      };
      socket.on("message", (data) => {
        const raw = data.toString();
        queue = queue.then(() => receive(raw)).catch((err: unknown) => console.error("[bim-devserver] message failed", { id: conn.id, err }));
      });
      socket.on("close", () => {
        queue = queue.then(() => joined?.leave(conn)).catch((err: unknown) => console.error("[bim-devserver] leave failed", { id: conn.id, err }));
      });
      socket.on("error", (err) => console.error("[bim-devserver] socket error", { id: conn.id, err }));
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      console.error("[bim-devserver] server error", err);
    });
    // The WebSocket server re-emits listen errors; the http server handler above reports them.
    wss.on("error", (err) => console.error("[bim-devserver] websocket server error", err.message));

    await new Promise<void>((resolve, reject) => {
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          reject(
            new Error(
              `Port ${requestedPort} is already in use (another MutinyBIM server is probably running).\n` +
                `  Open http://127.0.0.1:${requestedPort}/ to use it, stop it with: lsof -nP -iTCP:${requestedPort} -sTCP:LISTEN\n` +
                `  or start on another port: --port ${requestedPort + 1}`,
            ),
          );
          return;
        }
        reject(err);
      });
      server.listen(port, () => {
        server.removeAllListeners("error");
        server.on("error", (err: NodeJS.ErrnoException) => console.error("[bim-devserver] server error", err));
        resolve();
      });
    });
    // Port 0 asks the system for any free port; everything printed and returned names the one it gave.
    const address = server.address();
    port = typeof address === "object" && address !== null ? address.port : requestedPort;

    const editorUrl = editor ? `http://127.0.0.1:${port}/m/${encodeURIComponent(mainModelId)}?view=plan` : null;
    const syncUrl = `ws://127.0.0.1:${port}/sync`;
    if (editorUrl && editor) {
      console.log(`[bim-devserver] MutinyBIM editor at ${editorUrl}  (open twice with &name=Priya and &name=Avery to edit together)`);
      console.log(`[bim-devserver] editor build ${editorMode === "eager" ? "starting now" : "starts on the first editor page"} (in ${editor.outDir})`);
    } else {
      console.log("[bim-devserver] editor off (BIM_DEV_EDITOR=off)");
    }
    if (feasibility) console.log(`[bim-devserver] MutinyBIM F-a demo at http://localhost:${port}/feasibility  (open twice: ?name=Priya and ?name=Avery)`);
    console.log(`[bim-devserver] model ${mainModelId} at ${syncUrl}  (pid ${process.pid}; branches and versions kept until it stops)`);
    if (editorMode === "eager") editor?.warm();

    return {
      port,
      modelId: mainModelId,
      editorUrl,
      syncUrl,
      async close() {
        for (const client of wss.clients) client.terminate();
        await new Promise<void>((resolve) => wss.close(() => resolve()));
        server.closeAllConnections?.();
        await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      },
    };
  }

  return await main();
}
