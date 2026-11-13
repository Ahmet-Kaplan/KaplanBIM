/**
 * Builds what `@permitzip/bim-cli` ships, so a tarball needs neither a
 * checkout nor esbuild at run time:
 *
 *   dist/index.js   the CLI and the dev server it starts, one node bundle
 *   dist/editor/    the editor page packages/bim-editor's demo build makes
 *   dist/static/    the files that page fetches at run time (fonts, brand
 *                   art, WebAssembly, workers, bim-ui assets)
 *
 *   npm run build            (in packages/bim-cli; `npm pack` runs it too)
 *
 * Kept out of the bundle and never loaded by this CLI: esbuild, postcss and
 * Tailwind, which the editor *build* needs and a shipped editor does not.
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { buildEditorDemo, PACKAGES_DIR, REPO_ROOT } from "../../bim-editor/demo/build.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(here, "..");
const dist = path.join(pkgDir, "dist");
const nodeModules = path.join(REPO_ROOT, "node_modules");

/** A file the page fetches, from the checkout, under `dist/static/<to>`. */
const STATIC_FILES = [
  ["public/mutinybim/fonts", "fonts"],
  ["public/mutinybim/firm", "firm"],
  ["packages/bim-ui/assets", "bim-ui"],
  ["node_modules/pdfjs-dist/web/images", "pdfjs-images"],
  ["node_modules/manifold-3d/manifold.wasm", "wasm/manifold.wasm"],
  ["node_modules/web-ifc/web-ifc.wasm", "wasm/web-ifc.wasm"],
  ["node_modules/web-ifc/web-ifc-mt.wasm", "wasm/web-ifc-mt.wasm"],
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "workers/pdf.worker.min.mjs"],
  ["node_modules/pdfjs-dist/build/pdf.worker.mjs", "workers/pdf.worker.mjs"],
  ["node_modules/@thatopen/fragments/dist/Worker/worker.mjs", "workers/fragments-worker.mjs"],
];

/** Loaded only by a build (postcss, Tailwind), or only by the feasibility viewer (esbuild). */
const EXTERNAL = ["esbuild", "postcss", "@tailwindcss/postcss", "tailwindcss", "tw-animate-css"];

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  const bundle = await build({
    entryPoints: [path.join(pkgDir, "src/index.ts")],
    absWorkingDir: REPO_ROOT,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: path.join(dist, "index.js"),
    external: ["node:*", ...EXTERNAL],
    tsconfig: path.join(PACKAGES_DIR, "tsconfig.bim.json"),
    banner: {
      // ws and other CommonJS dependencies call require() for node builtins; an ESM bundle needs it back.
      js: "// @permitzip/bim-cli: the editor server, bundled. See scripts/build.mjs.\nimport { createRequire as __mutinyCreateRequire } from 'node:module';\nconst require = __mutinyCreateRequire(import.meta.url);",
    },
    logLevel: "warning",
  });
  if (bundle.errors.length > 0) throw new Error(`${bundle.errors.length} esbuild errors`);

  const report = await buildEditorDemo({ outDir: path.join(dist, "editor"), sourcemap: false });
  // The paths a build read are the machine it was made on; a shipped copy is served as it is.
  await writeFile(path.join(dist, "editor/report.json"), JSON.stringify({ ...report, inputs: [] }, null, 2));

  for (const [from, to] of STATIC_FILES) {
    const source = path.join(REPO_ROOT, from);
    const target = path.join(dist, "static", to);
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await cp(source, target, { recursive: true });
    } catch (err) {
      throw new Error(`the editor page fetches ${from}, which is not in this checkout (${err instanceof Error ? err.message : String(err)}); run npm install at the repo root`);
    }
  }
  const brand = path.join(dist, "static/brand");
  await mkdir(brand, { recursive: true });
  await cp(path.join(PACKAGES_DIR, "bim-viewer/assets"), brand, { recursive: true });

  // bim-sheets finds its standard detail and note fonts beside its own module
  // (`<module>/../details`, `<module>/../fonts`). In one bundle that is beside
  // dist, so //export.pdf and /issue work from a tarball too.
  for (const dir of ["details", "fonts"]) await cp(path.join(PACKAGES_DIR, "bim-sheets", dir), path.join(pkgDir, dir), { recursive: true });

  const bytes = async (file) => (await readFile(file)).length;
  console.log("[bim-cli] built", {
    bundleKb: Math.round((await bytes(path.join(dist, "index.js"))) / 1e3),
    editorMb: (report.jsBytes / 1e6).toFixed(1),
    editorFiles: report.files,
    editorBuildMs: report.ms,
  });
}

main().catch((err) => {
  console.error("[bim-cli] build failed", err instanceof Error ? err.message : err);
  process.exit(1);
});
