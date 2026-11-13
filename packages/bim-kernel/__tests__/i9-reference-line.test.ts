/**
 * @jest-environment node
 *
 * i9-reference-line: the two kernel readings a wall's reference line needs,
 * pinned on plain numbers — which way "left" is, and that a line the file gives
 * as a curve is refused rather than chorded.
 *
 * A wall records its line as `start` → `end` and the body it carries across it
 * by `offsetFromReferenceLineMm`, positive to the left looking from start to
 * end (the same side `line-face` calls a line's left). That sign is the whole
 * contract between an import and a join, so it is measured here rather than
 * only through a fixture.
 */
import { acrossReferenceLine, straightReferenceLine } from "../src";

const east = { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } };

describe("i9-reference-line", () => {
  it("measures a body across a line: its thickness, and where its centre falls", () => {
    // Centred on an east-running line: no offset, 200 across.
    expect(acrossReferenceLine([{ x: 0, y: -100 }, { x: 6000, y: -100 }, { x: 6000, y: 100 }, { x: 0, y: 100 }], east)).toEqual({ thickness: 200, offset: 0 });
    // Wholly to the north: left of start → end, so a positive offset of half its width.
    expect(acrossReferenceLine([{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 200 }, { x: 0, y: 200 }], east)).toEqual({ thickness: 200, offset: 100 });
    // Wholly to the south: the same wall on the other side.
    expect(acrossReferenceLine([{ x: 0, y: -200 }, { x: 6000, y: -200 }, { x: 6000, y: 0 }, { x: 0, y: 0 }], east)).toEqual({ thickness: 200, offset: -100 });
  });

  it("takes the extent across the line, not a box round an outline", () => {
    // A body with an angled end: its bounding box is 300 across, its true width 200.
    const outline = [{ x: 0, y: 0 }, { x: 5900, y: 0 }, { x: 6000, y: 200 }, { x: 100, y: 200 }];
    expect(acrossReferenceLine(outline, east)).toEqual({ thickness: 200, offset: 100 });
  });

  it("takes a straight reference line as its ends, and refuses one that bends or can't be read", () => {
    const line = (points: readonly (readonly [number, number])[], straight = true) => ({ points: points.map(([x, y]) => ({ x, y, z: 0 })), straight });
    expect(straightReferenceLine(line([[0, 0], [6000, 0]]))).toEqual(east);
    // Collinear stations are still one straight run.
    expect(straightReferenceLine(line([[0, 0], [3000, 0], [6000, 0]]))).toEqual(east);
    // A curve, an unread curve and no line at all all answer null: a chord is a
    // different line, so the caller infers from the body and says it did.
    expect(straightReferenceLine(line([[0, 0], [3000, 300], [6000, 0]], false))).toBeNull();
    expect(straightReferenceLine({ points: [], straight: false, unread: "a curve with arcs" })).toBeNull();
    expect(straightReferenceLine(undefined)).toBeNull();
    // Two points on top of each other place nothing.
    expect(straightReferenceLine(line([[0, 0], [0, 0]]))).toBeNull();
  });
});
