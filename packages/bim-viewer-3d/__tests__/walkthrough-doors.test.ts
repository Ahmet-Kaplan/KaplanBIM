/**
 * An open door, and a shut one. `docs/superpowers/plans/2026-11-10-pascal-adoptions.md`
 * calls this Review Focus 3: "a closed door stops you, an open one does not", and
 * names the worst outcome — a door that is drawn in a wall but that a person walks
 * through anyway. These two tests are the task's reason to exist.
 */
import { buildColliderWorld, type ColliderBox } from "@permitzip/bim-geometry";
import { OpenDoors } from "../src/walkthrough-mechanisms";
import { Walker, WALK_BODY_RADIUS_M, type WalkScene } from "../src/walkthrough";

/**
 * A room 8 m square with a 1 m doorway in its south wall, in metres.
 *
 * The doorway is left open as a *gap* between four wall boxes rather than made by
 * a door box: that is what the viewer produces for a wall cut round its openings
 * (`boxesOfTriangles`), and it proves the walker uses the gap. The door's own
 * leaves are then a separate box the doorway holds.
 */
const WALL = 0.2;
const ROOM = 8;
const DOORWAY = 1;

const wall = (tag: string, x: number, z: number, w: number, d: number): ColliderBox => ({
  // The collider's own shape: a centre, half extents along its own X/Y/Z, and a
  // turn. Walls run floor to ceiling here, so the half height is 2 m about y=1.
  center: [x, 1, z],
  half: [w / 2, 2, d / 2],
  yaw: 0,
  tag,
});

/** Four walls round a room with a 1 m doorway in the south one, and the door's leaves filling it. */
function roomWithDoor(): readonly ColliderBox[] {
  const half = ROOM / 2;
  const side = (ROOM - DOORWAY) / 2;
  return [
    // North, east, west: solid.
    wall("w-north", 0, -half, ROOM, WALL),
    wall("w-east", half, 0, WALL, ROOM),
    wall("w-west", -half, 0, WALL, ROOM),
    // South: two stubs with the doorway between them.
    wall("w-south-w", -half + side / 2, half, side, WALL),
    wall("w-south-e", half - side / 2, half, side, WALL),
    // The door's own leaves, filling that gap. This is the box the whole task is
    // about: drawn in the wall's void, tagged with the door's element id, and in
    // the way exactly while the door is shut.
    wall("door-1", 0, half, DOORWAY, WALL),
  ];
}

function sceneOf(boxes: readonly ColliderBox[], doors: OpenDoors): WalkScene {
  return {
    collider: buildColliderWorld(boxes, { cellSize: 2 }),
    groundY: 0,
    passable: doors.passable,
  };
}

function walkerAtSouthDoorway(): Walker {
  // Inside the room, 2 m north of the doorway, facing south (+Z) — the scene's
  // "south" is +Z, which is where the gap is.
  return new Walker({ x: 0, z: ROOM / 2 - 2, yaw: Math.PI, eyeY: 1.62 });
}

/** Walk south for this many seconds at the walker's own speed. */
function walkSouth(walker: Walker, scene: WalkScene, seconds: number): void {
  walker.setScene(scene);
  walker.hold("forward", true);
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) walker.advance(step);
  walker.releaseAll();
}

describe("a closed door stops you, an open one does not", () => {
  it("keeps a walker inside a room whose only way out is a shut door", () => {
    const doors = new OpenDoors(["door-1"]);
    const scene = sceneOf(roomWithDoor(), doors);
    const walker = walkerAtSouthDoorway();
    walkSouth(walker, scene, 4);
    // The gap is at +Z; a shut door's leaves fill it. The walker must not be past
    // the wall line.
    expect(walker.state().z).toBeLessThan(ROOM / 2);
    expect(walker.state().blocked).toBe(true);
  });

  it("lets the same walker out once the door is open", () => {
    const doors = new OpenDoors(["door-1"]);
    expect(doors.set("door-1", true)).toBe(true);
    const scene = sceneOf(roomWithDoor(), doors);
    const walker = walkerAtSouthDoorway();
    walkSouth(walker, scene, 4);
    // Through the doorway and out the other side: 4 s at 1.4 m/s is 5.6 m of
    // travel from 2 m inside, so anything past the wall line is out.
    expect(walker.state().z).toBeGreaterThan(ROOM / 2);
  });

  it("is the same walker, the same world and only the door differing", () => {
    // The two tests above must differ in one thing only, or the pair proves
    // nothing about the door.
    const shut = new OpenDoors(["door-1"]);
    const open = new OpenDoors(["door-1"]);
    expect(shut.openIds()).toEqual([]);
    expect(open.set("door-1", true)).toBe(true);
    expect(shut.openIds()).toEqual([]);
  });
});

describe("only a door may be opened", () => {
  it("refuses an id the model did not call a door", () => {
    const doors = new OpenDoors(["door-1"]);
    expect(doors.set("w-south-w", true)).toBe(false);
    expect(doors.isOpen("w-south-w")).toBe(false);
    expect(doors.openIds()).toEqual([]);
  });

  it("toggles a door, and closes it again", () => {
    const doors = new OpenDoors(["door-1", "door-2"]);
    expect(doors.toggle("door-1")).toBe(true);
    expect(doors.isOpen("door-1")).toBe(true);
    expect(doors.toggle("door-1")).toBe(true);
    expect(doors.isOpen("door-1")).toBe(false);
  });

  it("shuts everything when the walkthrough ends", () => {
    const doors = new OpenDoors(["door-1", "door-2"]);
    doors.set("door-1", true);
    doors.set("door-2", true);
    expect(doors.openIds()).toHaveLength(2);
    doors.shutAll();
    expect(doors.openIds()).toEqual([]);
  });
});

describe("the passable predicate is narrow on purpose", () => {
  it("never passes a box with no tag", () => {
    const doors = new OpenDoors(["door-1"]);
    doors.set("door-1", true);
    // Geometry that cannot say which element it came from has no business
    // disappearing.
    expect(doors.passable({})).toBe(false);
  });

  it("passes only boxes whose tag is an open door", () => {
    const doors = new OpenDoors(["door-1", "door-2"]);
    doors.set("door-1", true);
    expect(doors.passable({ tag: "door-1" })).toBe(true);
    expect(doors.passable({ tag: "door-2" })).toBe(false);
    expect(doors.passable({ tag: "w-south-w" })).toBe(false);
  });
});

describe("nothing else moved", () => {
  it("leaves an untagged world walking exactly as it did", () => {
    // With no `passable`, a move into the shut doorway is refused — the behaviour
    // before this task, unchanged.
    const scene: WalkScene = { collider: buildColliderWorld(roomWithDoor(), { cellSize: 2 }), groundY: 0 };
    const walker = walkerAtSouthDoorway();
    walkSouth(walker, scene, 4);
    expect(walker.state().z).toBeLessThan(ROOM / 2);
  });

  it("keeps the body radius it has always had", () => {
    expect(WALK_BODY_RADIUS_M).toBeCloseTo(0.22, 5);
  });
});
