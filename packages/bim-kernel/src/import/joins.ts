import type { Vec2 } from "../types";
import { acrossReferenceLine, straightReferenceLine, verticalPrism } from "./shape";
import type { ImportJoinResult, ImportLayerSet, ImportProduct, ImportReferenceLine, ImportWallMerge } from "./types";

/**
 * Wall joins for an import (step 6 of the IFC plan): the pass that turns a
 * file's wall pieces into the walls the building has — run on the neutral
 * products, before any of them becomes a record.
 *
 * Two things files leave undone, both taken as *logic* from the Pascal editor
 * (`ifc-converter/src/cleanup.ts` `wallsCanMerge`, and `wall-joins.ts`
 * `joinMove` / `insideBody`) and rewritten against this importer's products:
 *
 * 1. **Fragment merge.** An exporter splits one wall into pieces — at a
 *    junction, at a layer change, at a storey break. Pieces on one storey, of
 *    one direction, one build-up, one type and one thickness, whose reference
 *    lines lie on one line with a small gap or overlap between them, are one
 *    wall: the merged product's reference line runs from the first piece's
 *    start to the last piece's end, and the pieces it came from are named in
 *    the report.
 * 2. **L and T joins.** A wall end that overshoots the wall it meets slides
 *    back along its own axis — onto the neighbour's reference line where the
 *    neighbour ends at the same crossing too (an L corner), and onto the
 *    neighbour's near face where the neighbour runs past it (a T). Nothing else
 *    about the wall moves: its direction, thickness and height are the file's,
 *    and the move is along the axis only, so a wall is never moved sideways.
 *
 * **The tolerances are ours, not Pascal's.** Pascal's defaults are US
 * residential framing numbers (a 1.25 m merge gap, a 0.35 m separator gap); on
 * a Turkish commercial model a 1.25 m merge would close a real door. Every
 * constant below is millimetres, with the reason it has that value.
 *
 * **A wall whose line was inferred is left alone.** A product with no straight
 * `Axis` in the file gets its record's line from its body's footprint
 * (`referenceLineInferred`), which is the body's *centre*, not the line the
 * element is dimensioned by: sliding an end along it, or merging on it, would
 * join the wrong face of the wrong neighbour. Such a product is not a candidate
 * here and cannot be a neighbour; the count of them rides in the report so the
 * note can say they took no part.
 */

/**
 * The largest gap two pieces of one wall may have and still be merged, mm.
 *
 * Pascal's `maxWallJoinGap` is 1250 mm — a US residential framing allowance,
 * where a 1.25 m gap between two wall pieces is a bay framing slip. Here it
 * would swallow a door: the narrowest real opening in commercial work is a
 * 700 mm leaf. 200 mm is under a third of that, so no opening can be closed by
 * a merge, while it still absorbs the gaps an exporter leaves where it splits a
 * wall at a junction or at a layer boundary, or from a 20 mm modelling slip
 * between two drawings of the same wall.
 */
const MERGE_GAP_MM = 200;

/**
 * The largest overlap two pieces of one wall may have and still be merged, mm.
 *
 * The same 200 mm, seen from the other side: a wall drawn twice, end to end,
 * overlaps by a little. A larger overlap is two walls genuinely on one line (a
 * copy, a chase, one drawn behind another), and collapsing those into one would
 * silently delete a wall — so they stay two, and the report counts them
 * (`coincidentPairs`) rather than hiding them.
 */
const MERGE_OVERLAP_MM = 200;

/**
 * How far apart two reference lines may run and still be one line, mm.
 *
 * A file writes whole millimetres, so two pieces of one wall differ only by
 * rounding. 20 mm absorbs a modelling slip and still refuses two parallel walls
 * that are a real offset apart (a 50 mm stud offset is two walls).
 */
const MERGE_COLLINEAR_MM = 20;

/**
 * How near in direction two pieces must be to count as one wall, degrees.
 *
 * Over the longest wall in this sample (10 m), 1° is 175 mm of sideways drift,
 * so any real difference of direction puts two walls in different buckets.
 */
const MERGE_ANGLE_DEG = 1;

/**
 * How near in thickness two pieces must be to be one wall, mm.
 *
 * The file states thickness through the body and the build-up; two pieces of
 * one wall agree to the millimetre. 25 mm admits a rounding or a
 * stated-versus-measured slip and refuses a 200 mm wall and a 250 mm wall on
 * one line.
 */
const MERGE_THICKNESS_MM = 25;

/**
 * How near in height (and in the height of the reference line) two pieces must
 * be to be one wall, mm.
 *
 * Pieces of one wall are cut to the same height; a wall and the parapet over it
 * are not, and merging them would give the takeoff one wall of the wrong
 * height. 50 mm is a slab-level setting-out slip.
 */
const MERGE_HEIGHT_MM = 50;

/**
 * The smallest angle two walls must meet at to be joined, degrees.
 *
 * The join projects an end onto a crossing of two lines, and a crossing of
 * near-parallel lines is unstable: with a 20 mm line slip, the crossing at 5°
 * jumps 229 mm and at 1° it jumps 1.15 m — further than a wall is thick. At 20°
 * the same slip moves the crossing 58 mm, inside one wall's thickness, so a
 * move above this angle is still a measurement rather than a guess. Two walls
 * that really are near-parallel stay two walls, which is what a long wall and
 * its furring are.
 */
const JOIN_MIN_ANGLE_DEG = 20;

/**
 * The furthest a wall end may slide, mm.
 *
 * Pascal's `joinMove` bound is 600 mm. This sample's walls measure 360 mm
 * across — the thickest here — so half of one is 180; a 500 mm core or shaft
 * wall gives 250. 600 mm covers an L slide or a T trim for any wall up to
 * 1200 mm thick plus 300 mm of setting-out slip, and refuses a move that would
 * mean the end wasn't at that junction at all. A neighbour thicker than
 * 1200 mm raises the bound to half its thickness, as Pascal does with
 * `thickness + 50 mm`.
 */
const JOIN_MOVE_LIMIT_MM = 600;

/**
 * The furthest a wall end may be pulled *forward* to close a gap, mm.
 *
 * Shortening a wall a little is a correction; lengthening one is a claim about
 * geometry the file doesn't state. So a gap may only be closed when it is
 * small — the same 200 mm as a merge gap, for the same reason: no real opening
 * is that narrow.
 */
const JOIN_GAP_MM = 200;

/**
 * The furthest a wall end may be pulled forward when the file itself says the
 * two walls are joined (`IfcRelConnectsPathElements`), mm.
 *
 * The file has stated the connection, so a gap between the two drawn ends is a
 * drawing slip rather than an opening. 600 mm — under the 700 mm narrowest leaf
 * — closes that slip and still cannot cross a door.
 */
const JOIN_STATED_GAP_MM = 600;

/**
 * How near the neighbour's own end a crossing must fall to be an L rather than
 * a T, mm.
 *
 * At an L the two reference lines meet at a corner, and the ends meet on those
 * lines; at a T the neighbour runs past, and this wall stops at its face. In a
 * corner the crossing lands within half a wall's thickness of the neighbour's
 * end; 150 mm or half the neighbour's thickness, whichever is larger, keeps a
 * corner with a small slip on the L rule and a stem on the T rule.
 */
const JOIN_END_MM = 150;

/** Within this, an end is already where the join would put it, mm. */
const ALREADY_THERE_MM = 0.5;

const DEG = Math.PI / 180;

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const along = (p: Vec2, origin: Vec2, dir: Vec2): number => dot(sub(p, origin), dir);
const round = (n: number): number => Math.round(n * 10) / 10;

/** A unit vector from `a` to `b`, or null when they are the same point. */
function unitVector(a: Vec2, b: Vec2): Vec2 | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  return l < 1 ? null : { x: dx / l, y: dy / l };
}

/** A direction as an angle in [0, 180): two walls drawn opposite ways share a bucket. */
function bearing(dir: Vec2): number {
  const deg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  return ((deg % 180) + 180) % 180;
}

/** A product about to become a wall, with what the joins need of it read once. */
interface JoinWall {
  readonly product: ImportProduct;
  readonly start: Vec2;
  readonly end: Vec2;
  /** Across the reference line, mm. */
  readonly thickness: number;
  /** Floor to top of the body, mm. */
  readonly height: number;
  /** The reference line's own height, mm (a wall on a storey above z = 0). */
  readonly z: number;
}

/**
 * The product as a wall the joins can work on: a straight reference line the
 * file states (never an inferred one), and the body measured across it. Null
 * exactly when the wall rule will refuse the product, so the joins never touch
 * a product that doesn't become a wall.
 */
function joinWallOf(product: ImportProduct): JoinWall | null {
  const line = straightReferenceLine(product.referenceLine);
  if (!line) return null;
  const prism = verticalPrism(product.geometry);
  if (!prism) return null;
  const across = acrossReferenceLine(prism.outline, line);
  if (!across) return null;
  return { product, start: line.start, end: line.end, thickness: across.thickness, height: prism.top - prism.bottom, z: product.referenceLine?.points[0]?.z ?? prism.bottom };
}

/** A build-up as one string, so two pieces of one wall compare equal and two build-ups don't. */
function buildUpOf(set: ImportLayerSet | null): string {
  if (!set) return "";
  return set.layers.map((l) => `${l.order}:${l.materialName}:${Math.round(l.thicknessMm)}`).join("+");
}

/** What makes two products pieces of one wall: the same type, build-up, thickness, height and line height. */
function sameWall(a: JoinWall, b: JoinWall): boolean {
  if ((a.product.typeId ?? "") !== (b.product.typeId ?? "")) return false;
  if (buildUpOf(a.product.layerSet) !== buildUpOf(b.product.layerSet)) return false;
  return Math.abs(a.thickness - b.thickness) <= MERGE_THICKNESS_MM && Math.abs(a.height - b.height) <= MERGE_HEIGHT_MM && Math.abs(a.z - b.z) <= MERGE_HEIGHT_MM;
}

/** A run of pieces found to be one wall, its line as it stands after the merge. */
interface Chain {
  start: Vec2;
  end: Vec2;
  readonly pieces: JoinWall[];
  /** The closest separation between two pieces it was merged from, mm (negative: they overlapped). */
  separationMm: number;
}

/** The merged product's reference line: the chain's two ends, at the height the kept piece's line sits. */
function lineThrough(start: Vec2, end: Vec2, previous: ImportReferenceLine | undefined): ImportReferenceLine {
  const z = previous?.points[0]?.z ?? 0;
  return { points: [{ x: start.x, y: start.y, z }, { x: end.x, y: end.y, z }], straight: true };
}

function metres(mm: number): string {
  return `${Math.round(mm / 10) / 100} m`;
}

/**
 * Merge the pieces of one wall: on one storey, in one direction, of one build-up
 * and thickness, whose reference lines lie on one line with a gap or overlap
 * within the tolerances. Returns the chains of two or more pieces (each becomes
 * one wall) and how many pairs lie on one line but overlap too far to be merged.
 */
function mergeChains(walls: readonly JoinWall[]): { readonly chains: readonly Chain[]; readonly coincidentPairs: number } {
  const groups = new Map<string, JoinWall[]>();
  for (const w of walls) {
    const key = `${w.product.storeyId ?? ""}|${w.product.typeId ?? ""}|${buildUpOf(w.product.layerSet)}`;
    const list = groups.get(key);
    if (list) list.push(w);
    else groups.set(key, [w]);
  }
  const chains: Chain[] = [];
  let coincidentPairs = 0;
  for (const key of [...groups.keys()].sort()) {
    // Direction first: pieces of one wall are exported at one bearing, and a run
    // of near-equal bearings is what may be merged at all.
    const oriented = (groups.get(key) ?? []).flatMap((w) => {
      const dir = unitVector(w.start, w.end);
      return dir ? [{ w, dir, bearing: bearing(dir) }] : [];
    });
    oriented.sort((a, b) => a.bearing - b.bearing || a.w.product.sourceId.localeCompare(b.w.product.sourceId));
    for (let i = 0; i < oriented.length; ) {
      let j = i + 1;
      while (j < oriented.length && Math.abs((oriented[j]?.bearing ?? 0) - (oriented[i]?.bearing ?? 0)) <= MERGE_ANGLE_DEG) j++;
      const run = oriented.slice(i, j);
      i = j;
      const first = run[0];
      if (!first) continue;
      const dir = first.dir;
      const origin = first.w.start;
      const ordered = [...run].sort((a, b) => Math.min(along(a.w.start, origin, dir), along(a.w.end, origin, dir)) - Math.min(along(b.w.start, origin, dir), along(b.w.end, origin, dir)));
      let current: Chain | null = null;
      for (const { w } of ordered) {
        if (current && sameWall(current.pieces[0] as JoinWall, w)) {
          // Measured along the chain's own direction, from the chain's start.
          const near = Math.min(along(w.start, current.start, dir), along(w.end, current.start, dir));
          const far = Math.max(along(w.start, current.start, dir), along(w.end, current.start, dir));
          const chainLength = distance(current.start, current.end);
          const lineOffset = Math.abs(cross(dir, sub(w.start, current.start)));
          if (lineOffset <= MERGE_COLLINEAR_MM) {
            const overlap = Math.min(chainLength, far) - Math.max(0, near);
            const gap = Math.max(near - chainLength, 0);
            const merges = overlap > 0 ? overlap <= MERGE_OVERLAP_MM : gap <= MERGE_GAP_MM;
            if (merges) {
              const from = Math.min(0, near);
              const to = Math.max(chainLength, far);
              const base = current.start;
              current.start = { x: base.x + dir.x * from, y: base.y + dir.y * from };
              current.end = { x: base.x + dir.x * to, y: base.y + dir.y * to };
              const separation = overlap > 0 ? -overlap : gap;
              if (Math.abs(separation) < Math.abs(current.separationMm)) current.separationMm = separation;
              current.pieces.push(w);
              continue;
            }
            if (overlap > MERGE_OVERLAP_MM) coincidentPairs += 1;
          }
        }
        current = { start: w.start, end: w.end, pieces: [w], separationMm: Number.POSITIVE_INFINITY };
        chains.push(current);
      }
    }
  }
  return { chains: chains.filter((c) => c.pieces.length > 1), coincidentPairs };
}

/** A chain as the merged product and the report line that names what it was. */
function mergeOf(chain: Chain): { readonly product: ImportProduct; readonly line: ImportWallMerge } {
  const kept = chain.pieces[0];
  if (!kept) throw new Error("[bim-kernel/import] a merge chain with no piece");
  const nameOf = (p: JoinWall): string => p.product.name?.trim() || p.product.tag?.trim() || p.product.sourceId;
  const pieces = chain.pieces.map((p) => ({ sourceId: p.product.sourceId, name: nameOf(p) }));
  const before = chain.pieces.reduce((sum, p) => sum + distance(p.start, p.end), 0);
  const product: ImportProduct = { ...kept.product, referenceLine: lineThrough(chain.start, chain.end, kept.product.referenceLine) };
  const line: ImportWallMerge = {
    sourceId: kept.product.sourceId,
    name: pieces[0]?.name ?? kept.product.sourceId,
    pieces,
    lengthBeforeMm: Math.round(before),
    lengthAfterMm: Math.round(distance(chain.start, chain.end)),
    gapMm: Number.isFinite(chain.separationMm) ? Math.round(chain.separationMm) : 0,
  };
  return { product, line };
}

/**
 * Where an end of `wall` should go against `neighbour`, or null when the two
 * don't meet at a junction this pass can act on. `statedJoin` is what the file
 * says about the pair (`IfcRelConnectsPathElements`, read on the product as
 * `pathJoins`), which raises the gap a move may close.
 */
function moveFor(wall: JoinWall, end: "start" | "end", neighbour: JoinWall, statedJoin: boolean): Vec2 | null {
  const dir = unitVector(wall.start, wall.end);
  const other = unitVector(neighbour.start, neighbour.end);
  if (!dir || !other) return null;
  // A candidate must meet at a real angle: near-parallel lines cross too far
  // away to project an end onto (see JOIN_MIN_ANGLE_DEG).
  if (Math.abs(cross(dir, other)) < Math.sin(JOIN_MIN_ANGLE_DEG * DEG)) return null;
  // The crossing of the two reference lines, each extended.
  const t = cross(sub(neighbour.start, wall.start), other) / cross(dir, other);
  const crossing: Vec2 = { x: wall.start.x + dir.x * t, y: wall.start.y + dir.y * t };
  const at = end === "start" ? wall.start : wall.end;
  const outward: Vec2 = end === "start" ? { x: -dir.x, y: -dir.y } : dir;
  // Where the crossing falls on the neighbour's own run: 0 at either of its ends.
  const neighbourLength = distance(neighbour.start, neighbour.end);
  const atNeighbour = dot(sub(crossing, neighbour.start), other);
  const toNeighbourEnd = Math.min(atNeighbour, neighbourLength - atNeighbour);
  const nearEnd = Math.max(JOIN_END_MM, neighbour.thickness / 2);
  let target: Vec2;
  if (toNeighbourEnd >= -nearEnd && toNeighbourEnd <= nearEnd) {
    // L: the neighbour ends at this crossing too, so the ends meet on the lines.
    target = crossing;
  } else if (toNeighbourEnd > nearEnd) {
    // T: the neighbour runs past, so this wall stops at the neighbour's near face.
    const back = neighbour.thickness / 2;
    target = { x: crossing.x - outward.x * back, y: crossing.y - outward.y * back };
  } else {
    // The lines cross beyond the neighbour's own end: these two don't meet here.
    return null;
  }
  const move = dot(sub(target, at), outward);
  if (Math.abs(move) < ALREADY_THERE_MM) return null;
  // Shortening is a correction; lengthening is only allowed over a gap small
  // enough to be a slip, or over one the file itself states is a join.
  if (move > 0 && move > (statedJoin ? JOIN_STATED_GAP_MM : JOIN_GAP_MM)) return null;
  if (Math.abs(move) > Math.max(JOIN_MOVE_LIMIT_MM, neighbour.thickness / 2 + 50)) return null;
  return { x: round(target.x), y: round(target.y) };
}

/** A pair of products as one key, whichever way round the file states it. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface WallJoinOptions {
  /** The products this import converts to walls (their `sourceId`s); everything else passes through untouched. */
  readonly wallIds: ReadonlySet<string>;
}

export interface WallJoinPlan {
  /** The products to convert: a merged piece is gone, and walls that meet carry joined lines. */
  readonly products: readonly ImportProduct[];
  /** A piece a merge consumed → the product whose wall now carries its length. */
  readonly alias: ReadonlyMap<string, string>;
  readonly report: ImportJoinResult;
}

/**
 * Plan an import's wall joins: merge the pieces of one wall, then slide the ends
 * of walls that meet onto their neighbours' reference lines or faces. Pure and
 * deterministic: every move is measured against the lines as the file gave them,
 * so the result does not depend on the order the products were read in, and no
 * record is written — the products come out this way and become records after.
 */
export function planWallJoins(products: readonly ImportProduct[], opts: WallJoinOptions): WallJoinPlan {
  const candidates: JoinWall[] = [];
  let inferredLeft = 0;
  for (const product of products) {
    if (!opts.wallIds.has(product.sourceId)) continue;
    const wall = joinWallOf(product);
    if (wall) candidates.push(wall);
    else if (verticalPrism(product.geometry) !== null) inferredLeft += 1;
  }

  // 1. Pieces of one wall become one wall.
  const { chains, coincidentPairs } = mergeChains(candidates);
  const merged = chains.map(mergeOf);
  const replaced = new Map<string, ImportProduct>();
  const alias = new Map<string, string>();
  const gone = new Set<string>();
  for (const { product, line } of merged) {
    replaced.set(line.sourceId, product);
    for (const piece of line.pieces) {
      if (piece.sourceId === line.sourceId) continue;
      alias.set(piece.sourceId, line.sourceId);
      gone.add(piece.sourceId);
    }
  }

  // 2. Walls that meet: each end slides along its own axis, measured against the
  // lines as they stand after the merges.
  const walls: JoinWall[] = candidates
    .filter((w) => !gone.has(w.product.sourceId))
    .map((w) => {
      const product = replaced.get(w.product.sourceId);
      const line = product ? straightReferenceLine(product.referenceLine) : null;
      return product && line ? { ...w, product, start: line.start, end: line.end } : w;
    });
  const wallIds = new Set(walls.map((w) => w.product.sourceId));
  const stated = new Set<string>();
  for (const w of walls) for (const join of w.product.pathJoins ?? []) if (wallIds.has(join.otherId)) stated.add(pairKey(w.product.sourceId, join.otherId));
  const moves = new Map<string, { readonly start?: Vec2; readonly end?: Vec2 }>();
  let endsMoved = 0;
  let longestMoveMm = 0;
  let statedJoins = 0;
  for (const wall of walls) {
    let start: Vec2 | undefined;
    let end: Vec2 | undefined;
    for (const which of ["start", "end"] as const) {
      let best: { readonly to: Vec2; readonly move: number; readonly from: string } | null = null;
      for (const neighbour of walls) {
        if (neighbour.product.sourceId === wall.product.sourceId) continue;
        const pair = pairKey(wall.product.sourceId, neighbour.product.sourceId);
        const to = moveFor(wall, which, neighbour, stated.has(pair));
        if (!to) continue;
        const move = distance(which === "start" ? wall.start : wall.end, to);
        if (!best || move < best.move || (move === best.move && neighbour.product.sourceId < best.from)) best = { to, move, from: neighbour.product.sourceId };
      }
      if (!best) continue;
      if (which === "start") start = best.to;
      else end = best.to;
      endsMoved += 1;
      longestMoveMm = Math.max(longestMoveMm, best.move);
      if (stated.has(pairKey(wall.product.sourceId, best.from))) statedJoins += 1;
    }
    if (!start && !end) continue;
    // Both ends moving must not turn a wall inside out.
    if (distance(start ?? wall.start, end ?? wall.end) < 1) continue;
    moves.set(wall.product.sourceId, { ...(start ? { start } : {}), ...(end ? { end } : {}) });
  }

  const joined: ImportProduct[] = [];
  for (const wall of walls) {
    const move = moves.get(wall.product.sourceId);
    joined.push(move ? { ...wall.product, referenceLine: lineThrough(move.start ?? wall.start, move.end ?? wall.end, wall.product.referenceLine) } : wall.product);
  }

  const report: ImportJoinResult = {
    merged: merged.map((m) => m.line),
    endsMoved,
    longestMoveMm: Math.round(longestMoveMm),
    coincidentPairs,
    statedJoins,
    statedJoinsInFile: stated.size,
    inferredLeft,
  };
  const byId = new Map<string, ImportProduct>(joined.map((p) => [p.sourceId, p]));
  return { products: products.filter((p) => !gone.has(p.sourceId)).map((p) => byId.get(p.sourceId) ?? p), alias, report };
}

/** The join pass's notes for the report, in the words a person reads. */
export function joinNotes(report: ImportJoinResult): string[] {
  const notes: string[] = [];
  for (const merge of report.merged) {
    const others = merge.pieces.filter((p) => p.sourceId !== merge.sourceId).map((p) => `"${p.name}"`);
    const apart = merge.gapMm < 0 ? `overlapping ${Math.abs(merge.gapMm)} mm` : `${merge.gapMm} mm apart`;
    notes.push(`"${merge.name}" came in as one wall from ${merge.pieces.length} pieces the file splits it into (with ${others.join(", ")}), which lie on one line ${apart}: ${metres(merge.lengthBeforeMm)} of wall became ${metres(merge.lengthAfterMm)}. Check it against the source model.`);
  }
  if (report.endsMoved > 0) {
    const one = report.endsMoved === 1;
    const left = report.inferredLeft > 0 ? ` ${report.inferredLeft} ${report.inferredLeft === 1 ? "wall" : "walls"} on a reference line inferred from the body took no part.` : "";
    notes.push(
      `${report.endsMoved} wall ${one ? "end was" : "ends were"} slid along ${one ? "its" : "their"} own ${one ? "axis" : "axes"} onto the reference ${one ? "line" : "lines"} or face of the ${one ? "wall" : "walls"} ${one ? "it meets" : "they meet"} (longest ${report.longestMoveMm} mm), so a junction isn't measured twice.${left}`,
    );
  }
  if (report.coincidentPairs > 0) {
    const one = report.coincidentPairs === 1;
    notes.push(`${report.coincidentPairs} ${one ? "pair" : "pairs"} of walls lie on one line and overlap by more than ${MERGE_OVERLAP_MM} mm; ${one ? "it stays two walls" : "they stay separate walls"}. Check whether ${one ? "one of them is a copy" : "any of them is a copy"}.`);
  }
  return notes;
}
