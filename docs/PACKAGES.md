# Which packages publish, and what each one carries

Task D2 of `docs/superpowers/plans/2026-11-10-pascal-adoptions.md`. Pascal
publishes 11 npm packages and `npx @pascal-app/cli editor` is how a firm's IT
installs their editor; our equivalent is D1's `mutinybim editor`. This page is
the other half: **not every package here has to be publishable**, and the ones
that are should say in their manifest what they actually carry.

There are 34 packages under `packages/`: **19 publish, 15 are internal.** A
manifest now says which, and `private: true` marks the internal ones.

Nothing on this page publishes anything. See "Blocked from publishing today"
for what stands between the 19 and a working `npm install`.

## What the manifests said before D2

| | Before |
| --- | --- |
| `private` | set on **none** of the 34 |
| `main`, `types` | on **none** of the 34 |
| `exports["."]` | `./src/<entry>.ts` on 33; `./dist/index.js` on `bim-cli` |
| `files` | on 5: `bim-cli`, `bim-mcp`, `bim-mcp-packs`, `bim-plugin`, `bim-script-runner` |
| `publishConfig.registry` | `https://npm.pkg.github.com` on all 34 |
| `license`, `type`, `description`, `repository` | on all 34 |

So a manifest claimed nothing about what it carried: `npm pack` would have
shipped every tracked file the `.gitignore` allows — `src/`, `__tests__/`,
`scripts/`, `details/`, docs — and nothing said a package was not for sale.

## Does anything build?

**No package builds.** `packages/tsconfig.bim.json` is `noEmit: true`, so the
`type-check` script every package runs emits nothing — no JavaScript, no `.d.ts`.

The only real package build is `bim-cli`: `scripts/build.mjs`, run by `prepack`,
bundles `src/index.ts` with esbuild into `dist/index.js`, builds the editor page
into `dist/editor/` and copies run-time files into `dist/static/`. It is the one
package whose `exports` point at build output.

Three scripts look like builds and are not:

- `bim-script-runner`'s `build` (`src/build.ts`) bundles the **script runner**
  (a sealed host bakes the output into its image), from a checkout and its
  tsconfig path map;
- `bim-plugin`'s `build:files` writes `plugin.json`/`mcp.json` next to `skills/`;
- `bim-script`'s `scripts/write-examples.mjs` generates `src/examples.generated.ts`.

**Consequence, and it is the point of this section:** for 33 of 34 packages,
"publishing" today means publishing **TypeScript source that the consumer must
compile**. `docs/RELEASING.md` already says this and tells consumers to use a
TypeScript-aware tool (Next.js `transpilePackages`, esbuild, Vite, `tsx`). That
is a legitimate choice, but it is not what a public npm consumer expects, and no
`types` entry can be honest while it holds (see "No `types`, no `main`").

## The scope name: `@permitzip/*` vs `@mutinybim/*`

`ROADMAP.md` lists, under "Then": **Public npm packages under `@mutinybim/*`.**
Every one of the 34 manifests says `@permitzip/*`, every import in the repo says
`@permitzip/*`, and `publishConfig` points at GitHub Packages, whose scope is the
GitHub org — `permitzip/mutinybim`. The product name is MutinyBIM: the root
package is `mutinybim`, every `bin` is `mutinybim*` (`mutinybim`,
`mutinybim-mcp`, `mutinybim-script`, `mutinybim-example`).

So `@permitzip` is the **org**, `MutinyBIM` is the **product**, and the roadmap's
`@mutinybim/*` is an intent to publish under the product name on public npm.
Those are two different things and the repo does both in one breath.

**D2 did not resolve this.** Renaming a scope is 34 manifests, every import in
the repo, the lockfile, the ESLint boundary plugin and the tsconfig path map, and
it needs an `@mutinybim` npm org to exist first. It is a maintainer decision and
it blocks public-npm publication outright: nothing can be published as
`@mutinybim/*` until it is answered, and nothing published as `@permitzip/*` will
match the roadmap.

## The rule used here

- **Publish**: useful on its own, with no assumption about the host it runs in,
  **and** its peer closure stays inside the publish set. A package that needs an
  internal package to load cannot honestly be in this column.
- **Internal**: meaningless without the monorepo — the app, the dev server, the
  trade packs, the agent tool surface — or dependent on one of those.

Checkable: `bim-kernel` promotes a package and never the reverse; `bim-ui` and
`bim-grid` import no `@permitzip` package at all; `bim-pack-civil` imports only
the add-on contract.

## The 34, one line each

### Publish (19)

| Package | Why |
| --- | --- |
| `bim-units` | Layer-1 primitive: the unit table and conversions, no dependencies. |
| `bim-formula` | Layer-1 primitive: a formula evaluator over units, no BIM types. |
| `bim-geometry` | Layer-1 primitive: convexity and mesh maths; its only dependency is `manifold-3d`. |
| `bim-kernel` | Layer 2, the model engine itself; by contract it imports nothing built on it. |
| `bim-editor-host` | The host contract: types only, names no host, so an outside app can write against the editor. |
| `bim-pack` | The add-on contract (`definePack`, points, runtime): how a third party writes a pack without touching the kernel. |
| `bim-plugin` | The tool-pack catalogue, which `bim-pack/src/points.ts` imports at run time; publishing `bim-pack` without it leaves a re-export that cannot resolve. |
| `bim-calc` | The calc registry and NEC tables: kernel-adjacent, usable from a script or a printed report. |
| `bim-lint` | The code-rule engine — rules, findings, geometry probes — over the kernel. |
| `bim-library` | The firm library: schema, providers, file provider, formula bridge. |
| `bim-ifc` | IFC import and export over the kernel and the library. |
| `bim-sheets` | Sheets, issued PDFs, QR and standard details: the printed output of a model. |
| `bim-sync` | The sync and replica structures over the kernel. |
| `bim-ui` | The theme (`--mutiny-*`) and the components; imports no `@permitzip` package, so the look can be adopted without the product. |
| `bim-grid` | A generic React data grid; imports no `@permitzip` package at all. |
| `bim-schedules-ui` | Schedule screens over `bim-grid` + `bim-ui` + `bim-units`; no kernel and no editor import (its one mention of the editor is a comment). |
| `bim-viewer-3d` | The editor-agnostic renderer of `docs/architecture/viewers.md`; its heavy dependencies are its own. |
| `bim-script` | The script kit — the API an agent writes against, which `AGENTS.md` calls the product. |
| `bim-cli` | One command to a running editor; the only package that already builds, with a tarball-shaped `bin` and `files`. |

### Internal (15)

| Package | Why |
| --- | --- |
| `bim-editor` | The app: 588 export subpaths, React screens, host assumptions throughout. |
| `bim-viewer` | The standalone demo page (`src/main.ts`) — an app, not a library. |
| `bim-devserver` | The dev and demo server that starts the editor; 21 peer dependencies, i.e. the whole product. |
| `bim-first-party` | Our opinion about which add-ons every host installs; it pulls all seven trade packs. |
| `bim-mcp` | The tool server: it runs the local script runner and peers on the editor app and the first-party bundle. |
| `bim-mcp-packs` | The add-on tool families — data plus behaviour for *this* product's tool server. |
| `bim-script-runner` | A sealed runner whose child bundles this product's first-party add-ons and the civil pack, built from a checkout. |
| `bim-pack-architecture` | Trade content for this product. |
| `bim-pack-civil` | Trade content; the in-repo proof pack for the add-on contract, not an npm artifact. |
| `bim-pack-development` | Trade content. |
| `bim-pack-electrical` | Trade content. |
| `bim-pack-mechanical` | Trade content. |
| `bim-pack-plumbing` | Trade content. |
| `bim-pack-site` | Trade content. |
| `bim-pack-structural` | Trade content. |

### The packs are a different decision from the primitives

A primitive publishes when its behaviour is finished; a **pack** publishes when
we promise that a data set stays correct and that its trade rules are the ones a
third party should get. A pack is data plus behaviour for this product — `civil`
carries the rational-method runoff rules, `electrical` the NEC tables it chose —
and a published pack is a support surface we have not agreed to.

So D2 splits the add-on layer: **the contract publishes, the content does not.**
`bim-pack` and `bim-plugin` are public, because someone outside has to be able to
write a pack against them (the roadmap's "write your first add-on" and "a fire
sprinkler add-on, built only through the add-on contract" both need it). The
seven trade packs and the first-party bundle stay internal. `bim-pack-civil`
stays the worked example inside the repo.

## What each manifest now says

**Internal packages** carry `private: true` (so no `npm publish` and no release
tarball can include them by accident) and no `publishConfig`: a package with no
publish target has nothing to say about a registry.

**Publishable packages** gained `files`, listing what their `exports` actually
need. Most are `src` + `LICENSE`; these are not:

| Package | `files` | What it is for |
| --- | --- | --- |
| `bim-sheets` | `src`, `details`, `fonts`, `LICENSE` | `src/pdf.ts` resolves `DETAILS_DIR`/`NOTE_FONTS_DIR` as `<module>/../details` and `<module>/../fonts`; without them `//issue` refuses a sheet with placed details. |
| `bim-ui` | `src`, `assets`, `locales`, `README.md`, `LICENSE` | `./assets/*` is an export, and the i18n code imports `../../locales/tr/*.json` (so does `bim-schedules-ui`). |
| `bim-schedules-ui` | `src`, `locales`, `LICENSE` | Same JSON imports; `./schedules.css` lives inside `src`. |
| `bim-script` | `src`, `bin`, `LICENSE` | Its `bin/mutinybim-script.mjs` sits outside `src` and loads `../src/*.ts`; `examples/` is generated into `src/examples.generated.ts` and is not needed. |
| `bim-pack` | `src`, `PACK-CONTRACT.md`, `API-REPORT.md`, `LICENSE` | The two documents are the contract its source cites. |
| `bim-library` | `src`, `PROVIDER.md`, `LICENSE` | Provider contract. |
| `bim-sync` | `src`, `AUTHORIZATION.md`, `AREA_LOADING.md`, `LICENSE` | The two design contracts its behaviour follows. |
| `bim-kernel` | `src`, `README.md`, `LICENSE` | — |
| `bim-editor-host` | `src`, `README.md`, `LICENSE` | — |
| `bim-cli` | unchanged: `bin/`, `dist/`, `details/`, `fonts/`, `LICENSE`, `README.md` | It already told the truth: built output plus the two directories `bim-sheets` looks for beside the bundle. |
| `bim-plugin` | unchanged: `plugin.json`, `mcp.json`, `skills`, `src`, `LICENSE` | Already the truth for an Agent Plugins package. |

### No `types`, no `main` — and why

Every publishable package except `bim-cli` ships `.ts` source. A `types` entry
must point at a declaration file; a `.d.ts` does not exist, so a `types` field
would be a path that resolves to nothing. It was left out, deliberately: the fix
is a build that emits declarations, and D2 does not add build systems.

`main` was left out for the same reason: `exports["."]` already names the entry,
and a `main` pointing at `./src/index.ts` is a file Node cannot load. Neither
field is missing by oversight.

`exports` maps are untouched. They are load-bearing — Jest resolves the
workspace symlinks through them, and `packages/tsconfig.bim.json` mirrors them in
`paths` — so a change here would break imports silently.

## The dependency question D2 was asked to check

`@thatopen/fragments` is a `dependency` of `bim-viewer-3d` (with `three`,
`web-ifc`, `camera-controls`) and a `peerDependency` of `bim-devserver`. That is
right, and was not changed: `bim-viewer-3d` loads it at run time, so it must
arrive with the package; `bim-devserver` only hosts pages that use the renderer,
so the host supplies it. Everything else in the tree is a peer, which is what
keeps the packages from shipping each other.

## Blocked from publishing today

Every one of the 19 is blocked by the same three things, and none of them can be
fixed in a manifest:

1. **No build.** 33 of 34 export `.ts`. A consumer must transpile inside
   `node_modules`, which most bundlers exclude by default. `docs/RELEASING.md`
   already documents this and the workaround; it is publishing source, not a
   built package.
2. **The registry.** `publishConfig.registry` is `https://npm.pkg.github.com`,
   which needs a GitHub token with `read:packages` even for public packages. That
   is a private registry; the roadmap's "public npm packages" is not it.
3. **No `types`.** A JavaScript consumer of any of these gets no declarations,
   because none can be produced without a build step.

Two are blocked by more:

- **`bim-script`** additionally needs `tsx` (a peer) and Node ≥ 22.13 to load its
  own `bin`, which imports `../src/index.ts`.
- **`bim-cli`** is the one package that could publish as it stands: it builds to
  `dist/`, its `bin` imports only that, and its `files` are complete. It is
  blocked only by the registry and the scope name.

And three internal packages are internal *because* they cannot publish as they
stand, which is a smaller statement of the same fact: `bim-mcp` and
`bim-mcp-packs` peer on `bim-editor` and `bim-first-party`; `bim-script-runner`'s
child bundles `bim-first-party` and `bim-pack-civil` from a checkout. Publishing
any of them means first publishing the app or the trade content.

## The release tool now needs one line

`tools/release/publish.mjs` packs **every** workspace and treats `private` as a
problem to report, not a package to skip:

```js
if (m.private) problems.push(`${m.name} is marked private`);
```

That was written when every workspace published. After D2 it is the wrong rule:
with `MUTINYBIM_PUBLISH=true` the next release fails loudly, naming 15 private
packages, instead of publishing the 19 that should go.

The fix belongs in `publish.mjs` (skip a private package; fail only on a
`publishConfig` that is missing from a package that does publish), not in a
manifest, and D2 deliberately left the release tooling alone — as it left
`docs/RELEASING.md`, whose first sentence ("Every package under `packages/` and
the model server share one version and are released together") stops being true
the moment 15 of them are private. Both are one-line edits for the maintainer,
and both are follow-ups of this task, not part of it.

`scripts/bim/check-proof-pack-commits.sh` needs nothing: it already lists
`private`, `publishConfig` and `files` as release metadata, so this commit counts
as changing no proof-pack code.

## What D2 did not do

- Did not rename the scope, or any package. `@permitzip` stays.
- Did not add a build system, a `dist/`, a `types` entry or a `main`.
- Did not change one `exports` map, so resolution for Jest, `tsc` and every
  import in the repo is exactly as it was.
- Did not add, remove or re-classify a dependency (peer or otherwise).
- Did not touch `tools/release/**`, `.github/workflows/**` or
  `docs/RELEASING.md`.
- Did not touch `services/bim-authority` (not under `packages/`; it publishes
  with the rest today and this decision was not taken about it).
- Did not publish anything, and did not run `npm pack`.
