/** @jest-environment node */
import {
  boxesOfTriangles,
  buildColliderWorld,
  floorUnder,
  isClear,
  moveBody,
  type Body,
  type ColliderBox,
} from "../src";

/**
 * A room 6 m square with one wall left open as a 1 m doorway, standing on a
 * slab whose top is y = 0. Everything below is metres, which is what the world
 * and the viewer both speak; the kernel's millimetres never reach this module.
 *
 *                    z = -2   wall A
 *     +-----------=========-----------+
 *     |                              |
 *  C1 |  (doorway at x = -2,         |   x = -2 is the east... west wall
 *     |   z between -0.5 and 0.5)     |
 *     |                              |
 *     +-----------=========-----------+   z = +2   wall B
 *        x = -3                    x = +3
 */
const SLAB: ColliderBox = { center: [0, -0.1, 0], half: [5, 0.1, 5], yaw: 0, floor: true };
const WALL_A: ColliderBox = { center: [0, 1.5, -2], half: [3, 1.5, 0.1], yaw: 0 };
const WALL_B: ColliderBox = { center: [0, 1.5, 2], half: [3, 1.5, 0.1], yaw: 0 };
/** The west wall, in two pieces: the gap between them is the doorway. */
const WALL_C1: ColliderBox = { center: [-2, 1.5, -1.25], half: [0.1, 1.5, 0.75], yaw: 0 };
const WALL_C2: ColliderBox = { center: [-2, 1.5, 1.25], half: [0.1, 1.5, 0.75], yaw: 0 };

const RADIUS = 0.22;
const world = buildColliderWorld([SLAB, WALL_A, WALL_B, WALL_C1, WALL_C2]);

/** A person standing on the slab at (x, z): the band starts a step above the floor, so the slab under them is not a wall. */
function body(x: number, z: number, feet = 0): Body {
  return { x, z, radius: RADIUS, minY: feet + 0.25, maxY: feet + 1.8 };
}

describe("the collider world finds the solid a body would walk into", () => {
  it("reports a body in the middle of the room as clear", () => {
    expect(isClear(world, body(0, 0))).toBe(true);
  });

  it("reports a body inside a wall as inside it, and says which way is out", () => {
    const hit = isClear(world, body(0, -1.95));
    expect(hit).toBe(false);
  });

  it("keeps the slab a body stands on out of its way", () => {
    // The band begins a step above the floor, so the slab's own body is below it.
    expect(isClear(world, body(0, 0, 0))).toBe(true);
    // A body whose feet are below the slab's top is inside it, and is pushed up rather than through.
    const buried: ColliderBox = { center: [0, 0.5, 0], half: [1, 0.5, 1], yaw: 0 };
    const sunk = buildColliderWorld([buried]);
    expect(isClear(sunk, body(0, 0, 0))).toBe(false);
  });
});

describe("movement: no collision means no collision", () => {
  it("returns the point asked for, exactly, when nothing is in the way", () => {
    const result = moveBody(world, body(0, 0), 0.4, -0.25);
    // Bit for bit: a walk in an open room must not be nudged, or it reads as sticky.
    expect(result.x).toBe(0 + 0.4);
    expect(result.z).toBe(0 + -0.25);
    expect(result.blocked).toBe(false);
    expect(result.slid).toBe(false);
  });

  it("accepts a move that stops short of a wall without touching it", () => {
    // The wall's face is at z = -1.9; a body of radius 0.22 may reach z = -1.68.
    const result = moveBody(world, body(0, 0), 0, -1.5);
    expect(result.z).toBeCloseTo(-1.5, 6);
    expect(result.blocked).toBe(false);
  });
});

describe("movement: a wall stops you, and stops you at its face", () => {
  it("refuses a step into a wall, landing at contact rather than inside it", () => {
    const result = moveBody(world, body(0, 0), 0, -2.5);
    expect(result.blocked).toBe(true);
    expect(result.x).toBe(0);
    // One body radius out from the wall's face at z = -1.9.
    expect(result.z).toBeCloseTo(-1.68, 3);
  });

  it("says a head-on stop did not slide, and a diagonal one did", () => {
    expect(moveBody(world, body(0, 0), 0, -2.5).slid).toBe(false);
    expect(moveBody(world, body(0, -1.6), 0.5, -0.5).slid).toBe(true);
  });

  it("does not stick: standing against a wall, the move along it is unchanged", () => {
    const atWall = body(0, -1.68);
    const result = moveBody(world, atWall, 0.5, 0);
    expect(result.blocked).toBe(false);
    expect(result.x).toBe(0.5);
    expect(result.z).toBe(-1.68);
  });

  it("slides: a diagonal step into a wall keeps the part along it", () => {
    const result = moveBody(world, body(0, -1.6), 0.5, -0.5);
    expect(result.blocked).toBe(true);
    expect(result.slid).toBe(true);
    // The whole sideways half of the step survives; the half into the wall does not.
    expect(result.x).toBeCloseTo(0.5, 4);
    expect(result.z).toBeCloseTo(-1.68, 3);
  });

  it("slides along a turned wall too, rather than stopping dead", () => {
    // A 45° wall: its own Z faces (sin 45, cos 45), so its near face looks up-and-left.
    const diagonal: ColliderBox = { center: [0, 1.5, 0], half: [3, 1.5, 0.1], yaw: Math.PI / 4 };
    const turned = buildColliderWorld([diagonal]);
    const start = body(-0.32 * Math.SQRT1_2, -0.32 * Math.SQRT1_2);
    expect(isClear(turned, start)).toBe(true);
    // Straight at the wall: refused, and it does not get closer than a radius.
    const into = moveBody(turned, start, 0.5 * Math.SQRT1_2, 0.5 * Math.SQRT1_2);
    expect(into.blocked).toBe(true);
    expect(into.slid).toBe(false);
    expect(Math.hypot(into.x, into.z)).toBeCloseTo(0.32, 3);
    // Along its face: allowed, and it really did travel.
    const along = moveBody(turned, start, 0.4 * Math.SQRT1_2, -0.4 * Math.SQRT1_2);
    expect(along.blocked).toBe(false);
    expect(Math.hypot(along.x - start.x, along.z - start.z)).toBeCloseTo(0.4, 4);
  });
});

describe("movement: a doorway is not a wall", () => {
  it("walks straight through the 1 m gap in the west wall", () => {
    const result = moveBody(world, body(0, 0), -3, 0);
    expect(result.blocked).toBe(false);
    expect(result.x).toBe(-3);
    expect(result.z).toBe(0);
  });

  it("does not walk through the wall beside the doorway", () => {
    const result = moveBody(world, body(0, 1.2), -3, 0);
    expect(result.blocked).toBe(true);
    expect(result.x).toBeCloseTo(-2 + 0.1 + RADIUS, 3);
  });
});

describe("movement: a long step cannot pass through a thin wall", () => {
  it("splits a 5 m move into steps short enough to be stopped", () => {
    const result = moveBody(world, body(0, 0), 0, -5);
    expect(result.blocked).toBe(true);
    // Stopped at the near wall rather than arriving inside the far one (or past it).
    expect(result.z).toBeGreaterThan(-2);
    expect(result.z).toBeCloseTo(-1.68, 3);
  });

  it("would tunnel if a step were allowed to be longer than the wall is thick: this is why the default splits", () => {
    const oneStep = moveBody(world, body(0, 0), 0, -5, { stride: 5 });
    // Both ends of a single step are clear, so the wall is never seen. The split is the whole guard.
    expect(oneStep.blocked).toBe(false);
    expect(oneStep.z).toBe(-5);
  });
});

describe("the floor detector returns the surface under a point", () => {
  it("finds the slab top under the middle of the room", () => {
    const hit = floorUnder(world, 0, 0, { belowY: 0.3, minY: -1 });
    expect(hit?.y).toBe(0);
  });

  it("prefers the highest walkable surface under the point", () => {
    const mezzanine: ColliderBox = { center: [0, 1.1, 0], half: [2, 0.1, 2], yaw: 0, floor: true };
    const withMezzanine = buildColliderWorld([SLAB, mezzanine]);
    // From above the mezzanine the mezzanine is the floor; from below it, the slab is.
    expect(floorUnder(withMezzanine, 0, 0, { belowY: 1.3, minY: -1 })?.y).toBeCloseTo(1.2, 6);
    expect(floorUnder(withMezzanine, 0, 0, { belowY: 0.3, minY: -1 })?.y).toBe(0);
  });

  it("returns nothing past the edge of the slab, so a caller can fall back to the storey", () => {
    expect(floorUnder(world, 6, 0, { belowY: 0.3, minY: -1 })).toBeNull();
  });

  it("ignores a slab above the band: you walk on the storey you are on", () => {
    const upstairs: ColliderBox = { center: [0, 4.2, 0], half: [5, 0.1, 5], yaw: 0, floor: true };
    const twoStoreys = buildColliderWorld([SLAB, upstairs]);
    expect(floorUnder(twoStoreys, 0, 0, { belowY: 0.3, minY: -0.2 })?.y).toBe(0);
  });

  it("does not treat a wall top as a floor", () => {
    // The wall on its own: its top face is at y = 3 and nothing below it is walkable.
    const wallOnly = buildColliderWorld([WALL_A]);
    expect(floorUnder(wallOnly, 0, -2, { belowY: 3.5, minY: -1 })).toBeNull();
  });
});

/** A rectangular block as twelve triangles, in the mesh's own frame. */
function blockTriangles(lo: [number, number, number], hi: [number, number, number]): { positions: number[]; indices: number[] } {
  const [x0, y0, z0] = lo;
  const [x1, y1, z1] = hi;
  const corners: [number, number, number][] = [
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
    [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
  ];
  const quads = [
    [0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0],
  ];
  const positions: number[] = [];
  const indices: number[] = [];
  for (const corner of corners) positions.push(...corner);
  for (const quad of quads) {
    const [a, b, c, d] = quad as [number, number, number, number];
    indices.push(a, b, c, a, c, d);
  }
  return { positions, indices };
}

describe("a mesh wall keeps its doorway", () => {
  /** A wall body as the viewer draws one: left of the door, right of the door, and the lintel over it. */
  function wallWithDoor(): ColliderBox[] {
    const left = blockTriangles([-3, 0, -0.1], [-2.5, 3, 0.1]);
    const right = blockTriangles([-1.5, 0, -0.1], [3, 3, 0.1]);
    const lintel = blockTriangles([-2.5, 2.1, -0.1], [-1.5, 3, 0.1]);
    return [left, right, lintel].flatMap((mesh) => boxesOfTriangles(mesh.positions, mesh.indices));
  }

  const meshWorld = buildColliderWorld([SLAB, ...wallWithDoor()]);

  it("splits one mesh into many boxes rather than one box round the whole wall", () => {
    const boxes = wallWithDoor();
    expect(boxes.length).toBeGreaterThan(20);
  });

  it("walks through the 1 m door", () => {
    const result = moveBody(meshWorld, body(-2, 0), 0, -3);
    expect(result.blocked).toBe(false);
    expect(result.z).toBe(-3);
  });

  it("does not walk through the wall either side of the door", () => {
    expect(moveBody(meshWorld, body(-2.8, 0), 0, -3).blocked).toBe(true);
    expect(moveBody(meshWorld, body(-1.7, 0), 0, -3).blocked).toBe(true);
  });

  it("does not walk through the lintel over the door", () => {
    // The same doorway, seen by a body tall enough to reach it: the lintel is solid.
    const tall = { x: -2, z: 0, radius: RADIUS, minY: 2.2, maxY: 3.0 };
    expect(isClear(meshWorld, { ...tall, z: -0.05 })).toBe(false);
  });
});

describe("boxes from triangles", () => {
  it("marks a flat cap as floor and a wall face as not", () => {
    const cap = boxesOfTriangles([0, 0, 0, 1, 0, 0, 0, 0, 1], [0, 1, 2], { floor: true });
    expect(cap).toHaveLength(1);
    expect(cap[0]?.floor).toBe(true);
    const face = boxesOfTriangles([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2], { floor: true });
    expect(face[0]?.floor).toBeUndefined();
  });

  it("puts a triangle's box where the mesh is, turned by the mesh's yaw", () => {
    // A turned mesh: its own X runs along world -Z, so a 1 m triangle spans z, not x.
    const [box] = boxesOfTriangles([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2], { center: [5, 0, 5], yaw: Math.PI / 2 });
    expect(box?.center[0]).toBeCloseTo(5, 6);
    expect(box?.center[2]).toBeCloseTo(4.5, 6);
    expect(box?.center[1]).toBeCloseTo(0.5, 6);
    expect(box?.yaw).toBe(Math.PI / 2);
  });

  it("falls back to one box round the whole body past the triangle budget", () => {
    // 2049 triangles: more than the world keeps one box each for.
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < 2049; i++) {
      const x = i * 0.01;
      positions.push(x, 0, 0, x + 0.005, 0, 0, x, 1, 0);
      indices.push(i * 3, i * 3 + 1, i * 3 + 2);
    }
    const boxes = boxesOfTriangles(positions, indices);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.half[0]).toBeCloseTo((2048 * 0.01 + 0.005) / 2, 4);
  });
});

describe("the world itself", () => {
  it("counts its boxes and its extent", () => {
    expect(world.boxCount).toBe(5);
    expect(world.minY).toBeCloseTo(-0.2, 6);
    expect(world.maxY).toBeCloseTo(3, 6);
  });

  it("survives being empty", () => {
    const empty = buildColliderWorld([]);
    expect(empty.boxCount).toBe(0);
    expect(isClear(empty, body(0, 0))).toBe(true);
    expect(moveBody(empty, body(0, 0), 1, 1)).toMatchObject({ blocked: false, slid: false });
    expect(moveBody(empty, body(0, 0), 0.1, 0.1)).toEqual({ x: 0.1, z: 0.1, blocked: false, slid: false });
    expect(floorUnder(empty, 0, 0, { belowY: 1, minY: -1 })).toBeNull();
  });
});
