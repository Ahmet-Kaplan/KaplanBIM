/**
 * The polygon measures the label and containment algorithms in this package
 * share, with nothing above them: area, point containment with holes cut out,
 * clearance from the boundary, and the area two regions have in common.
 *
 * Units are whatever the caller uses and none is assumed. MutinyBIM's kernel
 * works in millimetres, so here a length is millimetres, an area square
 * millimetres, and nothing is converted.
 *
 * A ring is a flat list of points and is closed implicitly: the last point
 * joins the first, and no point is repeated. A region is one outer ring plus
 * the rings it must keep clear of, so a hole is a ring the label may not sit
 * in. The even-odd rule reads a self-intersecting ring as the union of its
 * overlapping lobes, which is defined but is not the shape anyone drew; the
 * measures here stay finite and terminate, and no more. A non-finite
 * coordinate makes the two edges meeting it unreadable: a measure that takes a
 * whole ring and returns an area skips such points, while a per-point one reads
 * the ring as given, so a distance can come back not a number and containment
 * reads whatever is left of the ring. `polygonLabel` drops them first.
 */
import type { Loop, Vec2Tuple } from "./program";

/** The same pair `program.ts` calls `Vec2Tuple`, named for what it is here. */
export type Point = Vec2Tuple;

/** One closed region: an outer ring, and any rings it must keep clear of. */
export interface Region {
  readonly outer: Loop;
  readonly holes?: readonly Loop[];
}

/** A region, or a bare ring, since a ring on its own has nowhere to have a hole. */
export type RegionInput = Loop | Region;

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Below this share of its own bounding box a ring encloses nothing worth measuring. */
const DEGENERATE_AREA = 1e-12;

/** How close a point must be to a ring to count as on it, relative to its own magnitude. */
const BOUNDARY = 1e-9;

/** The rings of an input, outer first: a bare ring has no holes. */
export function ringsOf(region: RegionInput): { outer: Loop; holes: readonly Loop[] } {
  return isRing(region) ? { outer: region, holes: [] } : { outer: region.outer, holes: region.holes ?? [] };
}

/** A bare ring, which `Array.isArray` alone cannot say of a readonly array. */
function isRing(input: RegionInput): input is Loop {
  return Array.isArray(input);
}

/** The same ring without non-finite points, which carry no position at all. */
export function finiteRing(ring: Loop): readonly Point[] {
  return ring.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

/**
 * Twice the ring's enclosed area is the sum over its edges of the cross product
 * seen from the first vertex, halved. Relative to that vertex, because at a
 * 1e9 mm site offset the absolute products cancel and a sliver becomes a slab.
 * Positive is counter-clockwise.
 */
export function signedRingArea(ring: Loop): number {
  const origin = ring[0];
  if (!origin) return 0;
  let twice = 0;
  for (let index = 0; index < ring.length; index++) {
    const here = ring[index]!;
    const next = ring[(index + 1) % ring.length]!;
    twice += (here[0] - origin[0]) * (next[1] - origin[1]) - (next[0] - origin[0]) * (here[1] - origin[1]);
  }
  return twice / 2;
}

/** Whether the ring encloses anything: three points are not enough if they lie on one line. */
export function ringEnclosesArea(ring: Loop): boolean {
  if (ring.length < 3) return false;
  const box = ringBounds(ring);
  if (!box) return false;
  const extent = (box.maxX - box.minX) * (box.maxY - box.minY);
  return Math.abs(signedRingArea(ring)) > extent * DEGENERATE_AREA;
}

/** The ring's box, or nothing when it has no finite point. */
export function ringBounds(ring: Loop): Bounds | undefined {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of ring) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  return minX <= maxX && minY <= maxY ? { minX, minY, maxX, maxY } : undefined;
}

/** Enclosed area: the outer ring minus its holes, never below zero when they overlap. */
export function polygonArea(region: RegionInput): number {
  const { outer, holes } = ringsOf(region);
  let area = Math.abs(signedRingArea(finiteRing(outer)));
  for (const hole of holes) area -= Math.abs(signedRingArea(finiteRing(hole)));
  return area > 0 ? area : 0;
}

/** Distance from the point to the nearest edge of any ring; infinity when there are no rings. */
export function distanceToBoundary(region: RegionInput, point: Point): number {
  const { outer, holes } = ringsOf(region);
  let nearest = Number.POSITIVE_INFINITY;
  for (const ring of [outer, ...holes]) {
    for (let index = 0; index < ring.length; index++) {
      const from = ring[index]!;
      const to = ring[(index + 1) % ring.length]!;
      nearest = Math.min(nearest, segmentDistance(from, to, point));
      if (nearest === 0) return 0;
    }
  }
  return nearest;
}

/**
 * Whether the point lies in the region, rings included: a point on a ring is in
 * it, and a point inside a hole is out. The on-ring tolerance grows with the
 * coordinate, so a test at a 1e7 mm site offset is not lost in rounding.
 */
export function containsPoint(region: RegionInput, point: Point): boolean {
  return containedAt(region, point, distanceToBoundary(region, point));
}

/**
 * How far inside the region the point is, or its negative when it is outside:
 * the clearance a label has there, signed by whether there is any floor under
 * it. One boundary walk, so a caller that wants both answers asks once.
 */
export function clearanceAt(region: RegionInput, point: Point): number {
  const nearest = distanceToBoundary(region, point);
  return containedAt(region, point, nearest) ? nearest : -nearest;
}

function containedAt(region: RegionInput, point: Point, nearest: number): boolean {
  const tolerance = BOUNDARY * (1 + Math.abs(point[0]) + Math.abs(point[1]));
  if (nearest <= tolerance) return true;
  const { outer, holes } = ringsOf(region);
  if (!ringContains(outer, point)) return false;
  for (const hole of holes) if (ringContains(hole, point)) return false;
  return true;
}

/**
 * The area two regions have in common, the even-odd lens where they cross.
 *
 * Sampled slab by slab: the horizontal lines through every vertex and every
 * place the two boundaries cross cut the plane into bands, and inside a band
 * the length shared at each height changes linearly, so the band's midpoint
 * carries its whole area exactly. The cost is vertices against vertices —
 * a few hundred edges for a room and a wall loop, which is why it is done this
 * way rather than by clipping the rings into new rings.
 */
export function overlapArea(left: RegionInput, right: RegionInput): number {
  const a = filledRegion(left);
  const b = filledRegion(right);
  if (!a || !b) return 0;
  const boxes = [ringBounds(a.outer), ringBounds(b.outer)] as const;
  const [boxA, boxB] = boxes;
  if (!boxA || !boxB) return 0;
  if (boxA.maxX <= boxB.minX || boxB.maxX <= boxA.minX || boxA.maxY <= boxB.minY || boxB.maxY <= boxA.minY) return 0;

  const heights = breakHeights(a, b);
  let area = 0;
  for (let index = 0; index + 1 < heights.length; index++) {
    const bottom = heights[index]!;
    const top = heights[index + 1]!;
    const height = top - bottom;
    if (!(height > 0)) continue;
    const middle = (bottom + top) / 2;
    const shared = intersectSpans(regionSpans(a, middle), regionSpans(b, middle));
    if (!shared.length) continue;
    area += spanLength(shared) * height;
  }
  return area;
}

/** A region whose rings all have area: the only kind worth sampling. */
interface Filled {
  readonly outer: readonly Point[];
  readonly holes: readonly (readonly Point[])[];
  readonly rings: readonly (readonly Point[])[];
}

function filledRegion(region: RegionInput): Filled | undefined {
  const { outer: outerRing, holes: holeRings } = ringsOf(region);
  const outer = finiteRing(outerRing);
  if (!ringEnclosesArea(outer)) return undefined;
  const holes = holeRings.map(finiteRing).filter((hole) => ringEnclosesArea(hole));
  return { outer, holes, rings: [outer, ...holes] };
}

/** A stretch of one scanline that is inside. */
type Span = readonly [number, number];

/** Where a ring's inside lies along the horizontal line at `height`, by the even-odd rule. */
function ringSpans(ring: readonly Point[], height: number): Span[] {
  const crossings: number[] = [];
  for (let index = 0; index < ring.length; index++) {
    const from = ring[index]!;
    const to = ring[(index + 1) % ring.length]!;
    // Half-open on the lower side, so a vertex on the line counts once and a
    // horizontal edge never divides.
    if (from[1] <= height === to[1] <= height) continue;
    crossings.push(from[0] + ((height - from[1]) / (to[1] - from[1])) * (to[0] - from[0]));
  }
  crossings.sort((left, right) => left - right);
  const spans: Span[] = [];
  for (let index = 0; index + 1 < crossings.length; index += 2) spans.push([crossings[index]!, crossings[index + 1]!]);
  return spans;
}

function regionSpans(region: Filled, height: number): Span[] {
  let spans = ringSpans(region.outer, height);
  for (const hole of region.holes) {
    if (!spans.length) break;
    spans = subtractSpans(spans, ringSpans(hole, height));
  }
  return spans;
}

/** `base` less `cut`, both sorted and disjoint. */
function subtractSpans(base: readonly Span[], cut: readonly Span[]): Span[] {
  if (!cut.length) return [...base];
  const kept: Span[] = [];
  let next = 0;
  for (const [start, end] of base) {
    let cursor = start;
    while (next < cut.length && cut[next]![1] <= cursor) next++;
    let index = next;
    while (index < cut.length && cut[index]![0] < end) {
      const [cutStart, cutEnd] = cut[index]!;
      if (cutStart > cursor) kept.push([cursor, Math.min(cutStart, end)]);
      cursor = Math.max(cursor, cutEnd);
      if (cursor >= end) break;
      index++;
    }
    if (cursor < end) kept.push([cursor, end]);
  }
  return kept;
}

/** Where both are inside, from two sorted disjoint lists. */
function intersectSpans(left: readonly Span[], right: readonly Span[]): Span[] {
  const shared: Span[] = [];
  let a = 0;
  let b = 0;
  while (a < left.length && b < right.length) {
    const start = Math.max(left[a]![0], right[b]![0]);
    const end = Math.min(left[a]![1], right[b]![1]);
    if (start < end) shared.push([start, end]);
    if (left[a]![1] < right[b]![1]) a++;
    else b++;
  }
  return shared;
}

function spanLength(spans: readonly Span[]): number {
  let length = 0;
  for (const [start, end] of spans) length += end - start;
  return length;
}

/** Every height at which the shared length can change direction: vertices, then crossings. */
function breakHeights(left: Filled, right: Filled): number[] {
  const heights: number[] = [];
  for (const ring of left.rings) for (const point of ring) heights.push(point[1]);
  for (const ring of right.rings) for (const point of ring) heights.push(point[1]);
  for (const a of left.rings) {
    for (const b of right.rings) {
      for (let i = 0; i < a.length; i++) {
        const a0 = a[i]!;
        const a1 = a[(i + 1) % a.length]!;
        for (let j = 0; j < b.length; j++) {
          const b0 = b[j]!;
          const b1 = b[(j + 1) % b.length]!;
          const height = crossingHeight(a0, a1, b0, b1);
          if (height !== undefined) heights.push(height);
        }
      }
    }
  }
  heights.sort((first, second) => first - second);
  const distinct: number[] = [];
  for (const height of heights) if (!distinct.length || height > distinct[distinct.length - 1]!) distinct.push(height);
  return distinct;
}

/**
 * The height at which two edges cross, when they cross between their ends.
 * Parallel edges — including two edges lying along each other — have no single
 * crossing height and are left to the vertices around them.
 */
function crossingHeight(a0: Point, a1: Point, b0: Point, b1: Point): number | undefined {
  if (Math.min(a0[1], a1[1]) > Math.max(b0[1], b1[1]) || Math.min(b0[1], b1[1]) > Math.max(a0[1], a1[1])) return undefined;
  const ax = a1[0] - a0[0];
  const ay = a1[1] - a0[1];
  const bx = b1[0] - b0[0];
  const by = b1[1] - b0[1];
  const denominator = ax * by - ay * bx;
  if (denominator === 0 || !Number.isFinite(denominator)) return undefined;
  const offsetX = b0[0] - a0[0];
  const offsetY = b0[1] - a0[1];
  const alongA = (offsetX * by - offsetY * bx) / denominator;
  const alongB = (offsetX * ay - offsetY * ax) / denominator;
  if (!(alongA > 0) || !(alongA < 1) || !(alongB > 0) || !(alongB < 1)) return undefined;
  return a0[1] + alongA * ay;
}

function segmentDistance(from: Point, to: Point, point: Point): number {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const lengthSquared = dx * dx + dy * dy;
  const along = lengthSquared > 0 ? Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / lengthSquared)) : 0;
  return Math.hypot(point[0] - from[0] - along * dx, point[1] - from[1] - along * dy);
}

function ringContains(ring: readonly Point[], point: Point): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const here = ring[index]!;
    const there = ring[previous]!;
    if (here[1] > point[1] === there[1] > point[1]) continue;
    if (point[0] < ((there[0] - here[0]) * (point[1] - here[1])) / (there[1] - here[1]) + here[0]) inside = !inside;
  }
  return inside;
}
