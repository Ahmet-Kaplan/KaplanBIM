# Spaces and rooms

## What it owns

| Where | What |
|---|---|
| `packages/bim-kernel/src/types.ts:326-356` | `Room` — number, name, outline, `areaSqM` (`:331`), `labelSeed` (`:337`), `ceilingHeightMm` (`:342`), `continuesId` (`:354`) |
| `packages/bim-kernel/src/spaces/types.ts` | `Space` (`:91-121`), `Zone`, `DrawingUnderlay`, `SpaceSeparator`; `SpaceBounds` (`:31-41`), including the `bounded` shape that carries a person's `seed`; `BoundedOpen` (`:43-54`) |
| `packages/bim-kernel/src/spaces/space-index.ts` | `spaceAt` (`:422`) — which space a point is in, a plan grid per level, carried by revision |
| `packages/bim-kernel/src/spaces/boundaries/`, `detect/` | What bounds a space (the face walk, the boundary index, `room-at.ts`) and the proposals: `detectRoomsFromWalls` (`detect/from-walls.ts:27`), `detectRoomOutlines` from linework, rated zones. **Nothing is stored** (`from-walls.ts:16`, `rooms.ts:76`) |
| `packages/bim-geometry/src/polygon-label.ts` | `polygonLabel` (`:79`) — the farthest-interior point, `LABEL_PRECISION` (`:31`), `MAX_LABEL_CELLS` (`:37-42`) |
| `packages/bim-kernel/src/placement/label-seed.ts`, `packages/bim-kernel/src/annotation/annotations.ts:260-262` | `labelSeedOf` (`:25`), the kernel's own dependency-free copy of the same answer, and the room tag that reads `labelSeed`, else the centroid |
| `packages/bim-kernel/src/import/` | The room rule (`rules.ts:163-187`), `read-products.ts:323` (`LongName` read off the spatial product), `room-identity.ts` (`matchRooms` `:165`, thresholds `:76`, `:105`), `room-changes.ts` (`roomChanges` `:76`), and `plan.ts:329-394` where a pairing is stamped |

## The contract

1. **Two words, two records, and a reader must not merge them.** `room` is a
   kernel element kind ([model](model.md): a row in
   `registry/element-kinds.ts:11`) whose class is the Architecture add-on's
   `arch.room` (`bim-pack-architecture/src/classes.ts:16`); `space` and `zone`
   are kernel kinds with the kernel's own `gen.space` and `gen.zone` classes
   (`registry/builtin.ts:71-72`). Turkish keeps them apart too: space is
   **mekan**, room is **oda** (`docs/i18n/glossary.md:89-90`).
   A room is the architect's — a floor outline, a number, a name, an area; a
   space is the engineer's — one room, part of one, or a whole apartment, with
   use, occupants and the loads anchored to it (`spaces/types.ts:9-16`). A room
   becomes a space through `make_spaces_from_rooms` (`space-commands.ts:528`),
   never by being one.
2. **A room is stored, not derived from walls.** The detectors only propose
   (`detect/from-walls.ts:1-20`): nothing is written until a person accepts a
   proposal, and what that makes is a **space** with `bounds.kind: "bounded"`
   — outline, boundary and seed stored, `BoundedOpen` remembering where it
   opened when an edit left the seed in no closed region
   (`spaces/types.ts:43-54`). A room arrives from a file or a drawing and stays
   what it says it is.
3. **A room's area and its outline move together.** `areaSqM` is stored; the
   takeoff ([qto](qto.md)) reads the stated area before measuring the outline
   (`qto/measure.ts:198-201`), and a placement edit rewrites both from the same
   polygon (`elements/commands.ts:354-359`). Volume is area ×
   `ceilingHeightMm`, and only when the room states a height (`:202-205`).
4. **The label seed is where the tag goes.** `polygonLabel` gives the point
   inside a region farthest from any boundary — inside the region always, a
   hole kept clear of, clearance never below the centroid's, and bounded three
   ways (tolerance, depth, `MAX_LABEL_CELLS`) so no input hangs it
   (`polygon-label.ts:44-77`). It is polylabel, and [geometry](geometry.md)
   owns it. Here it matters because the seed is *stored on the room* and read
   twice: to place the tag away from walls (`annotations.ts:260-262`) and as a
   room's position when the next import asks which room this one is.
5. **What an `IfcSpace` carries after import, and what it does not** ([ifc](ifc.md)).
   `Name` → `number` (falling back to the GlobalId), `LongName` → `name`
   (falling back to `Name`, then "Room"), the body's floor outline → `outline`,
   the outline's area → `areaSqM` at two decimals, the storey → a level and the
   record's partition, the space solid's **own** floor-to-ceiling height →
   `ceilingHeightMm` (`import/rules.ts:163-187`; `read-products.ts:323`,
   `import/types.ts:153`). The **seed is not in the file**: it is computed here
   (`rules.ts:174`) from the outer ring only. The file carries no `continuesId`
   either; that is written by the matching pass, or not at all.
6. **Revision identity is a pairing, not an edit.** `matchRooms` pairs one
   earlier import's rooms with this one's, one to one, strongest claim first:
   the file's number, then its label, where the key names exactly one room on
   each side; then the seed within `SEED_MATCH_MM` (400 mm, `:76`); then the
   outline share/cover fit above `FIT_MATCH_SCORE` (0.8, `:105`); each on one
   storey (`:148`). A room nothing older resembles is **added**, not matched.
   The pairing is written on the *new* record as `continuesId` (`plan.ts:373`),
   the earlier record is never rewritten, and `roomChanges` says what moved —
   area with its delta, number, label, height — as data a schedule or a script
   reads (`room-changes.ts:76`, `:114`). A first import reports
   `comparedAgainst: 0`.
7. **What the pass refuses.** It does not rename, merge or delete a room
   (`room-identity.ts:38-42`): a person's name for a room is theirs, so a
   disagreement is reported, not applied. The `arch.room` fields agree — `name`
   and `number` are `locked("Rename the room in the model.")`
   (`bim-pack-architecture/src/fields.ts:105-106`), so no file writes them.
8. **`continuesId` is evidence, not an instruction.** It is written for the
   next comparison and, in this release, **nothing in the kernel reads it back**
   — grep finds it only in `types.ts` and the import. Unverified whether a
   viewer, schedule or script consumes it. The delta a person reads today is
   the report's change set, which is recomputed from two room lists.

## How it goes wrong

- **A room matched to the nearest rather than the right one.** The design
  answer is: no fallback. A candidate must clear 400 mm of seed or 0.8 of fit,
  and a room under a new number in the same place stays unmatched by design
  (half a room scores 0.667). *Tell:* a pairing whose `reason` is `fit` with a
  score barely over 0.8, or a revision where every room reads as added and
  removed — that is a two-model comparison, or a changed `storeyOf`.
- **A room silently renamed.** The one act that makes a quantity history
  untrustworthy. The pass reports the difference and writes nothing; the fields
  are locked. *Tell:* a code path that copies `longName` onto a record's `name`,
  or a "sync names" cleanup.
- **A seed that falls inside a hole because the algorithm ignored holes.** Both
  implementations take holes (`polygon-label.ts:80-82`,
  `label-seed.ts:25-28`) and both are tested with a column through a room
  (`polygon-label.test.ts:75`, `label-seed.test.ts:51`). The room import passes
  **only the outer ring** — `verticalPrism` returns `outline`, `bottom`, `top`
  and no holes (`import/shape.ts:46-48`) — so a void the file states is not kept
  out of an imported room's seed. *Tell:* a room tag drawn on a column.
- **A stale seed.** Nothing re-derives `labelSeed` when a room's outline
  changes: the placement path rewrites `outline` and `areaSqM` only
  (`elements/commands.ts:354-359`). The tag then sits where the room used to be,
  and the next import's seed stage compares a point that is no longer inside the
  room it belongs to.
- **Two copies of the polylabel drifting.** The kernel keeps its own
  `labelSeedOf` because it imports `bim-geometry` for types only
  (`label-seed.ts:1-24`), with a different tolerance (10 mm vs 1 mm) and a
  different search. Their agreement is asserted in prose, in a comment, and
  **no test compares the two** — `polygon-label.test.ts` tests one, the
  label-seed test the other. Review-only.
- **A derived space treated as authored.** A `bounded` space stores the outline
  and boundary it was found from; reading that outline as something a person
  drew, or editing it, breaks the one thing that would keep it in step with the
  walls. The derived-ness is in `bounds.kind`, not in a flag. *Tell:* a space
  whose `boundary` no longer matches the walls it names.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-kernel/__tests__/room-identity.test.ts` | A first import pairing nothing and stamping nothing; a wall moved with its area delta reported; a person's name kept with the disagreement reported; a new room added rather than paired with the nearest; two rooms sharing a label settled by seed then outline; rooms on different storeys never pairing; and both thresholds just inside and just outside (400 mm, 0.8, and a division under a new number) | a stale `labelSeed` on a re-placed room; a `storeyOf` a caller passes that disagrees between revisions |
| `packages/bim-geometry/__tests__/polygon-label.test.ts`, `packages/bim-kernel/__tests__/label-seed.test.ts` | The square, the L (not the centroid's notch), a hole through the room, a 10 km site offset, clearance ≥ the centroid's and three termination cases; and `labelSeedOf`'s own: degenerate outlines, determinism, a room keeping its seed | agreement between the two — nothing compares them |
| `packages/bim-kernel/__tests__/a13b-detect-from-walls.test.ts` | A 3 × 3 grid proposing its 9 rooms and nothing else; a room that already has a space not proposed again; accepting a proposal by its seed making that room | a proposal accepted and then edited by hand |
| `packages/bim-kernel/__tests__/spaces-kernel.test.ts`, `a13b-old-spaces-identical.test.ts`, `r7-space-index-carry.test.ts` | A space's record; a space made from rooms keeping what it was made of; the space index answering as a fresh build after an edit | the two words being confused in a UI string |
| **No guard** | A room renamed from a file; a seed left stale by an outline edit; an imported room whose seed sits in an unread void. **Review-only.** | |
