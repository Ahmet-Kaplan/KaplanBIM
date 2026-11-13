# Vertical: levels, tops, slabs and ceilings

## What it owns

| Where | What |
|---|---|
| `packages/bim-kernel/src/types.ts` | `Level` (`:446-457`, `elevationMm` at `:450`), `Wall` (`:254-295`: `height` `:266`, `offsetFromReferenceLineMm` `:273`, derived `bodyProfile` `:290-295`), `Slab` (`:305-309`) |
| `packages/bim-kernel/src/surfaces/` | `faces.ts` — the face rows (`SURFACE_FACE_POINT`, `:88`): what a kind's top and underside are at a plan point (slab `:55-67`, ceiling `:69-79`); `surfaces-at.ts` — `surfacesAt` (`:302`), the floor, ceiling, roof and structure above a point |
| `packages/bim-kernel/src/placement/` | How a body's height is worked out: `top-tie.ts` (a top tied to a level — `ROWS` `:24`, `MIN_TIED_HEIGHT_MM` `:35`, `tiedHeightMm` `:48`), `surface-bind.ts` (a body bound to faces — `SURFACE_STEP_MM` `:25`, `MIN_BOUND_HEIGHT_MM` `:29`, `resolveBoundBody` `:140`) and `surface-follow.ts`, the edit hook that re-derives every bound body a change reaches (`:14-27`) |
| `packages/bim-kernel/src/ceilings/` | `types.ts` (`Ceiling` `:30-48`), `read.ts` (`ceilingHeightAtPoint` `:51`, `ceilingCovers` `:70`), `ceiling-index.ts` (`ceilingsAt` `:184`), `structure.ts` (`ceilingStructureProblem` `:47`), `commands.ts` (`heightMm` `:29`, warnings `:133-146`), `feature.ts` (the gate and schema step) |
| `packages/bim-kernel/src/import/rules.ts` | What a file's heights become: wall `:90`, slab `:141`, ceiling `:199` |

## The contract

1. **An elevation lives on a level and nowhere else.** `Level.elevationMm` is
   millimetres above project zero (`types.ts:449-450`); every other height in
   the kernel is *above a level*. A slab has no elevation field at all: its
   level comes from its placement or its partition (`faces.ts:46-53`).
2. **A wall's body has three possible sources, and the order matters.** A typed
   `height` above its base (its level's floor plus `startOffsetMm`); a top tied
   to a level (`topLevelId` + `topOffsetMm`, `tiedHeightMm` `top-tie.ts:48-55`);
   or a top and/or base bound to a surface (`topSurface`/`baseSurface`), which is
   *derived on read and written back* (`resolveBoundBody` `surface-bind.ts:140`).
   The third wins: a wall whose top follows a surface refuses a typed height
   beside it (`elements/commands.ts:405-406`).
3. **A bound body is sampled, not assumed flat.** The faces in force are read
   along the line and a stretch whose ends read different faces is halved until
   the change is within `SURFACE_STEP_MM` (`surface-bind.ts:25`, `:201-215`);
   the stations are kept as `bodyProfile` and `height` is the tallest stretch
   (`:235-247`). So a wall under a pitched roof has a sloped top and one
   `height` that is its maximum.
4. **A slab's top is the walking surface, and its thickness hangs below.**
   `faceAt` returns `{ top: level.elevationMm, underside: level.elevationMm -
   thickness }` (`faces.ts:62-66`). There is no "slab top" field to disagree
   with the level: a slab filed under Level 2 is at Level 2's floor by
   definition, and what is measured off it — the top face's area, the volume ×
   thickness — is [qto](qto.md)'s.
5. **A ceiling is a plane above a level.** `levelId` + `heightMm` above it, an
   outline, optional holes, a form and optionally a slope
   (`ceilings/types.ts:30-48`). It is found by the plan grid from below:
   `ceilingsAt` answers every ceiling on the level covering the point, lowest
   first, so a cloud under a ceiling is what a person sees
   (`ceiling-index.ts:184-200`); `ceilingCovers` is inside the outline and
   outside every hole (`read.ts:70-74`). A ceiling may name the space it is
   hosted in (`spaceId`), and that is a label, not a binding.
6. **Statements beat measurements, and a disagreement is said out loud.** A
   drawn ceiling beats a space's stated `ceilingHeightMm`, which beats a linked
   model's covering; every one of those orders carries a note when the two
   numbers differ by more than 25 mm (`surfaces-at.ts:96-98`, `:372-377`).
7. **The clamps are refusals in words, and there are only two of them.** A body
   may not be given a height under 1 mm: `MIN_TIED_HEIGHT_MM` refuses a top
   level at or below the base (`create.ts:330`), refuses the same move when it
   comes from moving the *level* (`commands/levels.ts:304-311`) or from an edit
   (`elements/commands.ts:416-419`); `MIN_BOUND_HEIGHT_MM` refuses a bound
   body whose top would be at or under its base, and refuses a bound surface
   that isn't there at all (`surface-bind.ts:169-191`). A ceiling's `heightMm`
   must be positive (`commands.ts:29`).
8. **What a clamp is not.** Nothing refuses a wall taller than its storey: with
   no tie and no binding, `height` is simply a number (`create.ts:186,393` — the
   default is 3048 mm). Nothing refuses a ceiling above the structure over it
   either: `ceilingStructureProblem` computes the overshoot against the first of
   {`surfacesAt` structure, the space's `slabToSlabMm`, the next level up} and
   returns a *warning sentence* (`structure.ts:47-70`, tolerance `:20`),
   appended to the command's summary (`commands.ts:133-146`). It never fails the
   edit, because the structure may be what is wrong.
9. **A file gives heights and the import writes a typed height, not a tie** ([ifc](ifc.md)).
   `height = prism.top - prism.bottom` for a wall (`rules.ts:103`),
   `thickness = top - bottom` for a slab (`:150`), and a ceiling's `heightMm` is
   `prism.bottom - level.elevationMm` — its **underside**, not its top (`:216`).
   `base()` writes no `placement` (`rules.ts:69-84`), so an imported body has no
   `topLevelId` and no `topSurface`: its base is its level's floor and its
   height is the file's number (`plan.ts:122-128` files it under the highest
   level at or below its solid).

## How it goes wrong

- **A height that is implicit rather than derived from a level.** A wall drawn
  with no tie and no binding is 3048 mm tall (`create.ts:186`), and a level
  moved in either direction leaves it exactly that tall. It looks tied in plan
  and is not. *Tell:* a wall with no `placement.topLevelId`,
  `topSurface` or `baseSurface` whose `height` is not a round number a person
  would have typed.
- **A "derived" height that the file actually set.** An imported wall carries
  `height` measured off its body and no tie (`rules.ts:103`), so it is a typed
  wall wearing the look of a modelled one: moving Level 2 up 200 mm does not
  lengthen it, and nothing in the report says so. The same wall drawn in the
  editor with its top tied would follow. *Tell:* a storey whose walls all end
  below the slab above by the same residue.
- **A clamp applied in one direction only.** The top-above-base rule lives in
  four places (`create.ts:330`, `commands/levels.ts:304-311`,
  `elements/commands.ts:416-419`, `surface-bind.ts:191`); any other path that
  writes `height` directly — a script, a pack's import rule — bypasses all four.
- **A body whose surface went away keeps its last height.** `surface-follow`
  says so in as many words (`:14-27`): a bound wall whose ceiling is deleted is
  not refused and not re-derived, it stands at the height it last had — a stale
  number that looks exactly like a typed one.
- **A ceiling bound to something a wall edit moved.** For us the bound surface
  is a *level*, a *slab* or a *space's stated height* — never a wall. A wall
  edited under a ceiling therefore does not move it, which is correct; the real
  failure is the reverse: the ceiling is bound to the level while the room's
  `ceilingHeightMm` is a second, independent statement, and a reader that does
  not go through `surfacesAt` sees the other number with no note.
- **A ceiling below its floor, by way of a slope.** `heightMm` is positive
  (`commands.ts:29`) but a slope's `pitch` may be up to 10 (`:35`), and
  `ceilingHeightAtPoint` adds the rise from the reference point
  (`read.ts:44-54`). A steep plane on a small height goes negative at its low
  corner and nothing refuses it.
- **A slab whose top and a room's floor disagree.** The slab's top *is* its
  level's floor (`faces.ts:62-66`) and it has no other elevation, so the two can
  only disagree by being filed under different levels — an imported slab whose
  body top sat above the level it was filed under lands at that level's floor,
  with only its thickness taken from the file (`rules.ts:150`). The slab moves
  down; nothing reports it.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-kernel/__tests__/arch-wall-surface-bind.test.ts` | A wall run to the structure above stopping at Level 2 less the slab's thickness, and following a thickness change and a level move; a sloped top under a pitched roof; a base on a raised floor; a wall with nothing over it refused in words; a server that stores no bindings receiving the height it works out to | a *typed* wall that never claimed to follow anything |
| `packages/bim-kernel/__tests__/arch-wall-top-tie.test.ts` | A tied wall stretching with either level; a move that would put its top under its base refused in plain words; a top level that isn't above refused; a height beside a tie refused | the same wall imported, which has no tie |
| `packages/bim-kernel/__tests__/c5s-surfaces-at.test.ts`, `r5z-surfaces-at.test.ts` | What is under and over a point: our slabs, linked slabs and roofs, a space's stated height, and the notes when two disagree | a reader that asks a rule instead of `surfacesAt` |
| `packages/bim-kernel/__tests__/c7c-ceiling-kind.test.ts` | A ceiling's height at a point on a slope; a cloud under a ceiling being what is seen from below; a hole leaving nothing overhead; refusals for a slope on a flat form, a hole outside, a space on another level; and the sentence naming how far a ceiling rises past the structure over it (`:123-127`) | the ceiling is *never refused* for that overshoot — the test pins the warning, not a clamp |
| `packages/bim-kernel/__tests__/c7c-surfaces-at-prefers-ceiling.test.ts`, `c7c-ceiling-height-perf.test.ts`, `b2-ceiling-plan-crop.test.ts`, `g7-ceiling-drop-reopens.test.ts` | A drawn ceiling beating a space's stated height; the index's cost; a ceiling plan's crop; a ceiling height reaching the requirements that read it | a reader that asks a rule instead of `surfacesAt` |
| **No guard** | A wall taller than its storey with no tie; a slab filed under the wrong level; a stale height on a wall whose surface was deleted; a ceiling whose slope takes it under its floor. **Review-only.** | |
