import { pointInOutline } from "../propose/perimeter";
import type { Vec2 } from "../types";

/**
 * Where a label for a plan outline goes: the point inside it furthest from
 * every edge. A room tag or a space's name then lands in the middle of the
 * room — never on a wall, never outside an L — which the corner mean
 * (`annotation/annotations.ts`'s `outlineCentroid`) happily does.
 *
 * The method is Mapbox's "polylabel": a coarse grid over the outline's box,
 * then the same scan again on a halved window round the best point so far,
 * until the window is under `precisionMm`. Bounded work (a few hundred
 * distance reads for a room) and deterministic: the same outline always gives
 * the same seed.
 *
 * The seam: `@permitzip/bim-geometry` now has this as `polygonLabel(region,
 * precision)` (layer 1, its own lane). Switching to it is a packaging decision
 * and not this slice's: the kernel imports that package for types only today,
 * erased at runtime, so a runtime call needs a dependency line in
 * `packages/bim-kernel/package.json`. Until someone takes that on, the kernel
 * keeps this small, dependency-free copy so an imported room has a seed now.
 * The two agree on the answer (farthest-interior point, holes cut by
 * containment) and on the precision argument being in millimetres.
 */
export function labelSeedOf(outline: readonly Vec2[], holes: readonly (readonly Vec2[])[] = [], precisionMm = 10): Vec2 | null {
  const ring = cleaned(outline);
  if (ring.length < 3) return null;
  const rings = [ring, ...holes.map(cleaned).filter((h) => h.length >= 3)];
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  const box: Box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  let best: Best = { at: null, distance: -1 };
  // The first pass sweeps the whole box; every later one only the window round the best point so far.
  for (let half = Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2; half >= precisionMm && half > 0; half /= 2) best = scan(rings, box, best.at, half);
  const at = best.at;
  return at === null ? null : { x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10 };
}

interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

interface Best {
  readonly at: Vec2 | null;
  /** How far the best point is from the nearest edge; negative until one is found. */
  readonly distance: number;
}

/** The best inside point of a 5×5 grid over `half` mm around `around` (or over the whole box, with no `around`), kept only if it beats `best`. */
function scan(rings: readonly (readonly Vec2[])[], box: Box, around: Vec2 | null, half: number): Best {
  const cx = around === null ? (box.x0 + box.x1) / 2 : around.x;
  const cy = around === null ? (box.y0 + box.y1) / 2 : around.y;
  const fromX = around === null ? box.x0 : Math.max(cx - half, box.x0);
  const toX = around === null ? box.x1 : Math.min(cx + half, box.x1);
  const fromY = around === null ? box.y0 : Math.max(cy - half, box.y0);
  const toY = around === null ? box.y1 : Math.min(cy + half, box.y1);
  let best: Best = { at: around, distance: around === null ? -1 : distanceToRings(around, rings) };
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const p: Vec2 = { x: fromX + ((i + 0.5) * (toX - fromX)) / 5, y: fromY + ((j + 0.5) * (toY - fromY)) / 5 };
      if (!inside(rings, p)) continue;
      const distance = distanceToRings(p, rings);
      if (distance > best.distance) best = { at: p, distance };
    }
  }
  return best;
}

/** Whether a plan point is in the outline and outside every hole. */
function inside(rings: readonly (readonly Vec2[])[], p: Vec2): boolean {
  return rings.every((r, i) => (i === 0 ? pointInOutline(p, r) : !pointInOutline(p, r)));
}

/** The outline without repeated corners and the closing point a click leaves behind. */
function cleaned(outline: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of outline) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.5) continue;
    out.push({ x: p.x, y: p.y });
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && Math.hypot(first.x - last.x, first.y - last.y) < 0.5) out.pop();
  return out;
}

/** How far a point is from the nearest edge of any ring, mm. */
function distanceToRings(p: Vec2, rings: readonly (readonly Vec2[])[]): number {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const d = distanceToSegment(p, ring[i] as Vec2, ring[(i + 1) % ring.length] as Vec2);
      if (d < best) best = d;
    }
  }
  return best;
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
