/** @jest-environment node */
import { bestEnclosingFace, enclosingFits, type Loop, type Region } from "../src";

/**
 * Which face a polygon best sits in: share (how much of the subject the face
 * holds) and cover (how much of the face the subject fills), rather than one
 * overlap number that a big enough face always wins.
 */

const ring = (minX: number, minY: number, maxX: number, maxY: number): Loop => [
  [minX, minY],
  [maxX, minY],
  [maxX, maxY],
  [minX, maxY],
];

/** Three wall loops side by side, 100 × 100 each. */
const faces: readonly Loop[] = [ring(0, 0, 100, 100), ring(100, 0, 200, 100), ring(200, 0, 300, 100)];

describe("bestEnclosingFace", () => {
  it("picks the one face a space sits inside, with share and cover near 1", () => {
    const space = ring(5, 5, 95, 95);
    const fit = bestEnclosingFace(space, faces);
    expect(fit?.index).toBe(0);
    expect(fit?.share).toBeCloseTo(1, 6);
    expect(fit?.cover).toBeCloseTo(8100 / 10000, 6);
  });

  it("gives a face and the same polygon as the space a score of 1", () => {
    const fit = bestEnclosingFace(ring(200, 0, 300, 100), faces);
    expect(fit?.index).toBe(2);
    expect(fit?.share).toBeCloseTo(1, 9);
    expect(fit?.cover).toBeCloseTo(1, 9);
    expect(fit?.score).toBeCloseTo(1, 9);
  });

  it("picks the higher combined score when a space spans two faces", () => {
    // 40 % in the first face, 60 % in the second: both hold the space well enough
    // to be a candidate at a lower share floor, and the larger share wins.
    const space = ring(60, 0, 160, 100);
    const fit = bestEnclosingFace(space, faces, { minimumShare: 0.3 });
    expect(fit?.index).toBe(1);
    expect(fit?.share).toBeCloseTo(0.6, 6);
    expect(fit?.cover).toBeCloseTo(0.6, 6);
  });

  it("scores the same whatever order the candidates come in", () => {
    const space = ring(60, 0, 160, 100);
    const straight = bestEnclosingFace(space, faces, { minimumShare: 0.3 })!;
    const shuffled = bestEnclosingFace(space, [faces[2]!, faces[0]!, faces[1]!], { minimumShare: 0.3 })!;
    // The winning face is the one that was at index 1; in this order it is at 2.
    expect(shuffled.index).toBe(2);
    expect(shuffled.share).toBeCloseTo(straight.share, 12);
    expect(shuffled.cover).toBeCloseTo(straight.cover, 12);
    expect(shuffled.score).toBeCloseTo(straight.score, 12);
  });

  it("prefers the face about the space's size over a larger one that also holds it", () => {
    // Both hold all of the space, so a single overlap number cannot choose. The
    // storey-sized loop covers a third of itself; the room covers all of itself.
    const room = ring(0, 0, 100, 100);
    const storey = ring(0, 0, 300, 100);
    const fit = bestEnclosingFace(room, [storey, room]);
    expect(fit?.index).toBe(1);
    expect(fit?.cover).toBeCloseTo(1, 9);
  });

  it("answers nothing when no candidate holds the space", () => {
    expect(bestEnclosingFace(ring(400, 0, 500, 100), faces)).toBeUndefined();
    // Touching a face along its edge is not being in it.
    expect(bestEnclosingFace(ring(300, 0, 400, 100), faces)).toBeUndefined();
    // A tenth of a space inside one face is not that face's space.
    expect(bestEnclosingFace(ring(-150, 0, 100, 100), faces)).toBeUndefined();
  });

  it("answers nothing for a space with no area", () => {
    expect(bestEnclosingFace([[0, 0], [50, 0], [100, 0]], faces)).toBeUndefined();
    expect(bestEnclosingFace([], faces)).toBeUndefined();
    expect(bestEnclosingFace(ring(0, 0, 100, 100), [])).toBeUndefined();
  });

  it("reads a hole as absent floor, not as floor", () => {
    const column: Region = { outer: ring(0, 0, 100, 100), holes: [ring(20, 20, 80, 80)] };
    // A space the size of the column sits in the hole: no candidate holds it.
    expect(bestEnclosingFace(ring(20, 20, 80, 80), [column])).toBeUndefined();
    // A space the size of the frame fills it, hole and all.
    const frame = bestEnclosingFace(column, [column]);
    expect(frame?.share).toBeCloseTo(1, 9);
    expect(frame?.cover).toBeCloseTo(1, 9);
  });

  it("honours the share and cover floors it is given", () => {
    const space = ring(60, 0, 160, 100);
    expect(bestEnclosingFace(space, faces, { minimumShare: 0.3, minimumCover: 0.7 })).toBeUndefined();
    expect(bestEnclosingFace(space, faces, { minimumShare: 0.3, minimumCover: 0.5 })?.index).toBe(1);
  });
});

describe("enclosingFits", () => {
  it("lists every holder it found, in the order given", () => {
    const space = ring(60, 0, 160, 100);
    const fits = enclosingFits(space, faces, { minimumShare: 0.3 });
    expect(fits.map((fit) => fit.index)).toEqual([0, 1]);
    expect(fits[0]?.share).toBeCloseTo(0.4, 6);
    expect(fits[1]?.share).toBeCloseTo(0.6, 6);
  });
});
