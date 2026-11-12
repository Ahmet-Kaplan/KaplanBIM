# Layers

## What it owns

Every package under `packages/` and one service, `services/bim-authority`. A
package's layer is decided by what it imports, not by where it sits on disk. The
tour draws six numbered rows and puts the top two together as row 6; they are
split here because they serve different callers (people, and agents). The
guard's own numbering differs, and that is called out under "How it goes
wrong".

| # | Layer | Packages |
|---|---|---|
| 7 | Run a model, serve its clients | `bim-devserver`, `services/bim-authority` |
| 6 | Serve agents, run their scripts | `bim-mcp`, `bim-mcp-packs`, `bim-script-runner` |
| 5 | Browser screens | `bim-ui`, `bim-viewer`, `bim-viewer-3d`, `bim-grid`, `bim-schedules-ui`, `bim-editor`; `bim-editor-host` is the host contract they are written against |
| 4 | Trades, through `bim-pack` only | `bim-pack-electrical`, `-plumbing`, `-mechanical`, `-architecture`, `-structural`, `-civil`, `-site`, `-development`, `bim-first-party` |
| 3 | Services built on the kernel | `bim-sync`, `bim-sheets`, `bim-ifc`, `bim-calc`, `bim-lint`, `bim-library`, `bim-script`, `bim-plugin`, `bim-pack` |
| 2 | The model engine | `bim-kernel` |
| 1 | Pure primitives | `bim-units`, `bim-formula`, `bim-geometry` |

`bim-editor` and `bim-plugin` are absent from the tour's diagram. `bim-editor`
imports `bim-sync`, `bim-sheets`, `bim-library`, `bim-schedules-ui` and a
first-party pack, so it sits in layer 5, not below it. `bim-plugin` imports only
the kernel, `bim-script` and `bim-units`, so layer 3 is right and the tour lists
it there (`packages/bim-plugin/src/`, and a stale reference at
`catalogue.ts:23` that names `@permitzip/bim-mcp` in a comment only — it does
not import it).

## The contract

1. **Layer N imports only layers below it.** The edge is the import: a runtime
   `import`/`export … from`. `import type` and an import whose every name is
   `type X` vanish at runtime and are exempt — that is why the spine may name
   the `Command` type without depending on `commands.ts`
   (`import-layers.test.ts:41-49`, `:280-281`).
2. **The primitives import nothing above them.** `bim-units`, `bim-formula` and
   `bim-geometry` may not reach any BIM package, including each other's betters
   (`import-layers.test.ts:180-185`). This is why `registry/units.ts` re-exports
   `@permitzip/bim-units` rather than holding a table.
3. **The kernel imports no package built on it.** Not `bim-calc`, `bim-lint`,
   `bim-sheets`, `bim-sync`, `bim-library`, `bim-ui`, the viewers, `bim-grid`,
   `bim-schedules-ui`, `bim-devserver`, `bim-mcp`, `bim-mcp-packs` or
   `bim-script-runner` (`import-layers.test.ts:176`, `:213-218`); and no add-on:
   not `@permitzip/bim-pack*`, not `@permitzip/bim-first-party`
   (`c6k-kernel-imports-no-addon.test.ts:22`).
4. **Inside the kernel, the schema imports no domain.** `registry/**`,
   `catalog/types.ts`, `parts.ts` and `types.ts` may not import `connections/`,
   `routing/` or `load-points/` (`import-layers.test.ts:186-197`). A domain
   registers into the schema; the schema does not learn the domain.
5. **Inside the kernel, the edit spine imports no command module and no derived
   output.** `command-core.ts` imports none of `commands.ts`, `commands/*`,
   `*-commands.ts`, `schedules/`, `drawing/`, `diagrams/`, `crop` or `view3d`
   (`import-layers.test.ts:198-212`). What it needs arrives through its handler
   table: `registerCommandParser` (`command-core.ts:318`, called by
   `commands.ts:421`) and `registerEditHook` (`command-core.ts:329`).
6. **Everyone imports the kernel through its public entry.** A subpath in
   `packages/bim-kernel/package.json`'s `exports`, never a relative path into
   `src/` (`import-layers.test.ts:219-224`). Three edges are still debts, listed
   in `import-cycles.baseline.json`.
7. **Trade words live in packs.** A count of trade-specific words in the kernel's
   source may only fall (`trade-terms.test.ts:39-58` lists the terms and why
   each is a trade's; `:114` is the ratchet).
8. **A trade's change edits no kernel file.** A commit that changes a proof
   pack's code changes nothing under `packages/bim-kernel/`
   (`scripts/bim/check-proof-pack-commits.sh:1-26`, run by
   `.github/workflows/proof-packs.yml:45`). Civil is the proof pack today;
   Structural left the list in round 14 when it became first-party.

Everything **above** the kernel is review-only. The guard has six rules and all
of them are about the kernel, the primitives, or relative paths into the kernel;
`bim-ui` importing `bim-viewer-3d`, or `bim-sheets` importing `bim-ui`, passes
both the test and ESLint. The diagram's ordering between peers is a convention,
not a contract, and saying otherwise would be a lie a reader could act on.

## How it goes wrong

- **An import added for convenience.** One `import { convert } from
  "@permitzip/bim-units"` inside the kernel is fine (layer 1); one
  `"@permitzip/bim-calc"` is the kernel and its consumer becoming one thing, and
  the kernel stops being buildable alone.
- **A "temporary" relative import into kernel source.**
  `../../bim-kernel/src/questions/index.ts` compiles, typechecks under the
  solution's `paths`, and quietly bypasses the exports map — the one place that
  says which parts of the kernel are public. Three such edges are in the
  baseline; each has a subpath waiting (`/questions`, `/blocks`).
- **A trade word in the kernel.** `duct`, `circuit`, `sprinkler` in a kernel
  identifier means a trade rule the kernel now has to carry, and every other
  trade inherits it. The count is a ratchet because the honest fix is to move
  the rule into its pack, which lowers it.
- **Two sibling modules importing each other.** This happened:
  `OrientationBall` and `OrientationControls` each imported the other for a
  label, which made the two files one runtime import cycle. The vocabulary
  moved to a third file,
  `packages/bim-editor/src/editor/orientation/words.ts`, whose comment records
  the cause and the guard; the fix is `e4bb1b4` and
  `OrientationControls.tsx:32` still imports the ball, one way only. The
  import test walks `packages/bim-editor/src`, so it would have failed too;
  which of the two raised it first is not in the repository — unverified.
  *Tell:* a component importing its sibling for a string.
- **A baseline that grows.** `import-cycles.baseline.json` and
  `trade-terms.baseline.json` are shrink-only; a new entry is "we will fix it
  later" that never gets fixed.
- **Reading the numbers across the two documents.** The tour numbers the kernel
  as layer 2; the guard's comments number from zero (L0 primitives, L1 schema,
  L4 the edit spine, L5 derived output — `import-layers.test.ts:188`, `:200`,
  `:206`). "Layer 1" means the primitives in one document and the kernel schema
  in the other; what L2 and L3 mean inside the kernel is written down nowhere —
  unverified.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-kernel/src/__tests__/import-layers.test.ts` | new runtime cycles (as strongly connected groups), the six layer rules, a baseline entry that no longer occurs; its self-tests plant the round-4 spine cycle and a lower-imports-higher edge (`:292-307`) | any ordering above the kernel; an import of an unlisted kernel subpath (`resolvePackage` returns null, so that edge is not in the graph at all — it fails to compile instead) |
| `import-cycles.baseline.json` | today's debts, shrink-only | nothing on its own |
| `packages/bim-kernel/src/__tests__/c6k-kernel-imports-no-addon.test.ts` | a kernel import of `@permitzip/bim-pack*` or `bim-first-party` | a kernel import of an add-on's file by relative path |
| `packages/bim-kernel/src/__tests__/trade-terms.test.ts` (+ `trade-terms.baseline.json`) | a rise in any term's total, or a new file using one | a trade word nobody listed; a trade word that is legitimate kernel vocabulary |
| `packages/bim-kernel/__tests__/k14-no-mechanical-kind-names.test.ts` | the kernel naming a Mechanical element kind, or narrowing on one | the same word in another trade |
| `packages/bim-kernel/__tests__/c5k-proof-pack-isolation.test.ts` | a proof pack importing anything past the contract surface | that a commit keeps kernel and pack apart — that is the next row |
| `scripts/bim/check-proof-pack-commits.sh` | one commit touching a proof pack's code and `packages/bim-kernel/`; a manifest change past release metadata; self-test at `:92-196` | a kernel change the pack needed that landed in an earlier commit, as the rule intends |
| `eslint.config.mjs:70-152` | the same edges in the editor, as you type | nothing the test does not; it is the earlier, faster copy. Two copies is deliberate: ESLint fails the keystroke, the test fails the build, and only the test's baseline records a debt — a reviewed edit to one JSON file, not a rule quietly relaxed |
