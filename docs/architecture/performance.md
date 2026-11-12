# Performance

The numbers, the budgets and the commands live in [`docs/PERFORMANCE.md`](../PERFORMANCE.md)
and `docs/perf/mutinybim-budgets.json`. This page is the contract around them: what a
budget is allowed to claim, and how the gate goes wrong. It does not restate a figure.

## What it owns

| Where | What |
|---|---|
| `docs/PERFORMANCE.md` | the budgets, the commands, absolute versus relative, the CI shape |
| `docs/perf/mutinybim-budgets.json` | one row per measured operation: unit, scope, cache state, p50/p95, `status`; plus `invariants`, `regression` tolerances, `ci`, `knownBudgetFailures` |
| `scripts/perf/mutinybim/run.ts` | the gate: one tier per process, median-of-N, budgets, regression bands, invariants, `report.md` |
| `scripts/perf/mutinybim/*.ts` | one workload per suite (synthetic, sheets, lint, parts, calc, electrical, plumbing, schedules, grid, batch, …) |
| `scripts/perf/mutinybim/lib.ts` | `timeSync`, memory, percentile, verdicts, `loadBudgets` |
| `tools/perf/run-perf-suites.cjs` | the Jest perf suites that build a full-size model, one per process |
| `.github/workflows/perf-gate.yml` | when the gate measures, where it runs, and what blocks |

## The contract

1. **A budget is a measured limit that blocks, or it is not a budget.** A row declares its
   unit (`ms`, `us`, `ns`, `frameMs`, `MB`, `KB`, `count`, `ratio`), its scope
   (`in-process`, `browser`, `remote`, `stress`) and its cache state (`cold`, `warm`)
   (`lib.ts:199-217`). A file with no regression tolerance for a row's unit refuses to
   load (`lib.ts:235-247`, `:255-260`), so a new unit cannot slip in unjudged.
2. **Set from measurement, only ever tightened.** `docs/PERFORMANCE.md:14-17`: *"Never
   raise a budget to get a green build."* The reviewed alternative is a row on
   `knownBudgetFailures` for a tier — reported, not blocking — and the gate **fails when
   a listed row passes**, so the list cannot rot (`run.ts:490`).
3. **Absolute budgets need calibrated hardware; a relative budget is a shape check.**
   Absolute (the default): every timing at `ci.budgetFactor` (2) times its budget on the
   runner named by `PERF_RUNNER`. Relative (`MUTINYBIM_PERF_BUDGETS=relative`, always on
   a fork's pull request): invariants, sizes, counts and same-run ratios still block;
   timings are measured and compared to their budget and do not block (`run.ts:485-495`).
   Say it plainly: under relative budgets a 3x slower edit **passes**. It is a shape
   check — "the incremental path is still faster than the full one", "one edit still
   rewrites at most 50 elements" — not a speed guarantee.
4. **Invariants are the part that travels.** `invariants` in the budget file are exact
   maxima that prove selective loading and incremental updates (`findings.ledgerMismatches:
   max 0`, `x11.previewFullSyncs: max 0`), checked as the worst value across runs
   (`run.ts:464-482`). They hold on any hardware, which is why they are what a shared
   runner is allowed to fail on.
5. **One revision per process, one tier per run.** Each suite runs as a child process
   with a cold state per run; runs are combined median-of-N, and a cold metric is a single
   sample per run (`docs/PERFORMANCE.md:31-32`, `run.ts:1-16`). A `.perf-results/`
   `report.md` lists every row with its verdict and the counts that prove the work was
   incremental.
6. **A regression band, not a diff.** A metric regresses only when it is both beyond an
   absolute floor and beyond a relative band, per hardware class; without a same-class
   baseline it reports `NO-BASELINE` and only absolute budgets apply
   (`mutinybim-budgets.json` → `regression`).
7. **The gate runs where a change can hurt.** `.github/workflows/perf-gate.yml:63-88`:
   on a pull request that touches none of `packages/bim-kernel`, `bim-sync`, `bim-viewer*`,
   `bim-editor`, `services/bim-authority`, `scripts/perf/mutinybim`, `tools/perf`, the
   budget file or the workflow, it reports success **without measuring**, so it can be a
   required check. When it does measure, it runs `perf:bim:ci` (250k synthetic plus its
   suites) and then `perf:suites`.

## Where the time goes

Read from the budget file rather than guessed: 335 rows today, 322 in-process, 5 browser,
4 remote, 4 stress; 221 `active`, 114 `pending`. The named hot paths, each with a suite
that measures it:

| Path | Row | Measured by |
|---|---|---|
| Regenerate a sheet after an edit | `sheet.regen`, `sheet.regen.crop`, `sheet.regen.3d` | `scripts/perf/mutinybim/sheets.ts:1-14` |
| Render a sheet to vector PDF | `pdf.render` | same |
| Index a 250k model + a 100k linked model | `lint.index.cold` | `scripts/perf/mutinybim/lint.ts:7` |
| Lint one edit's scope | `lint.advance.50`, `lint.block.build` | `lint.ts:8-13` |
| An edit's preview and ghost | `edit.preview.*`, `edit.ghost.*` | `scripts/perf/mutinybim/synthetic.ts` |
| A schedule grid frame | `grid.scroll.10k.frame` | `scripts/perf/mutinybim/grid.ts` |
| Linked reference index and snap, door/window bodies, discipline lookup | `linked.reference.*`, `viewer.opening.body.*`, `kernel.discipline.*` | `run.ts:339-351` |

## How it goes wrong

- **A budget loosened to make a build green.** It usually arrives as a plausible sentence
  ("the runner got slower"). *Tell:* a diff in `mutinybim-budgets.json` whose p50/p95 goes
  **up**, with no fix in the same pull request. The honest moves are the fix, or a row on
  `knownBudgetFailures` with a reason, which the gate refuses to keep once it passes.
- **An absolute budget on shared hardware, then ignored.** On `ubuntu-latest` the gate
  runs relative by design; a timing that fails there does not block, and nobody reads the
  report. *Tell:* a pull request that reports "perf gate green" with no calibrated run
  behind it. `docs/PERFORMANCE.md:46-58` says which runner gives which answer.
- **A gate that only runs on some paths.** Three ways it happens: the workflow's scope
  regex (a hot path under a directory it does not name is never measured); `CI_SUITES`
  omitting `browser`, `remote`, `parameters`, `reference` and `linked` (`run.ts:49-51`),
  so those rows are `NOT-RUN` in CI whatever their budgets say; and `status: "pending"` —
  114 rows that are measured and judged `PENDING`, never blocking (`run.ts:441-442`).
  *Tell:* a row you expect to protect you, whose verdict in the last report is `PENDING`
  or `NOT-RUN`.
- **A metric filed under the wrong suite.** Suite assignment is a prefix regex over the
  metric id (`run.ts:413`); a new id that matches nothing lands in `synthetic` and is
  `NOT-RUN` from every other suite without an error.
- **Measuring a warm cache and calling it cold.** `cache` is a label on the row, not a
  property the runner checks (`lib.ts:203`); a suite that warms a model before its "cold"
  sample reports a fast cold number that is really warm. *Tell:* a `cold` row whose p50 is
  close to its `warm` sibling.
- **A comparator nobody tested.** The gate runs `--self-test` before it measures
  (`package.json:34`, `run.ts:66-120`): tolerances, noise floors and the verdict functions
  are exercised with known inputs, so a change to the comparator cannot silently pass
  everything.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `docs/perf/mutinybim-budgets.json` + `loadBudgets` | a row with no numeric budget, a unit with no tolerance, a malformed file (`lib.ts:235-247`) | a budget that was edited upward |
| the gate's `--self-test` | a comparator that stops regressing on known inputs | a budget row the suites never emit |
| `perf:bim:ci` on a calibrated runner | any timing over `budgetFactor` × budget; any invariant over its max | paths outside `CI_SUITES` |
| the relative mode | invariants, sizes, counts and same-run ratios on shared hardware | every timing — by design |
| `knownBudgetFailures` | a listed row that starts passing (the gate fails until it is removed) | a row that should have been listed and was quietly raised instead |
| `tools/perf/run-perf-suites.cjs` | a full-size suite over its ceiling, one model per process | suites not in its list |
| `.github/workflows/perf-gate.yml` | running the gate at all on the named paths | a regression through a path the scope regex does not name |

Whether a budget row still describes the thing it measures is review-only: nothing
compares a row's label to the code that emits it.
