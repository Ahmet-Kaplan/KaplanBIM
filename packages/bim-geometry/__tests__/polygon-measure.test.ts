/** @jest-environment node */
import { clearanceAt, containsPoint, distanceToBoundary, overlapArea, polygonArea, type Loop, type Point, type Region } from "../src";

/**
 * The measures the label and containment algorithms rest on. `overlapArea` is
 * the one worth guarding: it samples the plane slab by slab, which is only
 * exact when every height at which the shared length changes direction — a
 * vertex of either region, or a place the two boundaries cross — cuts a band.
 */

const ring = (minX: number, minY: number, maxX: number, maxY: number): Loop => [
  [minX, minY],
  [maxX, minY],
  [maxX, maxY],
  [minX, maxY],
];

/** Signed area, counter-clockwise positive: the shoelace, in the test's own words. */
function shoelace(points: readonly Point[]): number {
  let twice = 0;
  for (let index = 0; index < points.length; index++) {
    const here = points[index]!;
    const next = points[(index + 1) % points.length]!;
    twice += here[0] * next[1] - next[0] * here[1];
  }
  return twice / 2;
}

/**
 * The intersection of two convex rings by half-plane clipping, which is a
 * different algorithm from the one under test. Used as the reference.
 */
function clipConvex(subject: readonly Point[], clip: readonly Point[]): Point[] {
  let result: Point[] = [...subject];
  const counterClockwise = shoelace(clip) > 0 ? clip : [...clip].reverse();
  for (let index = 0; index < counterClockwise.length && result.length; index++) {
    const from = counterClockwise[index]!;
    const to = counterClockwise[(index + 1) % counterClockwise.length]!;
    const side = (point: Point) => (to[0] - from[0]) * (point[1] - from[1]) - (to[1] - from[1]) * (point[0] - from[0]);
    const kept: Point[] = [];
    for (let at = 0; at < result.length; at++) {
      const here = result[at]!;
      const previous = result[(at + result.length - 1) % result.length]!;
      const hereSide = side(here);
      const previousSide = side(previous);
      if (hereSide >= 0) {
        if (previousSide < 0) kept.push(crossPoint(previous, here, previousSide, hereSide));
        kept.push(here);
      } else if (previousSide >= 0) kept.push(crossPoint(previous, here, previousSide, hereSide));
    }
    result = kept;
  }
  return result;
}

function crossPoint(from: Point, to: Point, fromSide: number, toSide: number): Point {
  const along = fromSide / (fromSide - toSide);
  return [from[0] + along * (to[0] - from[0]), from[1] + along * (to[1] - from[1])];
}

describe("polygonArea", () => {
  it("measures a ring, and a ring less its holes", () => {
    expect(polygonArea(ring(0, 0, 100, 50))).toBeCloseTo(5000, 9);
    const holed: Region = { outer: ring(0, 0, 100, 100), holes: [ring(20, 20, 80, 80)] };
    expect(polygonArea(holed)).toBeCloseTo(6400, 9);
  });

  it("never goes below zero when a hole overruns its ring", () => {
    expect(polygonArea({ outer: ring(0, 0, 10, 10), holes: [ring(-50, -50, 50, 50)] })).toBe(0);
  });

  it("reads a ring whose points lie on one line as no area", () => {
    expect(polygonArea([[0, 0], [50, 0], [100, 0]])).toBe(0);
    expect(polygonArea([])).toBe(0);
  });
});

describe("overlapArea", () => {
  it("is the shared part of two rectangles, and zero when they miss", () => {
    expect(overlapArea(ring(0, 0, 10, 10), ring(5, 5, 15, 15))).toBeCloseTo(25, 9);
    expect(overlapArea(ring(0, 0, 10, 10), ring(5, 0, 15, 10))).toBeCloseTo(50, 9);
    expect(overlapArea(ring(0, 0, 10, 10), ring(10, 0, 20, 10))).toBe(0);
    expect(overlapArea(ring(0, 0, 10, 10), ring(20, 20, 30, 30))).toBe(0);
  });

  it("cuts a hole out of the shared part", () => {
    const holed: Region = { outer: ring(0, 0, 100, 100), holes: [ring(20, 20, 80, 80)] };
    expect(overlapArea(ring(0, 0, 100, 50), holed)).toBeCloseTo(5000 - 60 * 30, 9);
    expect(overlapArea(ring(20, 20, 80, 80), holed)).toBe(0);
  });

  it("measures a triangle crossing a square", () => {
    // Worked by hand by integrating the vertical measure over x: 58.
    const square = ring(0, 0, 10, 10);
    const triangle: Loop = [[2, -2], [14, 2], [2, 10]];
    expect(overlapArea(square, triangle)).toBeCloseTo(58, 9);
    expect(overlapArea(triangle, square)).toBeCloseTo(58, 9);
  });

  it("matches half-plane clipping where both rings are convex and cross obliquely", () => {
    // Two diamonds offset in both axes: every vertex of either lies outside the
    // other, so the shared shape is bounded entirely by crossing points and the
    // sample bands have to break at those crossings to stay exact.
    const diamond: Loop = [[0, 5], [5, 0], [0, -5], [-5, 0]];
    const shifted: Loop = [[2, 6], [7, 1], [2, -4], [-3, 1]];
    const expected = Math.abs(shoelace(clipConvex(diamond, shifted)));
    expect(expected).toBeGreaterThan(10);
    expect(overlapArea(diamond, shifted)).toBeCloseTo(expected, 6);
  });

  it("is exact for rings whose edges run along each other", () => {
    const left: Loop = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const right: Loop = [[10, 0], [20, 0], [20, 10], [10, 10]];
    expect(overlapArea(left, right)).toBe(0);
    const shared: Loop = [[0, 0], [20, 0], [20, 10], [0, 10]];
    expect(overlapArea(shared, left)).toBeCloseTo(100, 9);
  });

  it("keeps its accuracy at a 10 km site offset", () => {
    const site = (minX: number, minY: number) => ring(1e7 + minX, 1e7 + minY, 1e7 + minX + 10, 1e7 + minY + 10);
    expect(overlapArea(site(0, 0), site(5, 5))).toBeCloseTo(25, 6);
  });

  it("is zero for degenerate input instead of throwing", () => {
    expect(overlapArea([], ring(0, 0, 10, 10))).toBe(0);
    expect(overlapArea([[0, 0], [10, 0], [20, 0]], ring(0, 0, 10, 10))).toBe(0);
    expect(overlapArea([[Number.NaN, 0], [1, 1], [2, 2]], ring(0, 0, 10, 10))).toBe(0);
  });
});

describe("containsPoint", () => {
  it("counts a ring as inside and a hole as out", () => {
    const holed: Region = { outer: ring(0, 0, 100, 100), holes: [ring(20, 20, 80, 80)] };
    expect(containsPoint(holed, [50, 10])).toBe(true);
    expect(containsPoint(holed, [50, 50])).toBe(false);
    expect(containsPoint(holed, [20, 50])).toBe(true); // the hole's rim is floor, not hole
    expect(containsPoint(holed, [0, 50])).toBe(true); // the outer rim is floor
    expect(containsPoint(holed, [-1, 50])).toBe(false);
  });

  it("still decides at a 10 km site offset", () => {
    const site = ring(1e7, 1e7, 1e7 + 100, 1e7 + 100);
    expect(containsPoint(site, [1e7 + 50, 1e7 + 50])).toBe(true);
    expect(containsPoint(site, [1e7 + 150, 1e7 + 50])).toBe(false);
  });
});

describe("distanceToBoundary", () => {
  it("measures to the nearest edge, holes included", () => {
    expect(distanceToBoundary(ring(0, 0, 100, 100), [50, 50])).toBeCloseTo(50, 9);
    expect(distanceToBoundary(ring(0, 0, 100, 100), [0, 50])).toBe(0);
    const holed: Region = { outer: ring(0, 0, 100, 100), holes: [ring(20, 20, 80, 80)] };
    expect(distanceToBoundary(holed, [50, 10])).toBeCloseTo(10, 9);
    expect(distanceToBoundary(holed, [10, 50])).toBeCloseTo(10, 9);
  });

  it("is infinite when there is no ring to measure from", () => {
    expect(distanceToBoundary([], [0, 0])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("clearanceAt", () => {
  it("is the distance inside and its negative outside, in one walk", () => {
    const holed: Region = { outer: ring(0, 0, 100, 100), holes: [ring(20, 20, 80, 80)] };
    expect(clearanceAt(holed, [50, 10])).toBeCloseTo(10, 9);
    expect(clearanceAt(holed, [50, 50])).toBeCloseTo(-30, 9);
    expect(clearanceAt(holed, [-5, 50])).toBeCloseTo(-5, 9);
    expect(clearanceAt(holed, [0, 50])).toBe(0);
  });
});
