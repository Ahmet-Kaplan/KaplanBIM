# Performance

MutinyBIM is built for 250,000- and 1,000,000-element models with many people
editing at once. Performance is checked like correctness: by measured budgets
that block a change.

## The budgets

`docs/perf/mutinybim-budgets.json` holds one row per measured operation: its
unit, scope (in-process, browser, server), cache state, and a p50 and p95
budget. It also holds **invariants**, exact limits that prove selective loading
and incremental updates (for example, how many elements one edit rewrites).

A row whose operation no runner can measure says so in the file
(`"measuredInCi": false`, with its reason) and is measured by hand: see
[The 3D rows: a person measures these](#the-3d-rows-a-person-measures-these).

Budgets are set from measurements and only ever tightened. **Never raise a
budget to get a green build.** If your change is slower, fix the hot path; if
that is not possible, say why in the pull request and let a maintainer decide.

## Running it

```bash
npm run perf:bim:ci                 # the gate: 250k synthetic building and the suites CI runs, 3 runs each
npm run perf:bim -- --suites=parts  # one suite, day to day
npm run perf:suites                 # the perf tests that build a full-size model, one per process
npm run perf:suites -- --only=k9,o8 # some of them
```

`perf:bim` writes `results.json` and `report.md` under `.perf-results/`. The
report lists every row with its budget, verdict and the counts that prove the
work was incremental.

Close other heavy programs first; a busy machine is marked "noisy" in the
report. A 250k run needs about 4 GB of free memory.

## Absolute and relative budgets

A timing means something only on known hardware.

- **Absolute** (the default): every timing must meet its budget, at
  `ci.budgetFactor` times the budget in CI. Use this on the reference laptop
  class or a calibrated runner.
- **Relative** (`MUTINYBIM_PERF_BUDGETS=relative`): for shared runners whose
  speed varies. Invariants, sizes (MB, KB), counts and same-run ratios ("the
  incremental path is faster than the full one") still block. Timings are
  measured and reported against their budgets, and do not block.

## The 3D rows: a person measures these

Four rows have `"scope": "browser"` and `"measuredInCi": false`:

| row | p50 | p95 | unit |
| --- | --- | --- | --- |
| `3d.synthetic.load` | 300 | 600 | ms |
| `3d.edit.redraw` | 16 | 33 | ms |
| `3d.frame.weak` | 33.3 | 50 | frameMs |
| `part.mesh.instanced.draw` | 8 | 16 | frameMs |

The gate reports them as **NOT-MEASURED**: nobody measured this. That is a
different verdict from `NOT-RUN` (a suite this run did not select, or one that
failed to load) and from `PENDING` (a budget whose suite is not written yet), and
the report lists them together with their budgets under *Not measured by this
run*. The difference matters: a render change does not come back "not applicable",
it comes back **unmeasured**.

Why no runner can measure them, as things stand:

- The Perf gate job runs on `ubuntu-latest` or on the machine `PERF_RUNNER` names;
  neither step installs a browser, and this checkout has no Playwright, Puppeteer
  or headless-GL dependency, so nothing here has a WebGL context to draw into.
- `scripts/perf/mutinybim/run.ts` already has the browser suite's plumbing
  (`--suites=browser`): it would hand a suite the reference export's `perf-frags`
  and the zone slice `synthetic.ts` writes, and average `--browser-runs` runs.
  `browser-3d.ts`, which would consume them, has never existed in this
  repository's history, and its input (`.fixtures-cache/reference/perf-frags`) is
  private client data that CI does not have.
- The method itself was only ever written down, in `referenceHardware.weaker`: "4x
  Chrome CPU throttling at 1366x768, devicePixelRatio 1". That is the recipe for a
  suite nobody built.

So these four budgets are **aspirational**: they come from judgement, not from a run
of this gate, and a green gate says nothing about them. `3d.edit.redraw` sat on
`knownBudgetFailures["250k"]` — the list of rows "over budget at the last
calibrated baseline" — until Nov 13, 2026, with no baseline behind it, because no
run has ever produced a number for it. That entry is gone.

They are still budgets. A change that renders must be measured by hand before it
merges, and a row over its number blocks the pull request exactly as a CI row does
— by review, not by the report.

### Measuring them by hand

On the machine the row names, with nothing else heavy running (the gate marks a run
"noisy" for load or memory; a hand measurement is no different).

1. **The machine.** `referenceHardware.reference` in the budget file: a current
   Apple-silicon laptop (M-series Pro/Max, 16 GB or more), plugged in. For
   `3d.frame.weak` use `referenceHardware.weaker` instead — a four-year-old
   integrated-GPU laptop. The 4x-throttled approximation in the file is a *lower
   bound*, not a substitute: throttling the CPU does not slow the GPU, and that row
   is about the GPU.
2. **The browser.** Chrome with hardware WebGL: `chrome://gpu` must say
   `WebGL2: Hardware accelerated`. A machine that fell back to software rendering
   (SwiftShader) produces numbers nobody else can compare with.
3. **The scene.** A 250,000-element model in the editor, the **3D** view, the camera
   framed on one authored zone: the author's zone, the last zone of the top floor
   (`L<floors>-Z<zonesPerFloor>`), the same target `synthetic.ts` edits. Read the
   baseline off the readout in the 3D view's bottom-right corner (`N fps · M draws ·
   Kk tris`) and put it in the pull request: a frame time is only comparable with
   another taken on the same scene, and the next person needs to know what was drawn.
4. **`3d.synthetic.load`** (300 / 600 ms). DevTools → Performance → record → switch
   the 3D view to that zone (the change that first draws it) → stop. Read the span
   from the input event to the first frame in which the zone is drawn. Five
   recordings: the median is p50 and the slowest is p95.
5. **`3d.edit.redraw`** (16 / 33 ms). Record, then drag one part in that zone across
   the view for about three seconds. Read the **Frames** track: the frames that
   redrew the moved geometry. 16 ms is one frame at 60 Hz, so an over-budget redraw
   shows up as dropped frames during the drag. Median and 95th percentile.
6. **`3d.frame.weak`** (33.3 / 50 ms). Same scene, same camera, no interaction, on
   the weaker laptop: record ten seconds and take the median and 95th percentile
   frame duration. The on-screen fps readout is the same number — 33.3 ms is 30 fps.
7. **`part.mesh.instanced.draw`** (8 / 16 ms; 16 / 33 ms at the 1M tier). Same scene
   and camera: ten seconds with the placed modeled parts drawn, ten with them hidden
   (`viewer.setGroupVisible(group, false)` for the groups they draw in — the
   equipment and furnishing batches; the editor has no toggle for this yet). The
   difference in median frame time is what the instanced part batches cost per
   frame. If you cannot produce both scenes, say the row is unmeasured rather than
   measuring something else.
8. **Say what you measured.** The numbers go in the pull request beside their
   budgets, with the scene's draws and triangles. Over budget means the change is
   not ready: fix the hot path, or say why it cannot be fixed and let a maintainer
   decide. The budget number is not raised either way.

Nothing stores those numbers: there is no CI run behind them to keep a baseline
honest, so the pull request that measured them is the record.

## In CI

The **Perf gate** workflow (`.github/workflows/perf-gate.yml`) runs on every
pull request and push to `main`. On a pull request that touches none of
`packages/bim-kernel`, `packages/bim-sync`, `packages/bim-viewer*`,
`packages/bim-editor`, `services/bim-authority` or the gate itself, it reports
success without measuring, so it can be a required check.

- With the repository variable `PERF_RUNNER` set to a calibrated runner label,
  pushes and pull requests from this repository's branches run there with
  absolute budgets.
- Without it, and always for pull requests from forks, the gate runs on
  `ubuntu-latest` with relative budgets.

The run summary shows the gate's full report; the results are uploaded as the
`perf-gate-results` artifact.

What the gate still cannot tell you is a frame: the four 3D rows above are
`NOT-MEASURED` in every run, so a pull request that changes rendering comes back
with those four rows unmeasured. The workflow says so in its run summary, and the
report lists them under *Not measured by this run*.
