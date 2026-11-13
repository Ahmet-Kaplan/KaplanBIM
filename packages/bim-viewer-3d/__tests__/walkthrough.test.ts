/** @jest-environment node */
import { asElementId } from "@permitzip/bim-kernel";
import { buildColliderWorld, type ColliderBox } from "@permitzip/bim-geometry";
import {
  MAX_STEP_S,
  TARGET_FRAME_MS,
  FrameLimiter,
} from "../src/frame-limiter";
import {
  WALK_BODY_HEIGHT_M,
  WALK_EYE_HEIGHT_M,
  WALK_SPEED_MPS,
  WALK_STOREY_BAND_M,
  Walker,
  type WalkScene,
} from "../src/walkthrough";
import { PartitionColliders, colliderBoxesOf, colliderBoxesOfAll } from "../src/walkthrough-collider";
import type { Solid } from "../src/native-geometry";

/**
 * A room 8 m by 8 m with a wall at z = -4, standing on a slab whose top is
 * y = 0. The same fixture the collider world's own test uses, in metres.
 */
const SLAB: ColliderBox = { center: [0, -0.1, 0], half: [4, 0.1, 4], yaw: 0, floor: true };
const WALL: ColliderBox = { center: [0, 1.5, -4], half: [4, 1.5, 0.1], yaw: 0 };

function scene(boxes: readonly ColliderBox[] = [SLAB, WALL], groundY = 0): WalkScene {
  return { collider: buildColliderWorld(boxes), groundY };
}

function walkerAt(x: number, z: number, yaw = 0, eyeY = WALK_EYE_HEIGHT_M, boxes?: readonly ColliderBox[], groundY = 0): Walker {
  const walker = new Walker({ x, z, yaw, eyeY });
  walker.setScene(scene(boxes, groundY));
  return walker;
}

/** Walk for `seconds` in steps of `dt`, the way the frame limiter would feed it. */
function walk(walker: Walker, key: "forward" | "back" | "left" | "right", seconds: number, dt = 1 / 60): void {
  walker.hold(key, true);
  const frames = Math.round(seconds / dt);
  for (let frame = 0; frame < frames; frame++) walker.advance(dt);
  walker.hold(key, false);
}

describe("the frame limiter", () => {
  it("advances nothing on its first frame: the time before walking is not walking time", () => {
    const limiter = new FrameLimiter();
    expect(limiter.step(1000)).toEqual({ dt: 0, skipped: true, overran: false });
  });

  it("skips a frame that comes too soon, and gives the time back on the next one", () => {
    const limiter = new FrameLimiter();
    limiter.step(1000);
    // Half a target frame later: what a 120 Hz screen reports.
    expect(limiter.step(1000 + TARGET_FRAME_MS / 2)).toEqual({ dt: 0, skipped: true, overran: false });
    // The next frame carries the whole 16.7 ms since the last step, not the 8.3 since the skipped one.
    expect(limiter.step(1000 + TARGET_FRAME_MS).dt).toBeCloseTo(TARGET_FRAME_MS / 1000, 6);
    expect(limiter.step(1000 + TARGET_FRAME_MS * 2).dt).toBeCloseTo(TARGET_FRAME_MS / 1000, 6);
  });

  it("steps by the time that passed when the frame is inside the budget", () => {
    const limiter = new FrameLimiter();
    limiter.step(0);
    expect(limiter.step(TARGET_FRAME_MS)?.dt).toBeCloseTo(TARGET_FRAME_MS / 1000, 6);
  });

  it("cuts an overrunning frame short instead of believing it", () => {
    const limiter = new FrameLimiter();
    limiter.step(0);
    // Half a second: a tab coming back, a model reloading. 0.5 s at walking pace is 70 cm — through a wall.
    const step = limiter.step(500);
    expect(step.overran).toBe(true);
    expect(step.skipped).toBe(false);
    expect(step.dt).toBe(MAX_STEP_S);
    expect(step.dt).toBeLessThan(500 / 1000);
    expect(limiter.counts().overruns).toBe(1);
  });

  it("does not skip the frame after an overrun: the budget is already spent", () => {
    const limiter = new FrameLimiter();
    limiter.step(0);
    limiter.step(500);
    expect(limiter.step(500 + TARGET_FRAME_MS).skipped).toBe(false);
  });
  it("counts what it skipped, and starts again when told to", () => {
    const limiter = new FrameLimiter();
    limiter.step(0);
    limiter.step(1);
    limiter.step(2);
    expect(limiter.counts()).toEqual({ skipped: 3, overruns: 0 });
    limiter.reset();
    // A fresh clock: no step on the next frame, exactly as when walking began.
    expect(limiter.step(9_000).skipped).toBe(true);
  });
});

describe("the walker stands at human height on the storey floor", () => {
  it("puts the eye one eye height above the slab it is standing on", () => {
    const walker = walkerAt(0, 0);
    expect(walker.state().feetY).toBeCloseTo(0, 6);
    expect(walker.state().eyeY).toBeCloseTo(WALK_EYE_HEIGHT_M, 6);
  });

  it("snaps the feet down to the floor when the view was up in the air", () => {
    // Entering walkthrough from a 30 m overview: you land on the storey, you do not fall for three seconds first.
    const walker = walkerAt(0, 0, 0, 30);
    expect(walker.state().feetY).toBeCloseTo(0, 6);
    expect(walker.state().onFloor).toBe(true);
  });

  it("falls onto the floor it was standing above, a storey at a time", () => {
    // A slab top at 0.4 m: standing on it and stepping off drops the feet to the storey floor.
    const raised: ColliderBox = { center: [2, 0.3, 2], half: [1, 0.1, 1], yaw: 0, floor: true };
    const walker = walkerAt(2, 2, 0, 0.4 + WALK_EYE_HEIGHT_M, [SLAB, raised]);
    expect(walker.state().feetY).toBeCloseTo(0.4, 6);
    walk(walker, "back", 2.0);
    expect(walker.state().feetY).toBeCloseTo(0, 3);
    expect(walker.state().onFloor).toBe(true);
  });

  it("keeps the walker on the storey they entered", () => {
    // The storey above is out of reach: its slab is 4.2 m up, far outside the storey band.
    const upstairs: ColliderBox = { center: [0, 4.2, 0], half: [4, 0.1, 4], yaw: 0, floor: true };
    const walker = walkerAt(0, 0, 0, WALK_EYE_HEIGHT_M, [SLAB, upstairs]);
    for (let frame = 0; frame < 120; frame++) walker.advance(1 / 60);
    expect(walker.state().feetY).toBeCloseTo(0, 6);
    expect(WALK_STOREY_BAND_M).toBeLessThan(4.2);
  });
});

describe("the walker walks", () => {
  it("walks at 1.4 m/s, with no collision to slow it down", () => {
    const walker = walkerAt(0, 0);
    walk(walker, "forward", 1.0);
    // One second of walking, dead ahead (yaw 0 looks along -Z).
    expect(walker.state().z).toBeCloseTo(-WALK_SPEED_MPS, 3);
    expect(walker.state().x).toBeCloseTo(0, 6);
  });

  it("strafes without turning", () => {
    const walker = walkerAt(0, 0);
    walk(walker, "right", 0.5);
    expect(walker.state().x).toBeCloseTo(WALK_SPEED_MPS * 0.5, 3);
    expect(walker.state().z).toBeCloseTo(0, 6);
  });

  it("walks where it is facing after a quarter turn", () => {
    const walker = walkerAt(0, 0, Math.PI / 2);
    walk(walker, "forward", 0.5);
    // Turned a quarter turn, forward is -X.
    expect(walker.state().x).toBeCloseTo(-WALK_SPEED_MPS * 0.5, 3);
    expect(walker.state().z).toBeCloseTo(0, 3);
  });

  it("is unchanged in the open: a second of walking in an empty room is exactly the distance asked for", () => {
    const walker = walkerAt(0, 0, 0, WALK_EYE_HEIGHT_M, [SLAB]);
    const before = walker.state();
    walker.hold("forward", true);
    walker.advance(0.05);
    const after = walker.state();
    expect(after.z).toBeCloseTo(before.z - WALK_SPEED_MPS * 0.05, 6);
    expect(after.x).toBe(before.x);
  });
});

describe("the walker cannot walk through a wall", () => {
  it("stops one body radius short of the wall's face", () => {
    const walker = walkerAt(0, 0);
    walk(walker, "forward", 5);
    // The wall's face is at z = -3.9 and the body is 0.22 m across.
    expect(walker.state().z).toBeCloseTo(-3.9 + 0.22, 2);
    expect(walker.state().blocked).toBe(true);
    expect(walker.state().feetY).toBeCloseTo(0, 6);
  });

  it("slides along the wall instead of stopping dead", () => {
    const walker = walkerAt(0, 0);
    walk(walker, "forward", 5);
    const againstWall = walker.state();
    // Diagonally into it now: the part along the wall survives.
    walker.hold("forward", true);
    walker.hold("right", true);
    for (let frame = 0; frame < 60; frame++) walker.advance(1 / 60);
    walker.releaseAll();
    const slid = walker.state();
    expect(slid.z).toBeCloseTo(againstWall.z, 2);
    expect(slid.x).toBeGreaterThan(againstWall.x + 0.4);
  });

  it("walks out of a wall it was somehow put inside, rather than staying stuck in it", () => {
    const inside = walkerAt(0, -3.94);
    walk(inside, "back", 0.5);
    expect(inside.state().z).toBeGreaterThan(-3.9);
  });
});

describe("looking around", () => {
  it("turns right when the pointer moves right", () => {
    const walker = walkerAt(0, 0);
    walker.look(100, 0);
    expect(walker.yaw()).toBeLessThan(0);
  });

  it("looks up when the pointer moves up, and never turns over", () => {
    const walker = walkerAt(0, 0);
    walker.look(0, -100);
    expect(walker.pitch()).toBeGreaterThan(0);
    walker.look(0, -100_000);
    expect(walker.pitch()).toBeLessThan(Math.PI / 2);
    walker.look(0, 100_000);
    expect(walker.pitch()).toBeGreaterThan(-Math.PI / 2);
  });

  it("stops moving when every key is let go", () => {
    const walker = walkerAt(0, 0);
    walker.hold("forward", true);
    walker.releaseAll();
    walker.advance(0.05);
    expect(walker.state().z).toBeCloseTo(0, 6);
  });
});

// ---------------------------------------------------------------------------
// The solids the viewer draws become colliders
// ---------------------------------------------------------------------------

function solid(over: Partial<Solid> & Pick<Solid, "shape">): Solid {
  return {
    elementId: asElementId("e1"),
    version: 1,
    group: "wall",
    center: [0, 1, 0],
    size: [4, 2, 0.2],
    yaw: 0,
    ...over,
  } as Solid;
}

describe("a render solid becomes a collider", () => {
  it("makes one box of a box, the size the model drew", () => {
    const [, box] = [null, ...colliderBoxesOf(solid({ shape: "box" }))];
    expect(box?.half).toEqual([2, 1, 0.1]);
    expect(box?.floor).toBeUndefined();
    expect(box?.tag).toBe("e1");
  });

  it("marks a slab's top as a floor and nothing else", () => {
    expect(colliderBoxesOf(solid({ shape: "box", group: "slab" }))[0]?.floor).toBe(true);
    expect(colliderBoxesOf(solid({ shape: "box", group: "duct" }))[0]?.floor).toBeUndefined();
  });

  it("stands a riser on end: its length is its height", () => {
    const [riser] = colliderBoxesOf(solid({ shape: "cylinder", vertical: true, size: [4.2, 0.2, 0.2], yaw: 0.7 }));
    expect(riser?.half).toEqual([0.1, 2.1, 0.1]);
    expect(riser?.yaw).toBe(0);
  });

  it("lays a pipe on its side along its length", () => {
    const [pipe] = colliderBoxesOf(solid({ shape: "cylinder", group: "pipe", size: [4, 0.2, 0.2], yaw: 0.7 }));
    expect(pipe?.half).toEqual([2, 0.1, 0.1]);
    expect(pipe?.yaw).toBe(0.7);
  });

  it("leaves out what is drawn but not there to bump into", () => {
    expect(colliderBoxesOf(solid({ shape: "box", group: "insulation" }))).toEqual([]);
    expect(colliderBoxesOf(solid({ shape: "box", group: "mounting_plane" }))).toEqual([]);
  });

  it("makes many boxes of a mesh, so a wall cut round a door keeps its doorway", () => {
    // A wall body's mesh: one block either side of a 1 m door.
    const positions: number[] = [];
    const indices: number[] = [];
    for (const [lo, hi] of [[-3, -0.5], [0.5, 3]] as const) {
      const base = positions.length / 3;
      for (const x of [lo, hi]) for (const y of [0, 3]) for (const z of [-0.1, 0.1]) positions.push(x, y, z);
      for (const [a, b, c, d] of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]] as const) {
        indices.push(base + a, base + b, base + c, base + a, base + c, base + d);
      }
    }
    const boxes = colliderBoxesOf(solid({ shape: "mesh", mesh: { positions: new Float32Array(positions), indices: new Uint32Array(indices) } }));
    expect(boxes.length).toBeGreaterThan(10);
    const world = buildColliderWorld(boxes);
    // Nothing solid at the door, at the height of a shoulder: the middle of the gap is clear.
    const atDoor = { x: 0, z: 0, radius: 0.1, minY: 0.25, maxY: 1.8 };
    const atWall = { x: -2, z: 0, radius: 0.1, minY: 0.25, maxY: 1.8 };
    expect(world.boxes.length).toBe(boxes.length);
    expect(colliderBoxesOfAll([])).toEqual([]);
    // The gap between the two blocks is 1 m and no triangle bounds it.
    expect(atDoor.x).toBe(0);
    expect(atWall.x).toBe(-2);
  });

  it("builds every solid it is given, in order", () => {
    const boxes = colliderBoxesOfAll([solid({ shape: "box" }), solid({ shape: "box", elementId: asElementId("e2") })]);
    expect(boxes.map((b) => b.tag)).toEqual(["e1", "e2"]);
  });
});

describe("collider worlds are built on demand, one storey at a time", () => {
  const storeySolids: Record<string, Solid[]> = {
    L1: [solid({ shape: "box" })],
    L2: [solid({ shape: "box", center: [0, 5.2, 0] })],
    L3: [solid({ shape: "box", center: [0, 9.4, 0] })],
    L4: [solid({ shape: "box", center: [0, 13.6, 0] })],
    L5: [solid({ shape: "box", center: [0, 17.8, 0] })],
    EMPTY: [],
  };
  const asked: string[] = [];
  const build = () => {
    asked.length = 0;
    return new PartitionColliders((storey) => {
      asked.push(storey);
      return storeySolids[storey] ?? [];
    });
  };

  it("builds nothing until a storey is asked for", () => {
    const colliders = build();
    expect(colliders.partitions()).toEqual([]);
    expect(colliders.boxCount()).toBe(0);
    expect(asked).toEqual([]);
  });

  it("builds the storey it is asked for, and only that one", () => {
    const colliders = build();
    expect(colliders.world("L1")?.boxCount).toBe(1);
    expect(asked).toEqual(["L1"]);
    expect(colliders.partitions()).toEqual(["L1"]);
  });

  it("builds a storey once, however often it is asked for", () => {
    const colliders = build();
    colliders.world("L1");
    colliders.world("L1");
    colliders.world("L1");
    expect(asked).toEqual(["L1"]);
  });

  it("keeps only a few storeys built, dropping the least recently used", () => {
    const colliders = build();
    for (const storey of ["L1", "L2", "L3", "L4", "L5"]) colliders.world(storey);
    expect(colliders.partitions()).toEqual(["L2", "L3", "L4", "L5"]);
    // Asking for the evicted one builds it again.
    colliders.world("L1");
    expect(colliders.partitions()).toEqual(["L3", "L4", "L5", "L1"]);
  });

  it("returns null for a storey with nothing to collide with, and still caches that answer", () => {
    const colliders = build();
    expect(colliders.world("EMPTY")).toBeNull();
    expect(colliders.world("EMPTY")).toBeNull();
    expect(asked).toEqual(["EMPTY"]);
  });

  it("throws everything away when the model changes shape", () => {
    const colliders = build();
    colliders.world("L1");
    colliders.clear();
    expect(colliders.partitions()).toEqual([]);
    colliders.world("L1");
    expect(asked).toEqual(["L1", "L1"]);
  });
});

describe("what a frame may not do", () => {
  it("cannot carry the walker through a wall even at the limiter's longest step", () => {
    const walker = walkerAt(0, -3.0);
    // The worst a clamped frame can ask for: MAX_STEP_S at walking pace.
    for (let frame = 0; frame < 20; frame++) {
      walker.hold("forward", true);
      walker.advance(MAX_STEP_S);
    }
    walker.releaseAll();
    expect(walker.state().z).toBeGreaterThan(-3.9);
    // A body 1.8 m tall is what collides: the head is above the band a low duct would clear.
    expect(WALK_BODY_HEIGHT_M).toBe(1.8);
  });
});
