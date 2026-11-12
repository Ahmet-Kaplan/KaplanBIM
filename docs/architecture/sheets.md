# Sheets and printed output

## What it owns

| Where | What |
|---|---|
| `packages/bim-kernel/src/documents.ts` | `Sheet`, `Viewport`, `DrawingItem`: what a sheet holds (`:211`, `:225`) |
| `packages/bim-kernel/src/drawing/` | the paper-space scene: `sheet.ts` (primitives, pens, tones), `title-block.ts`, `title-block-definition.ts`, `set-order.ts`, `svg.ts` |
| `packages/bim-sheets/src/pdf-core.ts` | the vector PDF writer with no Node dependency, so the browser prints too |
| `packages/bim-sheets/src/pdf.ts` | the Node wrapper: files, hashing, note fonts |
| `packages/bim-sheets/src/set-issue.ts`, `issue.ts`, `set-pdf.ts` | issuing a set: capture → render → manifest |
| `packages/bim-sheets/src/reissue-check.ts` | an approval that stops a re-issue until its signer acts |
| `packages/bim-sheets/src/ifc-plan.ts` | a linked model's plan background, cut on Node |
| `packages/bim-editor/src/editor/views-sheets/` | the screen: the same scene as SVG, and the print/issue buttons |

## The contract

1. **One scene graph, two writers.** `buildSheetSceneFor` returns a `SheetScene` in
   paper millimetres; the screen draws it with `sceneToSvg` and paper with
   `renderSheetPdfWith`. `drawing/svg.ts:16-17`: *"Same scene graph as the PDF writer,
   so what the engineer sees is what prints"*. `views-sheets/use-drawn-scene.ts:29` and
   `views-sheets/print-sheet.ts:30` call the same builder.
2. **Paper is black on white and never reads the theme.** Paper is a literal white
   rectangle (`drawing/svg.ts:25`, `fill="#fff"`) and ink a literal `#000`
   (`svg.ts:6`); the PDF writer's ink is `rgb(0, 0, 0)` (`pdf-core.ts:116`). No
   `--mutiny-*` variable is read anywhere in `packages/bim-sheets/src` or the kernel's
   drawing layer, and no stylesheet takes part in a sheet.
   This is the exception in `AGENTS.md` rule 5, and the reason is the document, not the
   code: **a sheet is something a person signs and hands to a client.** The same sheet
   has to look the same on any machine, in either app mode, and in either language's
   typography, because the reader is not the person who set their theme.
3. **A sheet holds, a viewport references.** A `Sheet` holds its number, title,
   `viewIds`, and `props`: title block, `fields` (resolved through the project's
   parameters), and the revision table (`documents.ts:211-221`). A `Viewport` points at
   one `viewId` with a paper centre, a frame size and a scale (`documents.ts:225-249`);
   the view holds the crop and the level. A library title block is **copied onto the
   sheet when it is chosen** (`documents.ts:213-218`), so a later firm edit to that
   title block does not change a sheet already drawn from it.
4. **Print settings come from the model, not the machine.** `printBlackOnly` is a
   project setting (`organization/model.ts:302`, command at `organization/commands.ts:544-547`)
   and the only thing that turns a colour into grey: `modelPrintOptions`
   (`pdf-core.ts:93-95`) is passed at all three call sites — Print PDF
   (`views-sheets/print-sheet.ts:34-35`), Print set and Issue set
   (`set-issue.ts:98`), single-sheet issue (`issue.ts:70`).
5. **A set is issued from a snapshot, never from live state.** `captureSnapshot` writes
   the canonical model to a content-addressed file, write-once (`issue.ts:39-57`);
   `issueDrawingSet` renders only from that text and the manifest names the snapshot
   hash, the PDF hash, the embedded details' hashes, the note fonts' hashes and each
   sheet's own fingerprint (`set-issue.ts:194-240`). Page order is binding order, by
   discipline designator then sheet number, the same `setOrder` the Views & Sheets list
   uses (`drawing/set-order.ts:13-21`).
6. **What was measured is what prints.** Note faces are embedded and verified against
   the hashes the layout was measured from, and a different file refuses rather than
   printing something that does not match the screen (`text/fonts.ts:18-21`, `:40`); a
   placed standard detail whose bytes changed refuses to issue (`pdf-core.ts:38-41`,
   `:136`). Creation and modification dates are fixed so one snapshot renders one
   byte-identical PDF (`pdf-core.ts:105-108`).
7. **Issued paper stays English, and that is not a gap.** No translator is reachable
   from the sheet path: the kernel's drawing layer may not import `bim-ui`
   (`bim-kernel/src/__tests__/import-layers.test.ts:214-218`), and there is no `t()` in
   `packages/bim-sheets/src`. The words on paper are the title block's own
   (`drawing/title-block.ts:368`, `:378`, `:453`, `:458`) — a firm's title block supplies
   its own `label`s as data (`bim-library/src/builtin/title-blocks.ts:71-74`) — and the
   project's values. A client's drawing should read in the drawing's language, not the
   reader's; for the mechanism that *does* translate, see [i18n](i18n.md).

## How it goes wrong

- **A theme value reaches paper.** The paper rect in the app is a Tailwind literal
  (`views-sheets/DrawingCanvas.tsx:1618`, `bg-white`). Turning it into `bg-background`
  is a one-word change that makes the sheet dark in dark mode while the PDF stays
  white — and it will pass every existing test. Same shape: passing a resolved
  `--mutiny-*` value into a primitive's `color`.
- **A sheet that renders differently in dark mode.** *Tell:* any `dark:` class, or a
  `var(--mutiny-` read, inside `views-sheets/` or a drawing module. Nothing in the
  scene graph can carry one, so it has to come in through the wrapper.
- **A title block whose text is translated.** `translateDomainLabel` and `t()` exist and
  are tempting; routing a consultant role's `label` through them makes the same sheet
  print "İşveren" for one reader and "Owner" for another, and an already-issued PDF no
  longer matches what a reprint produces. *Tell:* a `t(` or `translateDomainLabel(` in
  the drawing layer, or a translated label stored back into the model.
- **A reprint from live state.** Issuing is allowed to be slow; printing from the open
  model instead of the snapshot is the error, because the manifest then describes a
  revision nobody rendered. *Tell:* a manifest whose `snapshotSha256` was not the input
  to the render.
- **A paper size nobody reconciled.** A library title block sets the paper
  (`documents.ts`, `sheetPaperSize` at `:312`); a viewport placed for ARCH D on a
  title block's ANSI B is off the page, which is what the `viewport-off-sheet`
  finding is for ([lint](lint.md)).

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-ui/__tests__/theme-token-compliance.test.ts` | any hex outside the theme source, with the paper-printing modules listed by name and each exemption re-checked to still exist and still carry hex (`:50-83`, `:225-232`) | a `--mutiny-*` variable reaching a drawing module; the paper-container class in the editor |
| `packages/bim-kernel/src/__tests__/import-layers.test.ts` | the kernel's drawing layer importing `bim-ui` (`kernel-imports-no-upper-packages`) | `bim-sheets` importing `bim-ui` — no layer rule covers package → package above the kernel |
| `packages/bim-sheets/__tests__/s5b-black-only-print.test.ts` | colour surviving a black-only print, and the setting round-tripping through a command | that each of the three print call sites passes the option — that is read from the code, not tested |
| `views-sheets.test.ts`, `documents.test.ts`, `block-snapshots.test.ts` | a PDF that does not measure true at its scale; frame/title-block geometry; issue snapshots of live blocks | screen-versus-paper equality beyond "same builder" |
| `packages/bim-sheets/__tests__/c10-reissue-check.test.ts` | an approval checked against an older rule blocking a re-issue, per signer | a stale approval that never entered the log |

No guard compares a screen render in dark mode with its PDF; that one is review-only.
