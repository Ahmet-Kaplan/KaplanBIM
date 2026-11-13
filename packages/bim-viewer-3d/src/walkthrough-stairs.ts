/**
 * Stairs, and the storey the walker is on once they have climbed one.
 *
 * **A stair crosses a storey boundary, and the collider world is per storey.**
 * The viewer builds one collider world per storey, lazily, the first time
 * somebody walks into it (`walkthrough-collider.ts` says why: a quarter of a
 * million boxes at once is a stall nobody would forgive). A stair rises from its
 * own storey to the one above, so a walker who has climbed it is standing on a
 * floor that belongs to the storey above — a storey whose walls, and whose slab,
 * are not in the world they are colliding with. Left alone, the walker climbs
 * the flight and then keeps bumping into the storey below for the rest of the
 * walk.
 *
 * So the feet decide the storey, this module says which, and the host hands the
 * walker the world for it. Two rules, both of them building facts:
 *
 * - **The storey the feet are on is the highest floor at or below them plus a
 *   step.** A walker one riser below a landing is about to be on it; a walker
 *   half way up a flight is still on the storey the flight starts from. That
 *   boundary is what makes the last step of a stair land the walker upstairs and
 *   not leave them hanging under it.
 * - **A stair belongs to every storey it spans.** It pierces the boundary, so
 *   the storey above needs its treads as much as the storey below does: without
 *   them the walker who arrived at the top can walk back over the stairwell but
 *   never down it.
 *
 * Nothing here is per-frame heavy: a model has a handful of levels and a handful
 * of stairs, and both lookups are over those, not over the solids.
 */
import { WALK_STEP_HEIGHT_M, WALK_STOREY_BAND_M } from "./walkthrough";

/** A storey and the height of its floor, metres above project zero. */
export type StoreyFloors = ReadonlyMap<string, number>;

/**
 * The storey a walker's feet are on: the highest storey floor at or below
 * `feetY` plus one step, or null when the model records no level under them.
 *
 * "Plus one step" is the whole trick: `belowY`-style bounds are what the floor
 * detector already uses (`floorUnder`), and it means a walker standing on the
 * last tread of a flight — one riser down from the landing — is already
 * accounted to the storey they are climbing to, so the world changes under them
 * before they step off the top rather than after they have walked away from it.
 */
export function storeyForFeet(floors: StoreyFloors, feetY: number): string | null {
  const below = feetY + WALK_STEP_HEIGHT_M;
  let best: string | null = null;
  let bestY = -Infinity;
  for (const [storey, y] of floors) {
    if (y <= below && y > bestY) {
      bestY = y;
      best = storey;
    }
  }
  return best;
}

/**
 * The storeys a stepping body belongs to, given its own extent in metres: every
 * storey whose floor it stands on or reaches, and none above that.
 *
 * A stair of the usual kind (foot on one floor, top nosing at the next) gives
 * back the two storeys it joins. The bounds are the walker's own: its bottom may
 * sit a storey band below a floor (a step up from a sunken floor is still that
 * storey's stair) and its top may stop a step short of the floor it lands on
 * (the last riser goes to the landing, so the top tread does not reach it).
 */
export function storeysOfSteps(floors: StoreyFloors, bottomY: number, topY: number): string[] {
  const lowest = bottomY - WALK_STOREY_BAND_M;
  const highest = topY + WALK_STEP_HEIGHT_M;
  const out: string[] = [];
  for (const [storey, y] of floors) if (y >= lowest && y <= highest) out.push(storey);
  return out;
}
