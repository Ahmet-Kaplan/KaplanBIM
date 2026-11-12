/**
 * @jest-environment node
 *
 * label-seed: where a room's tag goes. The point furthest from the room's own
 * walls, found by a coarse grid then a shrinking one (Mapbox's "polylabel").
 *
 * The kernel's own rooms used to place a tag at the outline's corner mean,
 * which for an L sits in the notch — outside the room. `labelSeedOf` gives a
 * point a person would have clicked themselves, and a room that carries one
 * anchors its tag there.
 */
import { DEFAULT_SETTINGS, asElementId, modelAnchor, type ModelState, type Room } from "../src";
import { labelSeedOf } from "../src";

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

const inside = (outline: readonly { readonly x: number; readonly y: number }[], p: { readonly x: number; readonly y: number } | null): boolean => {
  if (!p) return false;
  let within = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i];
    const b = outline[j];
    if (!a || !b) continue;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) within = !within;
  }
  return within;
};

describe("labelSeedOf", () => {
  it("a rectangle's seed is its middle", () => {
    expect(labelSeedOf(rect(0, 0, 4000, 3000))).toEqual({ x: 2000, y: 1500 });
  });

  it("an L's seed is inside the room, clear of the notch the corner mean falls in", () => {
    const l = [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 2000 }, { x: 2000, y: 2000 }, { x: 2000, y: 6000 }, { x: 0, y: 6000 }];
    const seed = labelSeedOf(l);
    expect(inside(l, seed)).toBe(true);
    // Its corner mean (2333, 2333) is in the notch; a tag there is outside the room.
    expect(inside(l, { x: 2333, y: 2333 })).toBe(false);
    expect(Math.hypot((seed?.x ?? 0) - 2333, (seed?.y ?? 0) - 2333)).toBeGreaterThan(500);
  });

  it("a seed sits clear of a hole", () => {
    const outline = rect(0, 0, 6000, 2000);
    const hole = rect(2000, 500, 4000, 1500);
    const seed = labelSeedOf(outline, [hole]);
    expect(inside(outline, seed)).toBe(true);
    expect(inside(hole, seed)).toBe(false);
  });

  it("a degenerate outline gives no seed rather than a wrong one", () => {
    expect(labelSeedOf([])).toBeNull();
    expect(labelSeedOf([{ x: 0, y: 0 }, { x: 1000, y: 0 }])).toBeNull();
  });

  it("the same outline always gives the same seed", () => {
    const l = [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 2000 }, { x: 2000, y: 2000 }, { x: 2000, y: 6000 }, { x: 0, y: 6000 }];
    expect(labelSeedOf(l)).toEqual(labelSeedOf(l));
  });

  it("a room that carries a seed anchors its tag there; one without falls back to the outline's mean", () => {
    const outline = [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 2000 }, { x: 2000, y: 2000 }, { x: 2000, y: 6000 }, { x: 0, y: 6000 }];
    const base = { id: asElementId("rm-1"), version: 1, authoredRev: {}, kind: "room" as const, number: "101", name: "L room", outline, areaSqM: 20, partition: { level: "L1", zone: "*", discipline: "architecture" } };
    const plain: Room = base;
    const seeded: Room = { ...base, id: asElementId("rm-2"), labelSeed: labelSeedOf(outline) ?? { x: 0, y: 0 } };
    const elements = { [plain.id]: plain, [seeded.id]: seeded };
    const model: ModelState = { modelId: "label-seed", revision: 0 as ModelState["revision"], elements, connections: [], settings: DEFAULT_SETTINGS };
    // The area centroid of this L is (2200, 2200): inside the notch, outside the room.
    expect(modelAnchor(model, { elementId: "rm-1", anchor: "insertion" })).toMatchObject({ x: 2200, y: 2200 });
    expect(modelAnchor(model, { elementId: "rm-2", anchor: "insertion" })).toMatchObject({ x: seeded.labelSeed?.x, y: seeded.labelSeed?.y });
  });
});
