# The firm library

## What it owns

| Where | What |
|---|---|
| `packages/bim-library/src/schema.ts` | `mutinybim-library` v1: the bundle and every item type |
| `packages/bim-library/src/validate.ts` | `parseBundle`, `checkBundle`, `loadBundle`: one answer, all problems, with line numbers |
| `packages/bim-library/src/items/*.ts` | the item schemas: `part-type`, `element-type`, `design-limit`, `lookup-table`, `script`, `sheet-items` |
| `packages/bim-library/src/layering.ts` | model → project → firm → built-in precedence |
| `packages/bim-library/src/pin.ts` | a model's pinned copy of what it uses |
| `packages/bim-library/src/provider.ts`, `file-provider.ts`, `conformance.ts` | the storage contract, the shipped file provider, and its executable checks |
| `packages/bim-library/src/package/` | a distributable `mutinybim-library` package: manifest, verify |
| `packages/bim-library/PROVIDER.md` | the provider contract as prose |
| `packages/bim-editor-host/src/data.ts` | `EditorFirmLibraryPort`: how it reaches the editor |

## The contract

1. **The library is a documented file format, not a database.** `mutinybim-library` v1 is
   plain JSON: `format`, `version`, id, name, publisher, revision, an optional
   `requires.mutinybim`, then one array per item type (`schema.ts:211-241`). It is
   *"Plain JSON, so a firm can keep one in a folder, a repository or a database and every
   host reads it the same way"* (`schema.ts:15-17`). That is the point: a file can be
   versioned, diffed, reviewed and handed to a successor. `FileLibraryProvider` reads
   folders, single files, URLs and in-memory bundles (`PROVIDER.md:7-10`); a host that
   keeps libraries in its own database implements the same interface and runs the same
   conformance suite.
2. **What it holds.** Display profiles (`units`), object classes (`classes`), shared
   fields, named calculations (`formulas`), relationships, schedule templates, tag types,
   disciplines, part types, scripts, design limits, lookup tables, element types (a
   firm's wall/door/window types, `items/element-type.ts:3-9`), title blocks and keynote
   tables. A part type is the kernel's own stored definition, so placing one needs no
   kit to run (`items/part-type.ts:5-17`).
3. **Every item carries an id, a revision and a content hash**, and the hash is checked
   rather than trusted: absent is computed on load, present and wrong is refused
   (`schema.ts:19-24`, `pin.ts:20-27`).
4. **Nothing half-loads.** `checkBundle` collects every problem — the schema, duplicate
   ids and keys, hashes, classes and fields as a registry layer, units against their
   kinds, every calculation's expression and result type, cycles between calculations,
   every example run as a test — and any problem refuses the whole bundle
   (`validate.ts:26-31`, `:198-260`). A file with a line number gets the line
   (`validate.ts:143-147`).
5. **A bundle states the reader it needs.** `requires.mutinybim` is checked against
   `MUTINYBIM_LIBRARY_ENGINE_VERSION` and a mismatch is refused in words, in either
   direction (`validate.ts:198-207`).
6. **Precedence is fixed, and a model keeps its own copy.** Model pin, then project, then
   firm, then built-in; the first layer holding an id — or a key — wins
   (`layering.ts:1-9`, `:43-70`). A pin holds the item itself with its hash, so drawing a
   schedule, printing a sheet or evaluating on the authority never calls a provider, an
   issued sheet never changes under a firm edit, and a newer revision is *offered*
   (`pinUpdates`), never applied (`pin.ts:1-8`, `PROVIDER.md:20-26`).
7. **The editor gets it from the host, and says so when the host has none.**
   `EditorFirmLibraryPort` is an optional port on the host contract
   (`bim-editor-host/src/data.ts:81-112`, `:390`); the editor never reads a folder itself
   and never assumes a library. With no port it shows the feature's name and what it
   needs, in words (`data.ts:1-7`, and `editor/library/PartImportSection.tsx:36`).
8. **A script-made part type carries its provenance.** The item holds the kernel
   definition *and*, beside it, the script (id, key, semver version, content hash), every
   value it ran with, the kit and kernel-contract versions, the packs it needed, who
   asked and when, and `outputHash` of the definition the run produced
   (`items/part-type.ts:18-38`; written by `bim-script/src/provenance.ts:29-49`). The
   definition's own `source` stays as the kernel wrote it, so every reader of a placed
   part reads it as before (`items/part-type.ts:11-17`).
9. **`regenerate` reports, it does not apply.** Re-running the saved script answers
   `up_to_date` (same output hash), `changed` (a new revision plus `because`: different
   values, a script version, the kit, the contract, or "the saved part was edited after
   it was made"), `not_from_script`, or `gone`, and the new revision goes to a review
   (`items/part-type.ts:58-91`; `bim-script/src/provenance.ts:52-63`).

## How it goes wrong

- **A library only one app version can read.** `version` is `z.literal(1)`
   (`schema.ts:213`), so a v2 bundle is refused outright — correct in the safe direction,
   silent in the other: run it, an *unknown top-level section* in a bundle written by a
   newer app is accepted and dropped (`libraryBundleSchema` does not refuse unknown
   keys), so a republish from the older app loses it. *Tell:* a section in a bundle that
   no `ITEM_SECTIONS` entry names.
- **A script-made part type with no provenance.** `provenance` is **optional**
   (`items/part-type.ts:49`), so the schema cannot tell a part a script made from one a
   person drew; the honest answer is `not_from_script` at regeneration time
   (`:68`, `:77-79`), not a refusal at load. *Tell:* a part type whose definition names a
   script source and whose provenance is absent.
- **A format change without a version.** Adding a required field to an item type makes
   every bundle a firm already holds unreadable, and a `version` bump without a reader for
   the old one strands the archives. *Tell:* a schema change in `items/` with no test
   loading a bundle written before it.
- **The editor assuming a library the host did not provide.** Reading
   `data.firmLibrary` without an availability check turns "this host has no library" into
   a failed request and an English error on a Turkish screen. *Tell:* `port.` used without
   the `if (!port)` branch.
- **A pin that drifts.** A model copy that disagrees with its pin, or whose content
   changed after pinning, is a `LibraryProblem` with words a person can act on
   (`pin.ts:33-45`); a print made from the drifted copy is the failure it prevents.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-library/src/validate.ts` at every load and publish | any problem, the whole bundle refused, each with the item and the line | a section the schema does not know |
| `packages/bim-library/__tests__/provider-conformance.test.ts` (`runProviderConformance`) | a provider breaking the storage contract — scope precedence, revisions, conflict, `read_only`/`forbidden`, bad hashes — with a deliberately broken provider proving the suite fails | what an implementation does outside the interface |
| the same file's file-behaviours tests | folders, read-only files, a bad file refused whole, line numbers | a host's own provider unless it runs the suite |
| `__tests__/x11-package-verify.test.ts` | a package whose manifest or hashes do not match its files | a package built with a newer schema |
| `items/part-type.ts` (`compareRegenerated`) | a run whose provenance names an output its definition does not hash to | a part saved with no provenance at all |
| `packages/bim-library/src/conformance.ts` + `PROVIDER.md` | the contract as executable checks, for any host | a host that never runs them |

No test loads a bundle written by an older or newer schema version; cross-version reading
is review-only, and the two behaviours above (unknown section dropped, `version` refused)
were confirmed by running the schema, not by a guard.
