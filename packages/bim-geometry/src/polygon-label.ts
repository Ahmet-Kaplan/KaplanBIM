/**
 * Where a label goes: the point inside a region farthest from any boundary.
 *
 * A centroid is the wrong answer for a room tag. It can fall in a courtyard, in
 * a column the room wraps around, or in the notch of an L, and two rooms of
 * different widths put their names on text that spills over a wall. The
 * farthest-interior point is the middle of the thickest part of the room: the
 * place text of any width has the most clearance to sit in.
 *
 * Ported from Pascal Editor, <https://github.com/pascalorg/editor>:
 * `packages/core/src/lib/polygon-label.ts` (`polygonInteriorPoint`) and the
 * `distanceToBoundary`, `containsPoint` and `area` it takes from
 * `packages/core/src/lib/polygon-boolean.ts`, MIT licence, Copyright (c) Pascal
 * Group Inc. The method is Vladimir Agafonkin's polylabel (mapbox/polylabel,
 * ISC): a best-first branch and bound over the region's bounding box. This
 * implementation is our own, written on this package's measures; the search
 * and the hole handling are the parts we took, the code is not a copy.
 *
 * Units: distances are the caller's unit, so `precision` is in it too and
 * nothing here converts. MutinyBIM's kernel works in millimetres, where a label
 * a millimetre off the pole is a hundredth of a millimetre off on a 1:100
 * sheet.
 */
import { clearanceAt, finiteRing, ringBounds, ringEnclosesArea, ringsOf, type Point, type Region, type RegionInput } from "./polygon-measure";

/**
 * How much worse than the true farthest point the answer may be, in the
 * caller's unit. A label a millimetre off the pole cannot be seen, and each
 * halving of the tolerance costs four times the cells.
 */
export const LABEL_PRECISION = 1;

/**
 * The most cells the search may expand before it answers with the best point it
 * has. This is the hard bound: no polygon, however pathological, can make the
 * search run longer than this many cells, and a region of ordinary size reaches
 * the tolerance in a few thousand.
 */
const MAX_LABEL_CELLS = 100_000;

/**
 * The farthest-interior point of `region`, within `precision` of the best
 * clearance the region offers.
 *
 * Pass a ring, or a `{ outer, holes }` region: a hole is kept clear of, so a
 * room with a column through it places its label beside the column rather than
 * in it. The answer is always inside the region — a point on a ring counts as
 * inside — and its clearance is never less than the centroid's when the
 * centroid is inside at all.
 *
 * Bounded three ways, so no input can hang it:
 *
 * - a cell is split only while its upper bound — the clearance at its centre
 *   plus the half-diagonal, since a cell's best point is at most that far from
 *   its centre — can still beat the best point found by more than `precision`;
 * - every split halves that half-diagonal, so the depth is at most
 *   log2(starting half-diagonal / `precision`), and a `precision` that
 *   underflows to zero stops the search instead of extending it;
 * - at most `MAX_LABEL_CELLS` cells are expanded, after which the best point so
 *   far is returned.
 *
 * Degenerate input, answered rather than thrown:
 *
 * - fewer than three points, or a ring whose points lie on one line (a
 *   zero-area ring): its first point is returned, on the boundary it has;
 * - a `precision` that is zero, negative or not a number: `LABEL_PRECISION` is
 *   used, since there is no exact answer to ask for;
 * - a self-intersecting ring: unsupported. The even-odd reading of its
 *   crossings is what is searched, which is defined and terminates but is not
 *   the shape that was drawn, so do not expect a sensible label for one.
 *
 * Cost: a room is a fraction of a millisecond, since the bound prunes almost
 * every cell away from the medial axis. A long thin region is the expensive
 * case, because its whole length is equally good and every cell along it has to
 * be split: a 30 m corridor at the default precision spends about thirty
 * thousand cells and tens of milliseconds. Pass a coarser `precision` when
 * placing labels for a whole sheet.
 */
export function polygonLabel(region: RegionInput, precision: number = LABEL_PRECISION): Point {
  const { outer: outerRing, holes: holeRings } = ringsOf(region);
  const outer = finiteRing(outerRing);
  if (!ringEnclosesArea(outer)) return outer[0] ?? [0, 0];
  const shape: Region = { outer, holes: holeRings.map(finiteRing).filter((hole) => ringEnclosesArea(hole)) };
  const tolerance = Number.isFinite(precision) && precision > 0 ? precision : LABEL_PRECISION;

  const box = ringBounds(outer)!;
  const start = cellAt(shape, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2);
  const corner = cellAt(shape, outer[0]![0], outer[0]![1], 0);
  // The box centre is the better opening guess, since a corner has no clearance
  // by definition; the corner is the fallback for a box centre that is outside
  // the region, which a U or a crescent does to its own bounding box.
  let best = start.clearance > corner.clearance ? start : corner;

  const queue: Cell[] = [];
  heapPush(queue, start);
  let expanded = 0;
  while (queue.length && expanded < MAX_LABEL_CELLS) {
    const current = heapPop(queue)!;
    expanded++;
    if (current.clearance > best.clearance) best = current;
    if (current.bound - best.clearance <= tolerance) continue;
    const half = current.half / 2;
    // A half that no longer rounds up has nothing left to divide.
    if (!(half > 0)) continue;
    for (const dx of [-half, half]) for (const dy of [-half, half]) heapPush(queue, cellAt(shape, current.x + dx, current.y + dy, half));
  }
  return [best.x, best.y];
}

/** A square of the bounding box, with how good its middle is and how good it could be. */
interface Cell {
  readonly x: number;
  readonly y: number;
  readonly half: number;
  /** Distance to the boundary at the centre, or its negative when the centre is outside. */
  readonly clearance: number;
  /** The best clearance any point of the cell could have: the centre's plus the half-diagonal. */
  readonly bound: number;
}

function cellAt(region: Region, x: number, y: number, half: number): Cell {
  const point: Point = [x, y];
  const clearance = clearanceAt(region, point);
  return { x, y, half, clearance, bound: clearance + half * Math.SQRT2 };
}

/** A max-heap on `bound`, kept in a plain array; the search is its only user. */
function heapPush(heap: Cell[], cell: Cell): void {
  heap.push(cell);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = (index - 1) >> 1;
    const above = heap[parent]!;
    if (above.bound >= cell.bound) break;
    heap[index] = above;
    index = parent;
  }
  heap[index] = cell;
}

function heapPop(heap: Cell[]): Cell | undefined {
  const top = heap[0];
  if (!top) return undefined;
  const last = heap.pop()!;
  if (heap.length) {
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let next = index;
      let bound = last.bound;
      if (left < heap.length && heap[left]!.bound > bound) {
        next = left;
        bound = heap[left]!.bound;
      }
      if (right < heap.length && heap[right]!.bound > bound) next = right;
      if (next === index) break;
      heap[index] = heap[next]!;
      index = next;
    }
    heap[index] = last;
  }
  return top;
}
