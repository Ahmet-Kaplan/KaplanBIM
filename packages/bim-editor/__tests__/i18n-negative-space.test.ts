/**
 * The other half of the caption guard: English that never got a `t()` call.
 *
 * `i18n-panels-chrome`, `i18n-views-sheets` and `i18n-operator-messages` prove
 * that every caption somebody *wrote* is still keyed. None of them can see a
 * sentence that was never keyed at all — that is how a raw "Draw inside {view}'s
 * frame…" and a raw "You can edit it when they finish." shipped beside their own
 * keyed twins, and why `npm run i18n:review` still said "0 missing".
 *
 * `helpers/editor-visible-english.ts` scans the same trees for user-visible
 * English (JSX children, `<title>` tooltips, `aria-label`/`title`/`placeholder`,
 * and literals handed to `label:`/`prompt:`/`refusal:`/…) that is *not* inside a
 * `t(…)` call, and the work stays enumerable here: a new one fails this file with
 * its file and line.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  describe,
  unkeyedTwins,
  visibleEnglish,
} from "./helpers/editor-visible-english";

const EDITOR_SRC = path.join(__dirname, "..", "src", "editor");

/** `<repo>`: this file is `<repo>/packages/bim-editor/__tests__/i18n-negative-space.test.ts`. */
const REPO_ROOT = path.join(__dirname, "..", "..", "..");

/**
 * The trees this guard owns, one list per stage-4 group so a failure names the
 * group that regressed. A directory joins this list when its task is done; it is
 * never removed, because the point of a negative-space guard is that the hole it
 * closed stays closed.
 */
const OWNED_DIRS = [
  // Stage 4 · Task 4.2 — the drawing surfaces a person spends the day in.
  "views-sheets",
  "orientation",
  // Stage 4 · Task 4.3 — the MEP tabs, panels and design dialogs.
  "ventilation",
  "balance",
  "loads",
  "electrical",
  // Stage 4 · Task 4.3 — the plumbing tab, its systems and pipe types, stacks,
  // the outfall and its walk, load points, sizing, hydraulics and insulation.
  "plumbing",
  // Stage 4 · Task 4.4 — the spaces panel: spaces, rooms, zones, fire areas and
  // the drawings placed under a plan.
  "spaces",
  // Stage 4 · Task 4.6 — questions: the RFI list, the thread, the ask/answer/
  // forward/email dialogs, the pins layer, the readers and the stale-answer
  // notices a person sees in the questions tab.
  "questions",
  // Stage 4 · Task 4.6 — the equipment list: the list dialog, the add-column
  // dialog, the proposed-loads panel and the fields/parameters/plan words the
  // list writes per element.
  "equipment-list",
  // Stage 4 · Task 4.6 — the library panel: the disciplines, the packs a firm
  // installs and the part import a person brings in from a file.
  "library",
  // Stage 4 · Task 4.6 — coordination: the federated-model review, its clash
  // groups, the findings and the refusal vocabulary §8 already fixed.
  "coordination",
  // Stage 4 · Task 4.4 — project management, library, settings and IFC.
  "parts-list",
  "change-orders",
  "signing",
  "versions",
  "merge",
  "submittals",
  "settings",
  "levels",
  "ifc-import",
  "ifc-export",
  // Stage 4 · Task 4.6 — groups, phases, phase filters, typicals and tag styles:
  // the "Groups & phases" surface a person meets in the rail, the status strip and
  // the Properties panel's Group/phase fields.
  "organization",
  // Stage 4 · Task 4.5 — every ribbon tooltip, which `tooltipFor()` shows on hover.
  "ribbon",
  // Outside stage 4 — the chrome every screen hangs on: the saved layout (one row
  // per surface, read when the model opens and saved a moment after each change),
  // the sections it collapses, and the rail's drag edge with its resize tooltip.
  "layout",
  // Outside stage 4, and already keyed when measured (0 findings): the gesture and
  // trackpad plumbing with its hint chip (`input`), the editor's stores and their
  // hooks (`state`), the live-connection chip (`connection-status`) and the
  // translator itself (`i18n`). Guarded so the hole stays closed — a caption added
  // to any of them tomorrow fails with its file and line.
  "input",
  "state",
  "connection-status",
  "i18n",
  // Outside stage 4 — a schedule docked as a tab beside the plan: its title, the
  // close button, the read-only line, the loading row and the error card with Retry.
  "schedule-tab",
  // Outside stage 4 — how a linked model draws: the one-click look on each model's
  // card, the transparency and per-category overrides in View properties, the
  // disciplines field, the contributor fields, the identity dialog and the
  // before/after preview. Its undo labels are composed here too.
  "linked-display",
  // Outside stage 4 — the part editor: the window a person draws a part in (its
  // planes, sketches, extrudes and revolves, parameters and sizes, connectors,
  // clearance zones and test tab), the 2D and 3D canvases, the publish dialog and
  // the placed part's update review (285 findings, 14 files).
  "part-editor",
  // Outside stage 4 — design limits: the library panel that lists the firm's rules
  // of thumb (one row per limit, its band, its source and who set it), the add/
  // change dialog and the put-back/remove confirm (60 findings, three files).
  "design-limits",
  // Outside stage 4 — the Inspector: the part's Properties form — one field per
  // parameter in facet sections, the spare fields behind "More …", the read-only
  // types behind Edit type, and the fed-from/circuit field the link owns
  // (30 findings, three files).
  "inspector",
  // Outside stage 4 — the linked models as reference geometry: the snap and
  // dimension points that follow a linked wall by its GlobalId, the copies kept in
  // step with the link for loads, and the words a tool says when there is nothing
  // to snap to. A core workflow for this firm.
  "linked-reference",
];

/**
 * Trees the bilingual plan owns that are **not** finished, so they are not
 * guarded yet: a guard over a half-keyed tree reports the half that is honest to
 * report and hides the half nobody has looked at. Each joins `OWNED_DIRS` when
 * its task closes (`docs/superpowers/plans/2026-11-10-bilingual-ui.md`, Stage 4).
 *
 * **Empty since Task 4.6.** The last four trees closed in one round —
 * `questions` (213), `equipment-list` (110), `library` (68) and `coordination`
 * (58) — so the discovery below now covers every Stage-4 tree: a tree added
 * under `src/editor` tomorrow is unguarded and unexplained until someone puts it
 * here or in `OUTSIDE_STAGE_4`, and a tree that regresses fails with its file
 * and line. The list stays because that is the point of it, not because a tree
 * is owed.
 */
export const NOT_YET_GUARDED = [] as const;

/**
 * Every tree under `src/editor` that **Aşama 4 never covered**: a panel or a
 * surface the bilingual plan does not name, so no task owes it a `t()` call.
 * They are listed so the discovery below can tell "not in this plan" from
 * "somebody forgot", which is the whole reason it is a list and not an omission.
 */
const OUTSIDE_STAGE_4 = [
  "architecture",
  "blocks",
  "branches",
  "calc-sheets",
  "ceilings",
  "checklist",
  "code-change",
  "code-study",
  "connect-agent",
  "connect-grip",
  "connection-types",
  "construction",
  "contributions",
  "copies",
  "diagrams",
  "graph",
  "graphics",
  "loads-policy",
  "planned",
  "responsibilities",
  "schedules",
  "view-input",
] as const;

/**
 * The three lists above are one classification, and it is checked against the
 * filesystem rather than trusted: `every tree under src/editor is classified`
 * fails on a directory nobody named. That is how a tree added tomorrow cannot be
 * forgotten — it is unguarded and unexplained until someone classifies it — and
 * how a tree renamed or deleted cannot leave the guard pointing at nothing.
 */
const CLASSIFIED = new Set<string>([
  ...OWNED_DIRS,
  ...NOT_YET_GUARDED,
  ...OUTSIDE_STAGE_4,
]);

const EDITOR_ENTRIES = fs.readdirSync(EDITOR_SRC, { withFileTypes: true });

/** The roots, read off the filesystem: `roots` takes paths, and a stale name here would guard a hole. */
/**
 * Top-level files still owed a translation round, by name.
 *
 * The same shape `NOT_YET_GUARDED` gives the trees, for the same reason: a guard over
 * a half-keyed file reports the half that is honest to report and hides the half
 * nobody has looked at. **Empty**: the last eight files closed in the round of
 * 2026-11-10 — `LinkedElementProperties`, `RunProperties`, `RunMoveForm`,
 * `PartSpaceProperties`, `GroupProperties`, `LinkModelDialog`, `DocsPickerDialog`
 * and `LinkedModelsPanel` — so the discovery below now guarantees **every** file
 * directly in `src/editor` (64 of them, read off the filesystem). The list stays
 * because a file added tomorrow is guarded on the day it appears, and a file that
 * has to wait is named here with its owner rather than silently skipped.
 */
export const NOT_YET_GUARDED_FILES: readonly string[] = [];

/**
 * The files that sit **directly** in `src/editor`: the shell (`BuildingModelSurface`),
 * the session and its refusal vocabulary (`model-session`, `operator-messages`),
 * the ribbon builder and the panels that hang off the shell.
 *
 * They are discovered, not listed. `OWNED_DIRS` names directories and the scan used
 * to walk only directories, so the most-used surfaces in the editor — the ones a
 * person sees on every screen — were outside the guard by construction. A file
 * added beside them tomorrow is guarded on the day it appears.
 */
const TOP_LEVEL_FILES = EDITOR_ENTRIES.filter(
  (entry) => entry.isFile() && /\.tsx?$/u.test(entry.name),
).map((entry) => entry.name);

/** The roots, read off the filesystem: `roots` takes paths, and a stale name here would guard a hole. */
const OWNED = [
  ...OWNED_DIRS.map((dir) => path.join(EDITOR_SRC, dir)),
  ...TOP_LEVEL_FILES.filter(
    (file) => !NOT_YET_GUARDED_FILES.includes(file),
  ).map((file) => path.join(EDITOR_SRC, file)),
];

/**
 * `apps/<app>/client`: the browser code a host app ships beside the editor.
 *
 * The negative-space guard stopped at `packages/bim-editor/src`, so the hosted
 * app's own bar, its Ask-AI panel and the messages behind them were read by
 * nothing: the editor page rendered a Turkish editor under an English bar
 * (`Ask AI`, `View only`, `← My models`, `Connect an assistant`) while every
 * guard stayed green, because none of them looked outside `packages/`. Found by
 * discovery, not by a list, so a second app's client code is guarded on the day
 * it appears.
 */
const APP_CLIENT_DIRS = fs
  .readdirSync(path.join(REPO_ROOT, "apps"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(REPO_ROOT, "apps", entry.name, "client"))
  .filter((dir) => fs.existsSync(dir));

test("every tree under src/editor is classified, and every guarded name exists", () => {
  // A new directory that nobody named would be unguarded and unexplained, which is
  // exactly how the hosted app's own bar stayed English under a Turkish editor.
  const unclassified = EDITOR_ENTRIES.filter(
    (entry) => entry.isDirectory() && !CLASSIFIED.has(entry.name),
  ).map((entry) => entry.name);
  const missing = OWNED_DIRS.filter(
    (dir) => !EDITOR_ENTRIES.some((entry) => entry.name === dir),
  );
  // A top-level file is guarded by discovery, so it needs no list — but it does need
  // to actually reach the scan, and a file whose name the scan skipped would be the
  // same hole in a new place. A file that is *not* guarded must be named as owed,
  // and a name that no file answers to would guard nothing.
  const unguardedFiles = TOP_LEVEL_FILES.filter(
    (file) =>
      !OWNED.includes(path.join(EDITOR_SRC, file)) &&
      !NOT_YET_GUARDED_FILES.includes(file),
  );
  const staleOwedFiles = NOT_YET_GUARDED_FILES.filter(
    (file) => !TOP_LEVEL_FILES.includes(file),
  );
  expect({ unclassified, missing, unguardedFiles, staleOwedFiles }).toEqual({
    unclassified: [],
    missing: [],
    unguardedFiles: [],
    staleOwedFiles: [],
  });
});

test("every file directly in src/editor is inside the scan, and the scan is not empty", () => {
  // The guarantee `NOT_YET_GUARDED_FILES` is empty buys: the eight files that closed
  // on 2026-11-10 (`NOT_YET_GUARDED_FILES` was their list) are read by `visibleEnglish`
  // now, together with the shell, the session, the ribbon and every helper beside them.
  const scanned = new Set(OWNED.map((entry) => path.basename(entry)));
  expect(TOP_LEVEL_FILES.filter((file) => !scanned.has(file) && !NOT_YET_GUARDED_FILES.includes(file))).toEqual([]);
  // Discovery, not a list: the count comes off `fs.readdirSync`, so a file added
  // tomorrow is in `TOP_LEVEL_FILES` before anyone writes its test.
  expect(TOP_LEVEL_FILES.length).toBeGreaterThan(40);
});

test("no user-visible English in the stage-4 trees sits outside a translator", () => {
  const found = visibleEnglish(OWNED);
  // Printed, not counted: the point of this guard is that the work is enumerable.
  expect(found.map(describe)).toEqual([]);
});

test("no keyed sentence has an unkeyed twin in these trees", () => {
  // The same English in two places, one of them raw, is a revert nobody had to write.
  expect(unkeyedTwins(OWNED).map(describe)).toEqual([]);
});

test("no user-visible English in an app's browser code sits outside a translator", () => {
  // A path relative to the repository, so a failure reads `apps/mutinybim-web/client/hosted-bar.tsx:150`.
  expect(visibleEnglish(APP_CLIENT_DIRS, REPO_ROOT).map(describe)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Each hole in the scanner, closed — proved with a planted violation
// ---------------------------------------------------------------------------

/**
 * The scanner's own test: a fake source tree with one caption in each shape the
 * guard must catch. Written through `fs` into a temporary directory and read back
 * by the same `visibleEnglish`, so a narrowing of the scanner fails here before it
 * can go quiet on the real tree.
 */
const PLANTED = `'use client'
import { toast, setError } from 'x'

export function Planted({ view, key, selectionLabel }: { view: { name: string }; key: string; selectionLabel: string | null }) {
  toast('A toast that nobody keyed')
  toast.error('An error toast that nobody keyed')
  setError('A refusal that nobody keyed')
  notify('Pick a wall, or two points along it')
  const label = ['move the note', 'a wall'][0]
  return (
    <div>
      <p>Press {key} to finish the drawing</p>
      <span>Rename this sheet; it keeps its history</span>
      <b>{selectionLabel ?? 'Nothing selected'}</b>
      <i>Cancel</i>
      <button aria-label={\`Clear \${view.name}\`}>x</button>
      <title>{canEdit()}Drag this corner</title>
    </div>
  )
}

function canEdit(): string {
  return \`Crop box \${1} × \${2} ft. Release to save, Esc to cancel.\`
}
`;

test("the scanner reports every caption shape a person can ship, with its line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "visible-english-"));
  fs.writeFileSync(path.join(dir, "Planted.tsx"), PLANTED);
  const found = visibleEnglish([dir], dir).map(
    (entry) => `${entry.kind}:${entry.text}`,
  );
  fs.rmSync(dir, { recursive: true, force: true });

  const wanted = [
    // 1. call-argument strings
    "argument:A toast that nobody keyed",
    "argument:An error toast that nobody keyed",
    "argument:A refusal that nobody keyed",
    "argument:Pick a wall, or two points along it",
    // 2. a single capitalised word
    "jsx:Cancel",
    // 3. a JSX child that interpolates: the words around the expression
    "jsx:Press",
    "jsx:to finish the drawing",
    // 4. a caption with a semicolon in it
    "jsx:Rename this sheet; it keeps its history",
    // 5. a brace-aware attribute expression, and a child expression's literal
    "attribute:Clear",
    "jsx:Nothing selected",
    // a template returned through a helper
    "argument:Crop box × ft. Release to save, Esc to cancel.",
  ];
  for (const caption of wanted) expect(found).toContain(caption);
});
