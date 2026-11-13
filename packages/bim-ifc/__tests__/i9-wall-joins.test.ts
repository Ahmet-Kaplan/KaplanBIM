/**
 * @jest-environment node
 *
 * i9-wall-joins: step 6 of the IFC plan — the wall join pass. A file's wall
 * pieces become the walls the building has, on the neutral products, before any
 * of them becomes a record.
 *
 *  - **Fragment merge.** Pieces of one wall — one storey, one direction, one
 *    build-up, one thickness — whose reference lines lie on one line with a
 *    small gap are one wall, and the report names the wall it merged.
 *  - **L and T joins.** An end that overshoots the wall it meets slides along
 *    its own axis: onto the neighbour's reference line at a corner, and onto
 *    the neighbour's near face where the neighbour runs past.
 *
 * The tolerances are ours, not Pascal's (its 1.25 m merge gap is US residential
 * framing and would close a door here). A wall whose reference line was
 * inferred from its body takes no part: an inferred line is the body's centre,
 * so joining on it joins the wrong face.
 */
import { type BimElement, type Wall, landImport, takeoffTotals, withUpgradePolicy } from "@permitzip/bim-kernel";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importIfc, readIfcSource } from "../src";
import { IfcText, hostModel } from "./i9-fixtures";

const opts = () => ({ model: hostModel(), referenceId: "ref-joins", sourceKey: "v1", sourceId: "ver-joins-1", label: "Wall joins", disciplines: ["architecture"] });

const READ = { sourceId: "ver-joins-1", label: "Wall joins", disciplines: ["architecture"] } as const;

const walls = (records: readonly BimElement[]): Wall[] => records.filter((r): r is Wall => r.kind === "wall");

const lengthOf = (w: Wall): number => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);

const mm = (n: number): number => Math.round(n * 10) / 10;

/** Two walls on one level with the axes the test gives them, in one file. */
function twoWalls(a: (t: IfcText, storey: string) => number, b: (t: IfcText, storey: string) => number): string {
  const t = IfcText.start("mm");
  t.storey("Level 1", 0);
  a(t, "Level 1");
  b(t, "Level 1");
  return t.text();
}

describe("i9-wall-joins", () => {
  it("merges two collinear pieces of one wall, and says which wall it merged", () => {
    // One 200 mm wall the file splits 150 mm apart: 4 m + 3 m, and 150 mm of
    // nothing between them.
    const text = twoWalls(
      (t, s) => t.wall(s, "Wall A", [0, 0], 4000, 200, 3000),
      (t, s) => t.wall(s, "Wall A", [4150, 0], 3000, 200, 3000),
    );
    const plan = importIfc(text, opts());
    const [wall] = walls(plan.records);
    expect(walls(plan.records)).toHaveLength(1);
    // One line from the first piece's start to the second's end.
    expect(wall).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 7150, y: 0 }, thickness: 200, height: 3000 });
    // The merge is reported: which wall, which pieces, and what it was before.
    expect(plan.report.joins?.merged).toHaveLength(1);
    expect(plan.report.joins?.merged[0]).toMatchObject({ name: "Wall A", pieces: [{ name: "Wall A" }, { name: "Wall A" }], lengthBeforeMm: 7000, lengthAfterMm: 7150, gapMm: 150 });
    expect(plan.report.notes.join(" | ")).toMatch(/^"Wall A" came in as one wall from 2 pieces the file splits it into/);
    expect(plan.report.notes.join(" | ")).toMatch(/which lie on one line 150 mm apart: 7 m of wall became 7.15 m/);
    expect(plan.report.notes.join(" | ")).toMatch(/Check it against the source model/);
  });

  it("does not merge across a gap wider than the tolerance", () => {
    // 900 mm apart — the width of a door leaf. A merge here would wall off a
    // door (Pascal's 1.25 m default would have merged it).
    const text = twoWalls(
      (t, s) => t.wall(s, "Wall A", [0, 0], 4000, 200, 3000),
      (t, s) => t.wall(s, "Wall A", [4900, 0], 3000, 200, 3000),
    );
    const plan = importIfc(text, opts());
    expect(walls(plan.records)).toHaveLength(2);
    expect(walls(plan.records).map((w) => mm(lengthOf(w)))).toEqual([4000, 3000]);
    expect(plan.report.joins?.merged).toEqual([]);
    expect(plan.report.notes.join(" | ")).not.toMatch(/came in as one wall/);
  });

  it("L join: two perpendicular ends meet on the reference lines, shorter by one thickness", () => {
    // Each wall's axis runs half a thickness past the other's line — how an
    // exporter draws a corner. Both ends slide back onto the crossing.
    const text = twoWalls(
      (t, s) => t.wall(s, "Wall A", [0, 0], 6100, 200, 3000),
      (t, s) => t.wall(s, "Wall B", [6000, -100], 5100, 200, 3000, 90),
    );
    const plan = importIfc(text, opts());
    const [a, b] = walls(plan.records).sort((x, y) => x.start.x - y.start.x) as [Wall, Wall];
    expect(a.start).toEqual({ x: 0, y: 0 });
    expect(a.end).toEqual({ x: 6000, y: 0 });
    expect(b.start).toEqual({ x: 6000, y: 0 });
    expect(b.end).toEqual({ x: 6000, y: 5000 });
    // 6100 + 5100 raw, 6000 + 5000 joined: shorter by one 200 mm thickness.
    expect(mm(lengthOf(a) + lengthOf(b))).toBe(11000);
    expect(mm(11200 - (lengthOf(a) + lengthOf(b)))).toBe(200);
    expect(plan.report.joins).toMatchObject({ endsMoved: 2, longestMoveMm: 100 });
    expect(plan.report.notes.join(" | ")).toMatch(/2 wall ends were slid along their own axes/);
  });

  it("T join: the stem stops at the host's near face", () => {
    // A stem drawn from the host's centre line (y = 0) upward: the half of it
    // that lies inside the 200 mm host is not the stem's length.
    const text = twoWalls(
      (t, s) => t.wall(s, "Host", [0, 0], 6000, 200, 3000),
      (t, s) => t.wall(s, "Stem", [3000, 0], 1750, 200, 3000, 90),
    );
    const plan = importIfc(text, opts());
    const [host, stem] = walls(plan.records).sort((x, y) => lengthOf(y) - lengthOf(x)) as [Wall, Wall];
    // The host runs past the junction: it is not touched.
    expect(host.start).toEqual({ x: 0, y: 0 });
    expect(host.end).toEqual({ x: 6000, y: 0 });
    // The stem stops at the host's near face at y = 100, not at its line.
    expect(stem.start).toEqual({ x: 3000, y: 100 });
    expect(stem.end).toEqual({ x: 3000, y: 1750 });
    expect(mm(lengthOf(stem))).toBe(1650);
    expect(plan.report.joins).toMatchObject({ endsMoved: 1, longestMoveMm: 100 });
  });

  it("near-parallel walls are not joined", () => {
    // 10° apart: the crossing of two lines that nearly agree is a guess (a
    // 20 mm slip would move it 115 mm), so the end stays where the file put it.
    const text = twoWalls(
      (t, s) => t.wall(s, "Wall A", [0, 0], 6000, 200, 3000),
      (t, s) => t.wall(s, "Wall B", [6100, 0], 2000, 200, 3000, 10),
    );
    const plan = importIfc(text, opts());
    expect(walls(plan.records)).toHaveLength(2);
    const [a] = walls(plan.records);
    expect(a).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } });
    expect(plan.report.joins).toMatchObject({ endsMoved: 0, merged: [] });
    expect(plan.report.notes.join(" | ")).not.toMatch(/slid along/);
  });

  it("a wall whose reference line was inferred is left alone, and says so", () => {
    // The second wall states no Axis: its line is its body's centre, so joining
    // or merging on it would take the wrong face for the wall's place.
    const text = twoWalls(
      (t, s) => t.wall(s, "Wall A", [0, 0], 6000, 200, 3000),
      (t, s) => t.wall(s, "Wall B", [6100, 0], 2000, 200, 3000, 0, { axis: false }),
    );
    const source = readIfcSource(text, READ);
    expect(source.products.filter((p) => p.referenceLine === undefined).map((p) => p.name)).toEqual(["Wall B"]);
    const plan = importIfc(text, opts());
    const [a, b] = walls(plan.records).sort((x, y) => x.start.x - y.start.x) as [Wall, Wall];
    // Four walls would be two: they are not merged, and A is not extended.
    expect(walls(plan.records)).toHaveLength(2);
    expect(a).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } });
    expect(b.referenceLineInferred).toBe(true);
    expect(plan.report.joins).toMatchObject({ merged: [], endsMoved: 0, inferredLeft: 1 });
    expect(plan.report.notes.join(" | ")).toMatch(/inferred from its body's footprint/);
  });

  it("the file's own path join raises the gap a merge of ends may close", () => {
    // Two perpendicular walls 400 mm apart: a drawing slip, not an opening —
    // but only because the file says the two are joined
    // (`IfcRelConnectsPathElements`). Without that statement nothing moves.
    const withJoin = (joined: boolean): string => {
      const t = IfcText.start("mm");
      t.storey("Level 1", 0);
      const a = t.wall("Level 1", "Wall A", [0, 0], 6000, 200, 3000);
      const b = t.wall("Level 1", "Wall B", [6400, 0], 5000, 200, 3000, 90);
      if (joined) t.add("IFCRELCONNECTSPATHELEMENTS", `${t.guid()},$,$,$,$,#${a},#${b},(),(),.ATPATH.,.ATEND.`);
      return t.text();
    };
    // The reader keeps the statement, both ways round, with how each side meets.
    const [product] = readIfcSource(withJoin(true), READ).products;
    expect(product?.pathJoins).toEqual([{ otherId: expect.stringMatching(/^[0-9A-Z]{22}$/), selfType: "ATEND", otherType: "ATPATH" }]);

    const quiet = importIfc(withJoin(false), opts());
    expect(walls(quiet.records)).toHaveLength(2);
    expect(mm(lengthOf(walls(quiet.records).sort((x, y) => x.start.x - y.start.x)[0] as Wall))).toBe(6000);

    const stated = importIfc(withJoin(true), opts());
    const [a] = walls(stated.records).sort((x, y) => x.start.x - y.start.x);
    expect(a?.end).toEqual({ x: 6400, y: 0 });
    expect(stated.report.joins).toMatchObject({ endsMoved: 1, statedJoins: 1, statedJoinsInFile: 1 });
  });

  it("the repo's sample model: 4 walls before joining and after, and 30.00 m of line before, 29.28 m after", () => {
    const text = readFileSync(join(__dirname, "../../../sample-models/IfcOpenHouse_IFC4.ifc"), "utf8");
    const input = { model: hostModel(), referenceId: "ref-house", sourceKey: "v1", sourceId: "ver-house-1", label: "IfcOpenHouse", disciplines: ["architecture", "structure"] } as const;
    const plan = importIfc(text, input);
    // Nothing to merge: the file's four walls are four walls.
    expect(plan.report.converted).toBe(31);
    expect(walls(plan.records)).toHaveLength(4);
    expect(plan.report.joins?.merged).toEqual([]);
    // Each corner had one wall's line running 180 mm past the other's — half of
    // the 360 mm these walls measure across — and each such end slid back.
    expect(plan.report.joins).toMatchObject({ endsMoved: 4, longestMoveMm: 180, coincidentPairs: 0, inferredLeft: 0, statedJoinsInFile: 0 });
    // The double-counted length was 4 corners × 180 mm = 720 mm, 2.4% of 30 m.
    const before = 30000;
    const after = walls(plan.records).reduce((s, w) => s + lengthOf(w), 0);
    expect(mm(after)).toBe(29280);
    expect(mm(before - after)).toBe(720);
    // And it is the takeoff that sees it: the Walls line falls by the same 0.72 m.
    const model = withUpgradePolicy(() => true, () => landImport(hostModel(), plan.records).model);
    const wallLength = takeoffTotals(model.elements).find((t) => t.measure.key === "qto.length" && t.group.kind === "class" && t.group.label === "Walls");
    // The takeoff reads it to 0.1 m: 29.3 m, not 30.0 m.
    expect(mm(wallLength?.value ?? 0)).toBe(29.3);
    expect(wallLength?.elementCount).toBe(4);
  });
});
