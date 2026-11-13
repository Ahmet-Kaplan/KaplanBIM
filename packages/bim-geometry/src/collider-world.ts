/**
 * A collider world: the solid parts of a model as upright boxes, and the three
 * questions a walker asks of them — "am I inside something", "where does this
 * move land" and "what am I standing on".
 *
 * Pure (layer 0): boxes in, numbers out. No three.js, no kernel, no DOM, so the
 * movement rules are tested without a renderer — the only way to prove that a
 * step into a wall is refused, a step along one is not, and a step through a
 * doorway is untouched.
 *
 * **Why upright boxes turned about the up axis.** A wall is a box with a yaw, a
 * slab is a box with no yaw, a duct or a pipe is a box with a yaw (and a fall
 * this world ignores, because a 2 % slope changes nothing a person can bump
 * into). An oriented box keeps a 45° wall exactly as thick as a square one; a
 * plain axis-aligned bound would fatten every diagonal wall into a wedge you
 * cannot pass. Boxes are also the one shape whose overlap with a circle is two
 * subtractions in the box's own frame — cheap enough to run per frame.
 *
 * **Why a plan grid, not a tree.** The world is built one storey at a time
 * (the viewer asks for the storey you are on and nothing else), so a single
 * level is tens of thousands of boxes, not a quarter of a million. Inserting
 * each into the 2 m cells it covers and reading back only the cells round the
 * walker is a build in one pass and a query in a handful of map reads; a BVH
 * would cost more to build for the same query, and its build is the part that
 * runs while somebody is waiting to walk.
 */

/** A point in scene metres: x east, y up, z south. */
export type Point3 = readonly [number, number, number];

/**
 * A solid part as the walker meets it: an upright box, optionally turned about
 * the up axis. `center` is in metres, `half` is the half extent along the box's
 * own X, Y and Z.
 */
export interface ColliderBox {
  readonly center: Point3;
  readonly half: Point3;
  /** Turn about +Y, radians. 0 puts the box's own X along world X and its own Z along world Z. */
  readonly yaw: number;
  /** A horizontal top face a person can stand on: a slab, a landing, the ground. */
  readonly floor?: boolean;
  /** Whatever a caller wants back with a hit (an element id, a storey name). Never read here. */
  readonly tag?: string;
}

/** A standing person as this world sees them: a circle in plan, a band in elevation. */
export interface Body {
  readonly x: number;
  readonly z: number;
  /** Plan radius, metres: how close the middle of the body may come to a solid. */
  readonly radius: number;
  /** The bottom of what collides (the feet plus a step), metres. */
  readonly minY: number;
  /** The top of what collides (the top of the head), metres. */
  readonly maxY: number;
}

/** Where a move ended, and whether the world had a say in it. */
export interface MoveResult {
  readonly x: number;
  readonly z: number;
  /** True when a solid stopped the move: the result is not the point that was asked for. */
  readonly blocked: boolean;
  /** True when the move went round a surface instead of stopping dead (it slid). */
  readonly slid: boolean;
}

export interface MoveOptions {
  /**
   * Longest distance one step may cover, metres. A move longer than this is
   * split, so a long frame (or a teleport) cannot pass through a thin wall
   * between two positions that are both outside it. Defaults to the body
   * radius, which is safe for any wall thicker than nothing.
   */
  readonly stride?: number;
  /** How many surfaces one step may slide along before it gives up. */
  readonly slides?: number;
  /**
   * Boxes this move ignores, by their `tag` (the element they came from).
   *
   * A walkthrough needs it for the one thing about a building that changes while
   * you stand in it: an open door. The doorway's leaves are real solids drawn in
   * the wall's void, so a closed door must stop a person and an open one must not
   * — and which it is belongs to the session, not to the geometry. Passing the
   * set in keeps this module a pure function of its arguments: the same world,
   * the same body and the same set always give the same answer, and nothing here
   * remembers a door.
   *
   * A box with no tag is never passable: geometry that cannot say which element
   * it came from has no business disappearing.
   */
  readonly passable?: (box: ColliderBox) => boolean;
}

/** The nearest thing under a point that a person could stand on. */
export interface FloorHit {
  /** Metres: the height of the surface. */
  readonly y: number;
  readonly box: ColliderBox;
}

export interface FloorQuery {
  /** Nothing higher than this counts (usually the feet plus a step), metres. */
  readonly belowY: number;
  /** Nothing lower than this counts (the storey you started on), metres. */
  readonly minY: number;
  /** How far the middle of the body may be past the edge of the surface, metres. */
  readonly radius?: number;
}

/** A built world: the boxes, and the plan grid that finds them again. */
export interface ColliderWorld {
  readonly boxes: readonly ColliderBox[];
  /** Plan cell size, metres. */
  readonly cellSize: number;
  /** Cell key -> indices into `boxes`. */
  readonly cells: ReadonlyMap<number, readonly number[]>;
  readonly boxCount: number;
  /** Lowest and highest point of any box, metres (0/0 for an empty world). */
  readonly minY: number;
  readonly maxY: number;
}

export const DEFAULT_COLLIDER_CELL_M = 2;

/** Clearance left when a body is pushed out of a surface, metres: enough that the next test reads "outside". */
const SLIDE_SKIN_M = 1e-4;

/** Cells per axis before a plan coordinate would wrap the cell key. Far outside any building. */
const CELL_RANGE = 1 << 15;

function cellKey(ix: number, iz: number): number {
  return (ix + CELL_RANGE) * (2 * CELL_RANGE) + (iz + CELL_RANGE);
}

/** The box's world extent in plan, metres: how much room a turned box needs. */
export function boxPlanExtent(box: ColliderBox): { readonly x: number; readonly z: number } {
  const cos = Math.abs(Math.cos(box.yaw));
  const sin = Math.abs(Math.sin(box.yaw));
  return { x: box.half[0] * cos + box.half[2] * sin, z: box.half[0] * sin + box.half[2] * cos };
}

/** The height of a box's top face, metres. */
export function boxTop(box: ColliderBox): number {
  return box.center[1] + box.half[1];
}

/** The height of a box's bottom face, metres. */
export function boxBottom(box: ColliderBox): number {
  return box.center[1] - box.half[1];
}

/**
 * Build a world from boxes. One pass: every box is filed under the plan cells
 * its turned extent covers, so a query reads a handful of cells rather than
 * every box. Empty cells are not stored.
 */
export function buildColliderWorld(
  boxes: readonly ColliderBox[],
  options: { readonly cellSize?: number } = {},
): ColliderWorld {
  const cellSize = Math.max(0.25, options.cellSize ?? DEFAULT_COLLIDER_CELL_M);
  const cells = new Map<number, number[]>();
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < boxes.length; index++) {
    const box = boxes[index] as ColliderBox;
    const extent = boxPlanExtent(box);
    const loIx = Math.floor((box.center[0] - extent.x) / cellSize);
    const hiIx = Math.floor((box.center[0] + extent.x) / cellSize);
    const loIz = Math.floor((box.center[2] - extent.z) / cellSize);
    const hiIz = Math.floor((box.center[2] + extent.z) / cellSize);
    for (let ix = loIx; ix <= hiIx; ix++) {
      for (let iz = loIz; iz <= hiIz; iz++) {
        const key = cellKey(ix, iz);
        const list = cells.get(key);
        if (list) list.push(index);
        else cells.set(key, [index]);
      }
    }
    const bottom = boxBottom(box);
    const top = boxTop(box);
    if (bottom < minY) minY = bottom;
    if (top > maxY) maxY = top;
  }
  return {
    boxes,
    cellSize,
    cells,
    boxCount: boxes.length,
    minY: boxes.length > 0 ? minY : 0,
    maxY: boxes.length > 0 ? maxY : 0,
  };
}

/** Indices of the boxes filed under any plan cell within `radius` of (x, z). Each index appears once. */
function boxesNear(world: ColliderWorld, x: number, z: number, radius: number): number[] {
  const r = Math.max(0, radius);
  const loIx = Math.floor((x - r) / world.cellSize);
  const hiIx = Math.floor((x + r) / world.cellSize);
  const loIz = Math.floor((z - r) / world.cellSize);
  const hiIz = Math.floor((z + r) / world.cellSize);
  if (loIx === hiIx && loIz === hiIz) {
    const list = world.cells.get(cellKey(loIx, loIz));
    return list ? [...list] : [];
  }
  const seen = new Set<number>();
  const out: number[] = [];
  for (let ix = loIx; ix <= hiIx; ix++) {
    for (let iz = loIz; iz <= hiIz; iz++) {
      const list = world.cells.get(cellKey(ix, iz));
      if (!list) continue;
      for (const index of list) {
        if (seen.has(index)) continue;
        seen.add(index);
        out.push(index);
      }
    }
  }
  return out;
}

/** A point in a box's own frame (the inverse of a turn about +Y by the box's yaw). */
function localOf(box: ColliderBox, dx: number, dz: number): { readonly x: number; readonly z: number } {
  const cos = Math.cos(box.yaw);
  const sin = Math.sin(box.yaw);
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
}

/** How far inside a box a body's circle is, and which face it would be pushed out of. */
interface Penetration {
  /** The way out, a unit vector in world plan. */
  readonly nx: number;
  readonly nz: number;
  /** How far to travel along that way to be outside, metres. */
  readonly depth: number;
  readonly box: ColliderBox;
}

function penetrationOf(box: ColliderBox, bodyX: number, bodyZ: number, radius: number): Penetration | null {
  const local = localOf(box, bodyX - box.center[0], bodyZ - box.center[2]);
  const overX = box.half[0] + radius - Math.abs(local.x);
  if (overX <= 0) return null;
  const overZ = box.half[2] + radius - Math.abs(local.z);
  if (overZ <= 0) return null;
  // The shallowest way out is the face the body actually meets; the other axis would carry it the long way round.
  const alongX = overX <= overZ;
  const sign = Math.sign((alongX ? local.x : local.z) as number) || 1;
  const cos = Math.cos(box.yaw);
  const sin = Math.sin(box.yaw);
  // A box's own X in world is (cos, -sin); its own Z is (sin, cos).
  const nx = alongX ? sign * cos : sign * sin;
  const nz = alongX ? -sign * sin : sign * cos;
  return { nx, nz, depth: alongX ? overX : overZ, box };
}

/**
 * The deepest box the body is inside at its own position, or null when it is
 * clear. Exported because "is this a legal place to stand" is the question a
 * caller asks before moving somebody at all.
 */
export function penetrationAt(world: ColliderWorld, body: Body, passable?: (box: ColliderBox) => boolean): Penetration | null {
  let deepest: Penetration | null = null;
  for (const index of boxesNear(world, body.x, body.z, body.radius)) {
    const box = world.boxes[index] as ColliderBox;
    // An open door is not in the way. Checked before the vertical bands, because
    // a door's leaves span the whole opening and would otherwise always pass it.
    if (passable?.(box) === true) continue;
    // A body standing on a slab is not inside it: the band starts above the floor.
    if (boxTop(box) <= body.minY || boxBottom(box) >= body.maxY) continue;
    const hit = penetrationOf(box, body.x, body.z, body.radius);
    if (hit && (!deepest || hit.depth > deepest.depth)) deepest = hit;
  }
  return deepest;
}

/** True when the body is clear of every solid at its own position. */
export function isClear(world: ColliderWorld, body: Body): boolean {
  return penetrationAt(world, body) === null;
}

/** True when the move that happened points a different way from the move that was asked for. */
function turned(askedX: number, askedZ: number, movedX: number, movedZ: number): boolean {
  const askedLength = Math.hypot(askedX, askedZ);
  const movedLength = Math.hypot(movedX, movedZ);
  if (askedLength === 0 || movedLength < 1e-6) return false;
  return Math.abs(askedX * movedZ - askedZ * movedX) / (askedLength * movedLength) > 0.01;
}

/** One step of a move: no subdivision, at most `slides` surfaces. */
function slideStep(world: ColliderWorld, body: Body, dx: number, dz: number, slides: number, passable?: (box: ColliderBox) => boolean): MoveResult {
  let x = body.x;
  let z = body.z;
  let wantX = body.x + dx;
  let wantZ = body.z + dz;
  let blocked = false;
  for (let slide = 0; slide < slides; slide++) {
    const hit = penetrationAt(world, { ...body, x: wantX, z: wantZ }, passable);
    if (!hit) {
      // Nothing in the way: the point asked for, exactly, with no rounding and no snap.
      return { x: wantX, z: wantZ, blocked, slid: blocked && turned(dx, dz, wantX - body.x, wantZ - body.z) };
    }
    blocked = true;
    // Where the body meets the surface: the wanted point pushed back out of it.
    const contactX = wantX + hit.nx * (hit.depth + SLIDE_SKIN_M);
    const contactZ = wantZ + hit.nz * (hit.depth + SLIDE_SKIN_M);
    // What is left of the wanted move, measured from the contact point, with the part that went
    // into the surface taken out. Measured from the wanted point rather than from where the body
    // started, or the distance already covered along the surface would be walked twice.
    const restX = wantX - contactX;
    const restZ = wantZ - contactZ;
    const into = restX * hit.nx + restZ * hit.nz;
    const alongX = into < 0 ? restX - into * hit.nx : 0;
    const alongZ = into < 0 ? restZ - into * hit.nz : 0;
    x = contactX;
    z = contactZ;
    if (alongX === 0 && alongZ === 0) return { x, z, blocked: true, slid: turned(dx, dz, x - body.x, z - body.z) };
    wantX = x + alongX;
    wantZ = z + alongZ;
  }
  // Out of slides, and still pressed against something: where the last push left the body.
  return { x, z, blocked: true, slid: turned(dx, dz, x - body.x, z - body.z) };
}

/**
 * One step of a move, without the sweep: at most `slides` surfaces. Exported so
 * a caller whose step is already known to be short can skip the split, and so
 * the movement rules can be read one surface at a time.
 */
export function slideBody(world: ColliderWorld, body: Body, dx: number, dz: number, slides = 3): MoveResult {
  return slideStep(world, body, dx, dz, Math.max(1, slides));
}

/**
 * Move a body by (dx, dz) through the world, sliding along whatever it meets.
 *
 * A move into a wall keeps only its component along the wall, which reads as a
 * person turning their shoulder to a wall and carrying on; a camera that stops
 * dead reads as broken. A move no longer than `stride` with nothing in the way
 * is returned unchanged — bit for bit, which is what stops walking in an open
 * room from feeling sticky. A move longer than `stride` is split and may land a
 * floating-point ulp short of the sum, which is all a split move ever is.
 */
export function moveBody(world: ColliderWorld, body: Body, dx: number, dz: number, options: MoveOptions = {}): MoveResult {
  const stride = Math.max(1e-3, options.stride ?? Math.max(0.05, body.radius));
  const slides = Math.max(1, options.slides ?? 3);
  const length = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(length / stride));
  const stepX = dx / steps;
  const stepZ = dz / steps;
  let x = body.x;
  let z = body.z;
  let blocked = false;
  let slid = false;
  for (let step = 0; step < steps; step++) {
    const result = slideStep(world, { ...body, x, z }, stepX, stepZ, slides, options.passable);
    x = result.x;
    z = result.z;
    blocked = blocked || result.blocked;
    slid = slid || result.slid;
  }
  return { x, z, blocked, slid };
}

/**
 * The highest surface under (x, z) that a person could stand on, or null when
 * there is none. Only boxes marked `floor` count: a slab's top, a landing, the
 * ground — never the top of a wall or the lid of a duct.
 */
export function floorUnder(world: ColliderWorld, x: number, z: number, query: FloorQuery): FloorHit | null {
  const radius = query.radius ?? 0;
  let best: FloorHit | null = null;
  for (const index of boxesNear(world, x, z, radius)) {
    const box = world.boxes[index] as ColliderBox;
    if (box.floor !== true) continue;
    const top = boxTop(box);
    if (top > query.belowY || top < query.minY) continue;
    const local = localOf(box, x - box.center[0], z - box.center[2]);
    if (Math.abs(local.x) > box.half[0] + radius || Math.abs(local.z) > box.half[2] + radius) continue;
    if (!best || top > best.y) best = { y: top, box };
  }
  return best;
}

/**
 * Above this many triangles a mesh becomes one box round itself rather than
 * one box per triangle. A wall body cut round its openings is a few dozen
 * triangles; a body past this limit is something this world was not built for
 * (a scanned or imported mesh), where one box is honest and cheap.
 */
export const MAX_TRIANGLE_BOXES = 2048;

/**
 * The collider boxes of a triangle mesh, one per triangle's own bound.
 *
 * A wall body is drawn as a mesh cut round its doors and windows
 * (`prism-mesh.ts`), so one box round the whole wall would brick up every
 * doorway in the building — the failure this function exists to prevent. Per
 * triangle, the faces above a door and along its jambs bound the doorway, never
 * the hole, and a body's band of collision (feet plus a step, up to the head)
 * never reaches the lintel above a 2.1 m door.
 *
 * Triangles whose normal points up become floor: that is how an L-shaped slab,
 * which is also drawn as a mesh, gets a walking surface.
 */
export function boxesOfTriangles(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  options: { readonly center?: Point3; readonly yaw?: number; readonly floor?: boolean; readonly tag?: string } = {},
): ColliderBox[] {
  const triangles = Math.floor(indices.length / 3);
  if (triangles === 0) return [];
  const originX = options.center?.[0] ?? 0;
  const originY = options.center?.[1] ?? 0;
  const originZ = options.center?.[2] ?? 0;
  const yaw = options.yaw ?? 0;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const place = (localX: number, localZ: number): { readonly x: number; readonly z: number } => ({
    x: originX + localX * cos + localZ * sin,
    z: originZ - localX * sin + localZ * cos,
  });
  const out: ColliderBox[] = [];
  if (triangles > MAX_TRIANGLE_BOXES) {
    // Too many to keep one box each without paying for it every frame: fall back to one box round the whole body.
    let loX = Infinity;
    let loY = Infinity;
    let loZ = Infinity;
    let hiX = -Infinity;
    let hiY = -Infinity;
    let hiZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] as number;
      const y = positions[i + 1] as number;
      const z = positions[i + 2] as number;
      if (x < loX) loX = x;
      if (y < loY) loY = y;
      if (z < loZ) loZ = z;
      if (x > hiX) hiX = x;
      if (y > hiY) hiY = y;
      if (z > hiZ) hiZ = z;
    }
    const centre = place((loX + hiX) / 2, (loZ + hiZ) / 2);
    return [
      {
        center: [centre.x, originY + (loY + hiY) / 2, centre.z],
        half: [(hiX - loX) / 2, (hiY - loY) / 2, (hiZ - loZ) / 2],
        yaw,
        ...(options.floor === true ? { floor: true } : {}),
        ...(options.tag !== undefined ? { tag: options.tag } : {}),
      },
    ];
  }
  for (let t = 0; t < triangles; t++) {
    const a = (indices[t * 3] as number) * 3;
    const b = (indices[t * 3 + 1] as number) * 3;
    const c = (indices[t * 3 + 2] as number) * 3;
    const ax = positions[a] as number;
    const ay = positions[a + 1] as number;
    const az = positions[a + 2] as number;
    const bx = positions[b] as number;
    const by = positions[b + 1] as number;
    const bz = positions[b + 2] as number;
    const cx = positions[c] as number;
    const cy = positions[c + 1] as number;
    const cz = positions[c + 2] as number;
    const loX = Math.min(ax, bx, cx);
    const hiX = Math.max(ax, bx, cx);
    const loY = Math.min(ay, by, cy);
    const hiY = Math.max(ay, by, cy);
    const loZ = Math.min(az, bz, cz);
    const hiZ = Math.max(az, bz, cz);
    const centre = place((loX + hiX) / 2, (loZ + hiZ) / 2);
    const walkable = options.floor === true && facesUp(ax, ay, az, bx, by, bz, cx, cy, cz);
    out.push({
      center: [centre.x, originY + (loY + hiY) / 2, centre.z],
      half: [(hiX - loX) / 2, (hiY - loY) / 2, (hiZ - loZ) / 2],
      yaw,
      ...(walkable ? { floor: true } : {}),
      ...(options.tag !== undefined ? { tag: options.tag } : {}),
    });
  }
  return out;
}

/**
 * True when a triangle lies flat enough to be walked on. The winding differs
 * between a cap and its underside, so only the size of the vertical part of the
 * normal matters: a cap is flat, a wall face is not.
 */
function facesUp(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): boolean {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz);
  return length > 0 && Math.abs(ny) / length > 0.85;
}
