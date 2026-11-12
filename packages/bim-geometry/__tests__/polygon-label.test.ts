/** @jest-environment node */
import { LABEL_PRECISION, containsPoint, distanceToBoundary, polygonLabel, type Loop, type Point, type Region } from "../src";

/**
 * Label placement: the farthest-interior point of a region. A room tag on the
 * centroid can land in a courtyard or in the notch of an L; on the pole it sits
 * in the middle of the thickest part, where text of any width has clearance.
 *
 * Distances are millimetres, as in the kernel.
 */

const ring = (minX: number, minY: number, maxX: number, maxY: number): Loop => [
  [minX, minY],
  [maxX, minY],
  [maxX, maxY],
  [minX, maxY],
];

/** The notch of an L: 100 × 30 along both arms, so its thickest part is 30 wide. */
const L: Loop = [
  [0, 0],
  [100, 0],
  [100, 30],
  [30, 30],
  [30, 100],
  [0, 100],
];

/** A U open at the top: the centroid falls in the gap between the legs. */
const U: Loop = [
  [0, 0],
  [100, 0],
  [100, 100],
  [70, 100],
  [70, 30],
  [30, 30],
  [30, 100],
  [0, 100],
];

const withHole: Region = { outer: ring(0, 0, 100, 100), holes: [ring(30, 30, 70, 70)] };

function centroid(points: Loop): Point {
  let twice = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index++) {
    const here = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const cross = here[0] * next[1] - next[0] * here[1];
    twice += cross;
    x += (here[0] + next[0]) * cross;
    y += (here[1] + next[1]) * cross;
  }
  return [x / (3 * twice), y / (3 * twice)];
}

describe("polygonLabel", () => {
  it("puts a square's label at its centre", () => {
    const square = ring(0, 0, 100, 100);
    const label = polygonLabel(square, 0.01);
    expect(label[0]).toBeCloseTo(50, 1);
    expect(label[1]).toBeCloseTo(50, 1);
  });

  it("puts an L's label in the thick part of an arm, not at the centroid's notch", () => {
    const label = polygonLabel(L, 0.01);
    // Only the middle of an arm reaches 15 mm of clearance; the centroid sits in
    // the notch, outside the L, 12.5 mm from the arm it would need to be in.
    expect(distanceToBoundary(L, label)).toBeGreaterThan(14.9);
    expect(containsPoint(L, centroid(L))).toBe(false);
    expect(containsPoint(L, label)).toBe(true);
  });

  it("keeps a room's label out of the column through it", () => {
    const label = polygonLabel(withHole, 0.01);
    const inHole = label[0] > 30 && label[0] < 70 && label[1] > 30 && label[1] < 70;
    expect(inHole).toBe(false);
    expect(containsPoint(withHole, label)).toBe(true);
    expect(distanceToBoundary(withHole, label)).toBeGreaterThan(14.9);
  });

  it("puts a wide thin rectangle's label on its long axis", () => {
    const label = polygonLabel(ring(0, 0, 200, 20));
    // Clearance 10 is the middle of the 20 mm width; with a 1 mm tolerance the
    // answer is within a millimetre of that axis, anywhere along it.
    expect(Math.abs(label[1] - 10)).toBeLessThanOrEqual(1);
    expect(label[0]).toBeGreaterThanOrEqual(10);
    expect(label[0]).toBeLessThanOrEqual(190);
    const tight = polygonLabel(ring(0, 0, 200, 20), 0.01);
    expect(tight[1]).toBeCloseTo(10, 1);
  });

  it("answers inside the region with at least the centroid's clearance", () => {
    const shapes: readonly Loop[] = [ring(0, 0, 100, 100), L, U, ring(0, 0, 200, 20), ring(-40, -90, 60, 10)];
    for (const shape of shapes) {
      const label = polygonLabel(shape, 0.01);
      expect(containsPoint(shape, label)).toBe(true);
      const middle = centroid(shape);
      if (containsPoint(shape, middle)) expect(distanceToBoundary(shape, label)).toBeGreaterThanOrEqual(distanceToBoundary(shape, middle));
    }
    // A U's centroid is in its mouth: the label must still be inside the legs.
    const u = polygonLabel(U, 0.01);
    expect(containsPoint(U, u)).toBe(true);
    expect(distanceToBoundary(U, u)).toBeGreaterThan(14.9);
  });

  it("places a label at a 10 km site offset", () => {
    const site = ring(1e7, 1e7, 1e7 + 1e4, 1e7 + 1e4);
    const label = polygonLabel(site, 0.01);
    expect(Math.abs(label[0] - (1e7 + 5000))).toBeLessThan(1);
    expect(Math.abs(label[1] - (1e7 + 5000))).toBeLessThan(1);
  });

  it("clears a hole bigger than the cells the search starts with", () => {
    const frame: Region = { outer: ring(0, 0, 100, 100), holes: [ring(5, 5, 95, 95)] };
    const label = polygonLabel(frame, 0.01);
    expect(label[0] > 5 && label[0] < 95 && label[1] > 5 && label[1] < 95).toBe(false);
    expect(containsPoint(frame, label)).toBe(true);
    expect(distanceToBoundary(frame, label)).toBeGreaterThan(2.4);
  });

  describe("degenerate input", () => {
    it("returns the point it has when there are fewer than three", () => {
      expect(polygonLabel([])).toEqual([0, 0]);
      expect(polygonLabel([[5, 7]])).toEqual([5, 7]);
      expect(polygonLabel([[5, 7], [15, 7]])).toEqual([5, 7]);
    });

    it("returns the first point of a ring that encloses no area", () => {
      expect(polygonLabel([[0, 0], [50, 0], [100, 0]])).toEqual([0, 0]);
      expect(polygonLabel([[0, 0], [50, 0], [50, 0], [0, 0]])).toEqual([0, 0]);
    });

    it("treats a zero, negative or non-finite precision as the default", () => {
      const square = ring(0, 0, 100, 100);
      const exact = polygonLabel(square, LABEL_PRECISION);
      expect(polygonLabel(square, 0)).toEqual(exact);
      expect(polygonLabel(square, -5)).toEqual(exact);
      expect(polygonLabel(square, Number.NaN)).toEqual(exact);
      expect(polygonLabel(square, -Number.POSITIVE_INFINITY)).toEqual(exact);
    });

    it("terminates on a self-intersecting ring, which is unsupported", () => {
      // Even-odd reads the bowtie as two triangles; the search must stay finite
      // and inside them rather than loop between the lobes.
      const bowtie: Loop = [[0, 0], [100, 100], [100, 0], [0, 100]];
      const label = polygonLabel(bowtie, 0.01);
      expect(containsPoint(bowtie, label)).toBe(true);
    });

    it("terminates on a many-toothed comb at a fine precision", () => {
      // A pathological ring: 30 teeth, 5 mm apart, so the best clearance is the
      // 5 mm of the base bar and the bound prunes slowly. It must return, not run.
      const teeth: Point[] = [
        [0, 0],
        [300, 0],
        [300, 10],
      ];
      for (let index = 29; index >= 0; index--) teeth.push([10 * index + 5, 10], [10 * index + 5, 60], [10 * index, 60], [10 * index, 10]);
      const label = polygonLabel(teeth, 0.1);
      expect(label.every(Number.isFinite)).toBe(true);
      expect(distanceToBoundary(teeth, label)).toBeGreaterThan(4.8);
      expect(containsPoint(teeth, label)).toBe(true);
    });

    it("skips non-finite points instead of measuring them", () => {
      const label = polygonLabel([[0, 0], [Number.NaN, 5], [100, 0], [100, 100], [0, 100]], 0.01);
      expect(label.every(Number.isFinite)).toBe(true);
      expect(label[0]).toBeCloseTo(50, 0);
    });
  });
});
