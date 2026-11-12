# Geometry

## What it owns

| Where | What |
|---|---|
| `packages/bim-geometry/src/program.ts` | The vocabulary a solid is described in: `Loop` (`:22`), `Frame` (`:14`), `SolidStep` (`:84`), `SolidOp` (`:75`) = extrude, revolve, loft or mesh, `BooleanOperation` (`:77`) = `join`/`cut`/`intersect`, `TriangleMesh`, `SolidEngine` |
| `packages/bim-geometry/src/manifold-engine.ts` | The one implementation of `SolidEngine`, on `manifold-3d` (Apache-2.0). Tessellation and booleans live here and nowhere else |
| `packages/bim-geometry/src/import-body.ts` | Bodies from other programs — glTF/`.glb` and OBJ, triangles only, capped (`IMPORT_LIMITS`, `:13`) |
| `packages/bim-geometry/src/polygon-measure.ts` | Area, point containment, clearance from a boundary, overlap of two regions. The floor the two algorithms below stand on |
| `packages/bim-geometry/src/polygon-label.ts` | `polygonLabel` — the farthest-interior point of a region: where a room tag goes |
| `packages/bim-geometry/src/polygon-containment.ts` | `enclosingFits` / `bestEnclosingFace` — which face a polygon best sits in, scored by share and cover |
| `packages/bim-geometry/src/cache.ts` | `MeshCache`: one mesh per content key, LRU, so a thousand placed parts of one size evaluate the engine once |

Layer 1: `bim-geometry` imports nothing above it. The rule is enforced, not
asserted — `bim-kernel/src/__tests__/import-layers.test.ts:180-185` fails when
`bim-units`, `bim-formula` or `bim-geometry` imports any other `bim-*`
package. Its only dependency is `manifold-3d`.

## The contract

1. **A solid is a program, not a mesh.** A `SolidProgram` is plain data with
   every value already a number, so it can be hashed, cached, sent to a worker
   and evaluated identically anywhere (`program.ts:1-9`). A `SolidStep` carries
   an `id` echoed in every error, so a refusal names the feature that failed
   ("Loft section 2 encloses no area", `manifold-engine.ts:141`).
2. **Profiles combine even-odd.** A loop inside another loop is a hole
   (`program.ts:21`; `manifold-engine.ts:53` fills the cross-section even-odd).
   An empty cross-section is refused rather than extruded as nothing (`:54`).
3. **A solid that cannot be built is refused in words, never approximated.**
   Extrusion height must be positive (`:60`), a revolve sweeps 0°–360° and its
   profile may not cross the axis (`:74,83`), a loft needs two sections, distinct
   places and at most `MAX_LOFT_RING = 1024` corners between them (`:105,210-224`).
   The first feature must add material, because there is nothing yet to cut
   (`:393`); an imported open mesh may only add (`:399`).
4. **`polygonLabel` promises an inside point with clearance, within a stated
   tolerance.** It is polylabel: a best-first branch and bound over the
   bounding box (`polygon-label.ts:77`). It is **bounded three ways**, so no
   input hangs it: a cell is split only while its upper bound (clearance at its
   centre plus the half-diagonal) can still beat the best found by more than
   `precision`; each split halves that half-diagonal, so depth is at most
   `log2(start half-diagonal / precision)`; and at most `MAX_LABEL_CELLS =
   100_000` cells are expanded (`:38,95`), after which the best point so far is
   returned (`:50-60`). Degenerate input is answered, not thrown: a
   ring of fewer than three points or on one line returns its first point; a
   zero, negative or non-finite `precision` falls back to `LABEL_PRECISION`; a
   **self-intersecting ring is unsupported** — the even-odd reading of its
   crossings is what is searched, which terminates but is not the shape that
   was drawn (`:62-68`).
5. **Containment is scored two ways, never one.** `share` is how much of the
   subject the candidate holds; `cover` is how much of the candidate the
   subject fills; `score` is their harmonic mean, so it is near 1 only for a
   face that both holds the subject and is about its size
   (`polygon-containment.ts:1-24`). A subject with no area, or inside nothing,
   gets no fit rather than a fit of zeroes (`:62-64`). A face must hold more
   than half the subject (`ENCLOSING_SHARE = 0.5`, `:53`) and there is no cover
   floor by default (`ENCLOSING_COVER = 0`, `:56`). Ties are broken by score,
   share, cover, then given order, so shuffling the candidates changes only the
   index (`:100-104`).
6. **Units are the caller's.** Both algorithms state it: distances are the
   caller's unit, so `precision` is in it; areas cancel in a ratio
   (`polygon-label.ts:18-21`, `polygon-containment.ts:31-33`). The kernel
   passes millimetres.

## How it goes wrong

- **A self-intersecting ring treated as a shape someone drew.** A bowtie is read
  as the union of its two lobes, so a "room" whose outline crosses itself gets a
  label in one lobe and an area that is not its area. `polygon-measure.ts:13-15`
  says so plainly; `polygon-label.ts:73-76` repeats it. *Tell:* an outline
  accepted from a file or a hand trace without a simplicity check.
- **An algorithm with no termination bound on pathological input.** The comb in
  `polygon-label.test.ts:152` has 30 teeth 5 mm apart at 0.1 mm precision and
  would run for a very long time without `MAX_LABEL_CELLS`. *Tell:* a `while
  (queue.length)` with no cell budget and no halving.
- **Assuming a polygon is convex.** `overlapArea` samples slab by slab and is
  exact only where every height at which the shared length changes direction
  cuts a band; `polygon-measure.test.ts` checks it against half-plane clipping,
  which *is* convex-only, rather than against it
  (`__tests__/polygon-measure.test.ts:33,106`).
- **A label placed at the centroid.** The centroid falls in a courtyard, in a
  column the room wraps around, or in the notch of an L; two rooms put their
  names over a wall (`polygon-label.ts:1-11`). The kernel still has a small
  fallback centroid-free seed of its own for imported rooms
  (`bim-kernel/src/placement/label-seed.ts:1-15`), which says in its own
  comment that it should be deleted when this package exports one.
- **A single overlap number deciding containment.** The largest face wins
  whatever the subject is, so a storey-sized loop beats the room the space
  actually is (`polygon-containment.ts:1-8`).
- **A mesh crossing a layer boundary.** Tessellation belongs to
  `manifold-engine.ts`; a package that builds `TriangleMesh` by hand has taken
  the engine's job.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-geometry/__tests__/polygon-label.test.ts` | the square, the L (not the centroid's notch), a hole through the room, a 10 km site offset, clearance ≥ the centroid's, and three termination cases: self-intersecting ring, many-toothed comb, non-finite points | a self-intersecting ring given a *sensible* answer — it is only promised to terminate |
| `packages/bim-geometry/__tests__/polygon-containment.test.ts` | share/cover near 1 for the true face, score 1 for an identical polygon, the larger-but-holding face losing to the one the subject's size, order-independence, holes read as absent floor, the floors it is given | polygons that self-intersect |
| `packages/bim-geometry/__tests__/polygon-measure.test.ts` | overlap against an independent half-plane clipper, exactness at a 10 km offset, degenerate input answering zero instead of throwing | rings that self-intersect |
| `packages/bim-geometry/__tests__/manifold-engine.test.ts` | extrusion in any frame, a loop inside a loop as a hole, cut/join order, refuses a profile crossing the axis, byte-identical output twice, cache hit counts, a 10k-triangle cut | a solid a vendor's mesh makes ambiguous |
| `packages/bim-geometry/__tests__/k10-solid-engine-conformance.test.ts` | the engine's output as a well-formed, watertight, outward-facing body of the right bounds and volume | geometry outside the conformance cases |
| `packages/bim-geometry/__tests__/g15-solid-ops.test.ts` | loft (rectangle to round, taper, three sections, refuses sections in the same place), a pattern moved/mirrored/cut, convex pieces, and glTF/OBJ intake including an open body that draws but cannot cut | — |
| `bim-kernel/src/__tests__/import-layers.test.ts:180-185` | `bim-geometry` importing anything above layer 1 | a dependency added through a subpath it does not resolve |
