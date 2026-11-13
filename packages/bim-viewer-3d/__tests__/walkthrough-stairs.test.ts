/** @jest-environment node */
/**
 * Taking the stairs — Review Focus 4 of
 * `docs/superpowers/plans/2026-11-10-pascal-adoptions.md`: "a walker must be
 * able to climb a stair; a stair that behaves like a wall makes the walkthrough
 * useless".
 *
 * **What a stair is here.** The Architecture add-on draws one as a body of
 * upright prisms, one prism per tread, each rising from the storey floor to the
 * top of its own riser (`bim-pack-architecture/src/kinds.ts` `STAIR_KIND_ROW`).
 * The viewer turns that body into one mesh solid in render group `structure`
 * (`native-geometry.ts` `kindShapeSolids` -> `prismsSolid`), so a stair is not a
 * tilted solid and there is no slope to keep: it is a run of steps. A tread's
 * top is a floor and `WALK_STEP_HEIGHT_M` does the climbing — provided the
 * collider knows the treads are floors, which is what these tests pin down.
 *
 * The fixture is the real thing: a `create_element` stair on a two-level model,
 * through the kernel, so the geometry is the geometry the viewer draws, not a
 * hand-made box that happens to look like a stair.
 */
import { installFirstPartyAddOns } from "@permitzip/bim-first-party";
import { boxTop, buildColliderWorld, type ColliderBox } from "@permitzip/bim-geometry";
import type { ModelState } from "@permitzip/bim-kernel";
import { twoLevels, type Log } from "../../bim-kernel/__tests__/a13a-fixtures";
import { elementSolids, type Solid } from "../src/native-geometry";
import { colliderBoxesOf } from "../src/walkthrough-collider";
import { storeyForFeet } from "../src/walkthrough-stairs";
import { WALK_EYE_HEIGHT_M, WALK_STEP_HEIGHT_M, Walker, type WalkScene } from "../src/walkthrough";

installFirstPartyAddOns();

/** The stair the tests walk: from the L1 floor at x = 0 to x = 6.16 m, 1.2 m wide, rising to L2 at 4 m. */
const STAIR_RUN_MM = 6160;
/** `MAX_RISER_MM` is 178, so 4000 mm of rise is 23 risers of 173.9 mm — the pack's own numbers. */
const RISERS = Math.ceil(4000 / 178);
const RISER_M = 4000 / RISERS / 1000;
/** A stair of n risers has n - 1 treads, and the last tread is one riser below the storey above. */
const TREADS = RISERS - 1;
const TOP_TREAD_M = TREADS * RISER_M;

function stairModel(): Log {
  const m = twoLevels("w22-stairs");
  m.ok({
    type: "create_element",
    elementId: "stair",
    kind: "architecture.stair",
    levelId: "L1",
    size: { widthMm: 1200 },
    placement: { kind: "line", start: { x: 0, y: 0 }, end: { x: STAIR_RUN_MM, y: 0 } },
  });
  return m;
}

function stairSolid(m: Log): Solid {
  const el = m.head.elements["stair"];
  if (!el) throw new Error("the model has no stair");
  const [solid] = elementSolids(el, undefined, m.head as ModelState);
  if (!solid) throw new Error("the stair has no solid");
  return solid;
}

/** The storey floor the stair rises from, and the walker's own floor where no slab is drawn. */
function sceneOf(boxes: readonly ColliderBox[], groundY = 0): WalkScene {
  return { collider: buildColliderWorld(boxes, { cellSize: 2 }), groundY };
}

/**
 * The walker at the foot of the flight, on its centreline, facing up it: the
 * stair runs along +X in the scene, and yaw = -PI/2 takes "forward" to +X.
 */
function walkerAtFootOfStair(): Walker {
  return new Walker({ x: -0.15, z: 0, yaw: -Math.PI / 2, eyeY: WALK_EYE_HEIGHT_M });
}

/**
 * Walk forward until the feet reach `stopAt`, recording every height they came
 * to rest at. Returns those heights in order: one per tread climbed.
 */
function climb(walker: Walker, stopAt: number, maxSeconds = 20, dt = 1 / 60): number[] {
  const rests: number[] = [];
  let previous = walker.state().feetY;
  walker.hold("forward", true);
  for (let frame = 0; frame < Math.round(maxSeconds / dt); frame++) {
    walker.advance(dt);
    const feet = walker.state().feetY;
    if (feet !== previous) {
      rests.push(feet);
      previous = feet;
    }
    if (feet >= stopAt) break;
  }
  walker.releaseAll();
  return rests;
}

describe("what a stair is: a run of upright steps, one prism per tread", () => {
  it("draws as one mesh solid in the structure group, with no pitch to keep", () => {
    const solid = stairSolid(stairModel());
    expect(solid).toMatchObject({ group: "structure", shape: "mesh", elementId: "stair" });
    // Not a tilted slab: there is no slope to keep as a ramp, only treads to climb.
    expect(solid.pitch).toBeUndefined();
    // The body climbs in steps, which is what tells the collider its caps are treads.
    expect(solid.steps).toBe(true);
  });

  it("makes every tread top a floor, one riser apart, and nothing else", () => {
    const floors = colliderBoxesOf(stairSolid(stairModel())).filter((box) => box.floor === true);
    expect(floors.length).toBeGreaterThan(0);
    // The stair's own underside is a flat face at the storey floor; above it, one tread per riser.
    const tops = [...new Set(floors.map((box) => Math.round(boxTop(box) * 1e4) / 1e4))].sort((a, b) => a - b);
    expect(tops).toHaveLength(TREADS + 1);
    expect(tops[0]).toBe(0);
    expect(tops[1]).toBeCloseTo(RISER_M, 4);
    expect(tops[tops.length - 1]).toBeCloseTo(TOP_TREAD_M, 4);
  });
});

describe("Review Focus 4: a stair raises the feet; a wall does not", () => {
  it("climbs a stair one riser per tread", () => {
    const stair = stairSolid(stairModel());
    const walker = walkerAtFootOfStair();
    walker.setScene(sceneOf(colliderBoxesOf(stair)));
    const rests = climb(walker, TOP_TREAD_M);
    // Every tread was climbed, in order, a riser at a time.
    expect(rests).toHaveLength(TREADS);
    for (let i = 0; i < rests.length; i++) expect(rests[i]).toBeCloseTo((i + 1) * RISER_M, 3);
    // Riser x the number of steps climbed: the whole flight.
    expect(walker.state().feetY).toBeCloseTo(TREADS * RISER_M, 3);
    expect(walker.state().onFloor).toBe(true);
  });

  it("does not raise the feet at all walking into a wall", () => {
    // The room the walkthrough's own test uses: a floor at y = 0 and a wall at z = -4.
    const boxes: ColliderBox[] = [
      { center: [0, -0.1, 0], half: [4, 0.1, 4], yaw: 0, floor: true },
      { center: [0, 1.5, -4], half: [4, 1.5, 0.1], yaw: 0 },
    ];
    const walker = new Walker({ x: 0, z: 0, yaw: 0, eyeY: WALK_EYE_HEIGHT_M });
    walker.setScene(sceneOf(boxes));
    walker.hold("forward", true);
    for (let frame = 0; frame < 300; frame++) walker.advance(1 / 60);
    walker.releaseAll();
    expect(walker.state().blocked).toBe(true);
    expect(walker.state().feetY).toBe(0);
  });

  it("climbs a step under WALK_STEP_HEIGHT_M and is stopped by one over it", () => {
    // A landing whose near edge is at x = 1, 2 m deep, so a walk from x = -1 ends on it rather than past it.
    const landing = (top: number): ColliderBox => ({ center: [3, top - 0.05, 0], half: [2, 0.05, 2], yaw: 0, floor: true });
    const withStep = (top: number): Walker => {
      const walker = new Walker({ x: -1, z: 0, yaw: -Math.PI / 2, eyeY: WALK_EYE_HEIGHT_M });
      walker.setScene(sceneOf([{ center: [0, -0.1, 0], half: [6, 0.1, 2], yaw: 0, floor: true }, landing(top)]));
      walker.hold("forward", true);
      for (let frame = 0; frame < 120; frame++) walker.advance(1 / 60);
      walker.releaseAll();
      return walker;
    };
    const under = WALK_STEP_HEIGHT_M - 0.01;
    const over = WALK_STEP_HEIGHT_M + 0.01;
    const climbed = withStep(under).state();
    expect(climbed.feetY).toBeCloseTo(under, 3);
    expect(climbed.x).toBeGreaterThan(1);
    // A step this high is a wall: the feet stay on the floor and the body is stopped short of it.
    const stopped = withStep(over).state();
    expect(stopped.feetY).toBe(0);
    expect(stopped.blocked).toBe(true);
    expect(stopped.x).toBeLessThan(1);
  });
});

describe("the storey changes when the walker goes up", () => {
  /** The storey above the stair, as the viewer builds it: its own slab. */
  function upstairs(): WalkScene {
    const slab: ColliderBox = { center: [4, 3.95, 0], half: [5, 0.05, 2], yaw: 0, floor: true };
    return sceneOf([slab], 4);
  }

  const floors = new Map([
    ["L1", 0],
    ["L2", 4],
  ]);

  it("says which storey the feet are on, one step before they arrive", () => {
    expect(storeyForFeet(floors, 0)).toBe("L1");
    expect(storeyForFeet(floors, 1.9)).toBe("L1");
    // On the top tread, one riser below the storey above: that is where the walker is about to be.
    expect(storeyForFeet(floors, TOP_TREAD_M)).toBe("L2");
    expect(storeyForFeet(floors, 4)).toBe("L2");
    expect(storeyForFeet(floors, 6.5)).toBe("L2");
    // No storey below the lowest floor: nothing to stand on, and nothing to change to.
    expect(storeyForFeet(new Map(), 0)).toBeNull();
  });

  it("keeps the walker off the storey below once they have climbed: the feet step onto the landing", () => {
    const walker = walkerAtFootOfStair();
    walker.setScene(sceneOf(colliderBoxesOf(stairSolid(stairModel()))));
    climb(walker, TOP_TREAD_M);
    expect(storeyForFeet(floors, walker.state().feetY)).toBe("L2");
    // The viewer hands the walker the storey it is now on, as it would on a frame.
    walker.changeScene(upstairs());
    expect(walker.state().feetY).toBeCloseTo(4, 3);
    expect(walker.state().onFloor).toBe(true);
    // Walking off the top of the flight now walks the storey above: nothing drops to the floor below.
    walker.hold("forward", true);
    for (let frame = 0; frame < 60; frame++) walker.advance(1 / 60);
    walker.releaseAll();
    expect(walker.state().x).toBeGreaterThan(6);
    expect(walker.state().feetY).toBeCloseTo(4, 3);
    expect(walker.state().onFloor).toBe(true);
  });

  it("never drops the feet when the storey changes under them: gravity is what falls", () => {
    const walker = walkerAtFootOfStair();
    walker.setScene(sceneOf(colliderBoxesOf(stairSolid(stairModel()))));
    climb(walker, TOP_TREAD_M);
    // A storey whose floor is far below these feet (the flight's own storey, handed back in error).
    walker.changeScene(sceneOf([], 0));
    expect(walker.state().feetY).toBeCloseTo(TOP_TREAD_M, 3);
  });
});
