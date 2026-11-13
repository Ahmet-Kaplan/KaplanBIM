# Placement

## What it owns

| Where | What |
|---|---|
| `packages/bim-kernel/src/placement/geometric.ts` | The four placement shapes — `point`, `line`, `path`, `area` — and the surface binding a line may carry (`:21`, `:39`, `:66-79`, `:89`, `:103`) |
| `packages/bim-kernel/src/placement/geometric-math.ts` | Measuring one: path pieces and length, a station and its direction, the station of a point, profile elevation, plan and surface area, a line's centreline (`:46`, `:82`, `:119`, `:142`, `:196`, `:215`) |
| `packages/bim-kernel/src/placement/line-face.ts` | Keeping the flat `start`/`end` and the stored placement describing the same line (`:14-24`, `:59-70`) |
| `packages/bim-kernel/src/placement/top-tie.ts` | A top tied to a level: `tiedHeightMm`, `MIN_TIED_HEIGHT_MM` (`:35`, `:44`) |
| `packages/bim-kernel/src/placement/surface-bind.ts` | `resolveBoundBody`: the body a line gets from the surfaces above and under it, or a sentence saying why not (`:46`, `:140`) |
| `packages/bim-kernel/src/placement/surface-follow.ts` | The edit hook that re-derives bound bodies and refuses the edit that broke one (`:112-124`) |
| `packages/bim-kernel/src/placement/types.ts`, `planned-index.ts`, `label-seed.ts` | Planned parts (`placementOf`, `isPlaced`), the planned index, the label seed (`spaces` owns the seed's use) |
| `packages/bim-kernel/src/elements/commands.ts` | **The gate**: `PLACEMENT_KINDS` (`:191-199`) and `checkPlacement` (`:371-389`), called from `set_element_placement` (`:586`) |
| `packages/bim-kernel/src/elements/create.ts` | `checkSurfaceBindings` (`:74-87`), the shared half of the gate; creation's own copy of the rest (`:382`) |
| `packages/bim-editor/src/editor/planned/place-surface.ts`, `place-planned-live.ts` | Whether *this view* can take the click at all (`placeSurfaceFor` `:29-45`) |

`placement/index.ts:1-5` exports the shapes, their measures and the planned index. The
bindings, the tie and the hook are imported by path, so a reader looking only at the
index will not find the part that refuses.

## The contract

1. **A placement is a shape in the model frame, not a position.** Four kinds cover every
   discipline: a point with a rotation, a line with a justification at each end, a
   stationed polyline with arcs and an optional profile, an outline with holes and a span
   direction (`geometric.ts:3-19`). Millimetres, degrees counter-clockwise from east
   (`:35-36`), heights as offsets above the placement's level. A shape this build does
   not know is kept and not drawn (`geometricPlacementKind`, `:122`).
2. **There is no `canPlaceOnFloor`-style predicate here.** Nothing answers "may this go
   there" as a value: the gate is `checkPlacement`, which returns nothing and refuses
   (`elements/commands.ts:371`), so the answer only exists as the refusal of the command
   that would have done it. The nearest thing to a query is `resolveBoundBody`, which
   returns the body or the reason (`surface-bind.ts:140`). The Pascal concept of a
   placement predicate a tool calls first has **no counterpart**.
3. **A refusal is a code and a sentence, and both name what to do.** `CommandError` is
   `{ code, message, elementIds }` (`command-core.ts:40-45`); placement refusals use
   `unsupported_geometry`, `element_not_found` and `invalid_value` and carry the element id
   (`elements/commands.ts:374-389`). The sentences are specific and actionable: "There is
   nothing for Wall w1 to stand on at 3.2 ft along it: the top of the floor under it wasn't
   found there. Draw the floor first, or stand it on its level"
   (`surface-bind.ts:181-191`).
4. **What a person actually reads is chosen elsewhere, and is often the generic
   sentence.** `refusalWords` (`operator-messages.ts:119-123`) keeps the kernel's sentence
   for six codes only; for `invalid_value` and `unsupported_geometry` it substitutes the
   editor's generic sentence, so in English the wall above reads "That value isn't valid.
   Check it and try again." In Turkish it tries a prose template first, and the catalogue
   has templates for some of these sentences and a *better* one for others
   (`docs/i18n/prose-templates.json:13676`: "… would start and end at the same point; click
   two different points"). See [i18n](i18n.md).
5. **A placement query never moves anything.** `checkPlacement`, `checkSurfaceBindings`,
   `resolveBoundBody` and `tiedHeightMm` read and return; only the commands write, and the
   one hook that mutates (`followSurfaceEdits`, `surface-follow.ts:112`) runs *inside* an
   edit, as part of it. `advancePlannedIndex` writes a `WeakMap` memo
   (`planned-index.ts:22`, `:48`), not the model.
6. **The level is part of the answer.** A placement whose `levelId` is not a level in this
   model refuses by name (`elements/commands.ts:377`), and so does a top level that is gone
   (`:378`). Heights are offsets above that level, so the level is what makes them
   absolute — [vertical](vertical.md) owns the level's own rules.
7. **A kind takes only some shapes.** `PLACEMENT_KINDS` says which (`:191-199`); an opening
   takes none, because it sits in its wall (`:374`). Creation enforces the same thing by
   giving each kind its own command schema, so `PLACEMENT_KINDS` is consulted only on the
   re-place path.
8. **A bound body is derived, never stored as intent.** A wall's top bound to "the
   structure above" is a `SurfaceBinding` on its placement; the height, base offsets and
   profile are recomputed from the surfaces in force, sampled every 25 mm along the line
   where the face changes (`surface-bind.ts:25-29`), and written back as a derived field.
9. **The editor answers a different question.** `placeSurfaceNow` answers whether the view
   the person is on can take a click — a sheet with no plan opened, a schedule, a printed
   drawing without a mapping — and never asks about the level, the element or the surface
   (`place-planned-live.ts:34-50`). It is a sentence either way, and it is shown as a hint
   (`BuildingModelSurface.tsx:1804-1807`).

## How it goes wrong

- **A check that passes and the command then refuses.** The gate checks the *shape* of a
  binding, not whether a face is actually over the line: `checkSurfaceBindings` asks that
  the named element's kind offers a face (`create.ts:76-85`), while `resolveBoundBody` asks
  the face where the wall is (`surface-bind.ts:169-176`) and refuses at the edit hook
  (`surface-follow.ts:124`). *Tell:* an element created without complaint that an edit a
  few seconds later refuses, naming it.
- **A tolerance that exists twice.** The minimum body a bound surface may give is
  `MIN_BOUND_HEIGHT_MM` (`surface-bind.ts:29`) and the minimum a level tie may give is
  `MIN_TIED_HEIGHT_MM` (`top-tie.ts:35`). Both are 1 mm today and nothing says they must
  agree. The samples are found to 25 mm (`SURFACE_STEP_MM`, `surface-bind.ts:25`), so a
  step under 25 mm is a body the check cannot see.
- **The check that samples and the check that does not.** `withTopOrHeight` validates a tie
  from the two levels and the placement's end offsets (`elements/commands.ts:401-419`,
  `top-tie.ts:44-55`); it never looks along the line. A top surface that dips below the
  base mid-span passes the command and is refused later by the hook, when somebody edits
  the slab.
- **Two wordings for one rule.** A zero-length line is refused by `create.ts:382` ("… would
  start and end at the same point; click two different points") and by
  `elements/commands.ts:380` (the same, without the advice). Two files, two sentences, one
  rule — the prose catalogue holds both (`prose-templates.json:13662`, `:13676`).
- **A refusal that says only "invalid".** The kernel's placement sentences are the best
  writing in the subsystem and the screen usually does not show them (contract 4). A
  wrong shape for a column reads "The model can't build that shape yet. Change the route
  and try again." — advice about a route, for a column.
- **A body left pointing at a surface that is gone.** The hook refuses a body the edit
  touched directly, but for a body it only *reached* — the slab removed from over a wall —
  it keeps the old body silently (`surface-follow.ts:129-135`). No refusal, no report to
  the person.
- **A preview that answers with a boolean and no reason.** `placeSurface.canPlace` is read
  as a gate, and `reason` is nullable (`place-surface.ts:9-16`): a caller that checks the
  flag without the reason has a refusal with nothing to say.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-kernel/__tests__/c5e-element-commands.test.ts:166-167` | a column re-placed as an area, and a point placed on a level that does not exist | the other rows of `PLACEMENT_KINDS`, which no test walks |
| `packages/bim-kernel/__tests__/arch-wall-surface-bind.test.ts` | a bound body following a thicker floor, a raised ceiling, a pitched roof; `resolveBoundBody` naming the faces it follows | a body that stops resolving between two edits |
| `packages/bim-kernel/__tests__/arch-wall-top-tie.test.ts` | a wall's top tied to a level: its height follows both levels, a typed height stays, untie and re-tie | the surface bindings, which have no tie to a level |
| `packages/bim-editor/__tests__/i18n-refusal-sentences.test.ts` | a kernel sentence reaching a Turkish screen untemplated and untranslated | a sentence with no template, which falls back to the generic one — the case in contract 4 |
| nothing | — | `placeSurfaceNow` and `placeSurfaceFor` have no test at all; of `resolveBoundBody`'s refusals only the "no structure over it" branch is asserted (`arch-wall-surface-bind.test.ts:61`). The editor's view rule is review-only |
