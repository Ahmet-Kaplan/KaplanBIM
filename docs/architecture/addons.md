# Add-ons

## What it owns

| Where | What |
|---|---|
| `packages/bim-pack/` | The authoring surface: `definePack`, `contribute`, `defineExtensionPoint`, `PackSet`, `runPackConformance`. `PACK-CONTRACT.md` is the versioned reference |
| `packages/bim-kernel/src/packs/` | `contract.ts` (the definitions and their validation), `version.ts` (`PACK_CONTRACT_VERSION`), `points.ts` (the points no kernel module reads), `scope.ts`, `set.ts`, `pin.ts`, `trust.ts` |
| One point per consumer | `registry/element-kind-point.ts:243`, `fields/pack-parameters.ts:44`, `commands.ts:192`, `connections/model.ts:58`, `packs/points.ts:102` — declared beside the code that reads them |
| `packages/bim-first-party/` | The bundle: `FIRST_PARTY_ADDONS` (`index.ts:23`) and `installFirstPartyAddOns()` (`index.ts:26`) |
| `packages/bim-pack-electrical`, `-plumbing`, `-mechanical`, `-architecture`, `-structural`, `-civil`, `-site`, `-development` | The trades themselves |
| `packages/bim-plugin/` | The agent-tool catalogue each pack's tools are listed in |

## The contract

1. **Every trade plugs in through a versioned extension point.** The kernel does not
   know what a duct, a panel or a beam is; it knows a `kernel.element_kind`, a
   `kernel.parameter_set`, a `kernel.command`, a `kernel.network_adapter`. A point is
   `{ id, version }`, its id must be `<layer>.<name>`, and its version is a whole
   number from 1 (`packages/bim-kernel/src/packs/contract.ts:57`).
2. **The contract itself is versioned.** `PACK_CONTRACT_VERSION` is `1.13.0`
   (`packs/version.ts:2`). A pack names the range it was written for in
   `manifest.kernel`; within a major version changes are additive.
3. **`KNOWN_POINTS` is the list this release actually reads** (`packages/bim-pack/src/points.ts:95`).
   A point defined but not listed there is not loaded, so a pack contributing to it
   is silently inert. Add the point to `KNOWN_POINTS` in the same commit.
4. **What an add-on may register.** Element kinds with their stored shape, ends,
   anchor, values, symbol, plan graphics, solids, pick shape and per-record checks
   (`registry/element-kind-point.ts:151-196`); parameter sets whose quantities name a
   unit kind; commands with a zod schema and an `execute`, running through the same
   edit spine as kernel commands; network adapters that walk and total a service;
   agent tools **as data** — `AgentToolDescriptor` names a command, a read or a
   command builder, and nothing in the kernel runs it (`packs/points.ts:57-102`).
5. **UI contributions are plain data, not a point.** A first-party add-on exports
   `ADDON_UI` from its `/ui` entry — tab ids, labels, slot names, the words a host
   shows while the screen code loads — and a host pairs each id with its own screen
   (`packages/bim-pack-electrical/src/ui.ts:1-7`, `PACK-CONTRACT.md:620`). No UI
   library and no code crosses that boundary; there is no extension point for a
   React component, by design.
6. **Ids are namespaced.** `<pack>.<name>`, lower snake case; the first-party packs
   keep bare ids because their stored ids predate the contract. A pack may not take a
   built-in row's id.
7. **A pack set is per model.** `PackSet` is built once when a model opens and bound
   to that model; kernel code reads the set in force (`activePackSet()`). One process
   serves many models with different packs.
8. **`bim-first-party` is the bundle, not a second contract.** It imports each trade's
   `/host` entry and installs them in a fixed order (`index.ts:12-30`). The test
   harness installs the same bundle before every test, and a test opts out with the
   `@mutinybim-bare-kernel` marker (`tools/jest/setup.cjs:40-45`) — which is how the
   kernel proves it works with no trade installed.

`docs/ADD-ON-CONTRACT.md` is the author's guide: the manifest fields, the point
table, worked parameter-set and lint-rule examples, the test harness. It is not
repeated here.

## The proof-pack rule

A trade's change edits **no kernel file**, and its tests prove it. Two halves:

- **Per commit.** A commit that changes `packages/bim-pack-civil` changes nothing under
  `packages/bim-kernel`. The kernel change the pack needed lands first, as its own
  commit (`scripts/bim/check-proof-pack-commits.sh:1-22`). Release-metadata-only
  manifest edits are exempt, because a version bump touches every manifest at once.
- **Per import.** The pack imports only `@permitzip/bim-pack`, `@permitzip/bim-units`,
  `zod` and the kernel's published subpaths — never a `src`, never another BIM package
  (`packages/bim-kernel/__tests__/c5k-proof-pack-isolation.test.ts:1-13`).

**Exactly one package is the proof pack today: civil** (`c5k-proof-pack-isolation.test.ts:16`).
Structural was the second until round 14, when its classes left the kernel and it
became a first-party add-on; its import surface is still restricted by
`eslint.config.mjs:131`, but the per-commit rule no longer names it. So "every trade
is proven this way" is not true: civil is proven, the first-party trades are held to
the import surface and to the ratchets, and the newest trades are not proof packs.

## How it goes wrong

- **An add-on reaching into kernel internals.** `import … from "@permitzip/bim-kernel/src/…"`
  instead of a published subpath, or a relative path into another package. *Tell:* a
  specifier containing `/src/`. The public entry exists so a kernel file can move.
- **A new extension point added without a version.** A point defined inline, or
  reused with a wider item type and the same `version: 1`. A pack written against the
  old shape then contributes rows the reader misreads, and nothing fails.
- **Trade knowledge in the kernel.** The ratchet counts trade words in kernel source
  and may only go down (`packages/bim-kernel/src/__tests__/trade-terms.test.ts:1-33`).
  A kernel helper named `panelCircuitDefault` is the smell even when it type-checks.
- **Generic capability living in a pack.** The reverse: a pack owning walls, levels or
  the edit spine. If two trades would need it, it belongs in the kernel — open a
  `kernel gap` issue rather than a third copy.
- **A pack importing another pack.** `requires` exists in the manifest for this, and
  no pack in this repository declares one today. What actually happens is that
  `bim-first-party` imports the trades' `/host` entries — a dependency
  `resolvePackPins` cannot see, so a model pinning two packs that lean on each other
  says nothing about the order they must load in.
- **A point nobody reads.** A contribution to a point missing from `KNOWN_POINTS`
  loads nothing and reports nothing.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-kernel/__tests__/c5k-proof-pack-isolation.test.ts` | civil importing anything outside the contract surface; the pack's `package.json` licence | every pack that is not civil |
| `scripts/bim/check-proof-pack-commits.sh` | a commit touching civil that touches the kernel | not wired into a test; it runs in the PR lint workflow |
| `eslint.config.mjs:131`, `:140` | the same import surface for structural, and for the first-party trades | anything not linted in CI |
| `packages/bim-kernel/src/__tests__/c6k-kernel-imports-no-addon.test.ts` | kernel source importing `@permitzip/bim-pack*` or `bim-first-party` | a kernel file reaching trade logic without importing a pack |
| `packages/bim-kernel/src/__tests__/trade-terms.test.ts` | a trade term's count rising, or a new file using one | a trade *concept* spelled with none of the 39 counted words |
| `packages/bim-kernel/src/__tests__/import-layers.test.ts` | the kernel importing any package built on it; relative paths into kernel `src` | a pack importing another pack (no rule) |
| `packages/bim-lint/__tests__/c6x-no-addon-cycle.test.ts` | shared packages (lint, calc, library, sheets, pack, kernel, sync, units, formula, geometry) importing an add-on | a new shared package added to no list |
| `packages/bim-kernel/src/__tests__/c6k-command-dispatch.test.ts` | a pack command parsing through the same `commandSchema` as a kernel command | a pack command that parses and does the wrong thing |

No guard forbids a second unversioned point, and no guard requires a new point to
appear in `KNOWN_POINTS` — review-only.
