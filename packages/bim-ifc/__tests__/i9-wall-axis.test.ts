/**
 * @jest-environment node
 *
 * i9-wall-axis: a wall's reference line is the axis the file gives it, not a
 * centre line reconstructed from its body.
 *
 * Before this the reader took only the Body representation (`bodyFirst`) and
 * the wall rule derived `start`/`end` from the body footprint's long side
 * (`rectangleAxis`). The stored line was then the *body's* centre line, so a
 * justification had nowhere to live, `IfcMaterialLayerSetUsage`'s
 * `OffsetFromReferenceLine` was relative to a line nobody had read, and
 * thickening a wall moved its line — and with it every neighbour's face.
 *
 * The reader now keeps the `Axis` representation on the neutral product
 * (`ImportReferenceLine`), the rule measures the body *across* that line and
 * carries where the body's centre falls from it, and a wall with no usable
 * axis falls back to the old body derivation and says so
 * (`referenceLineInferred`, and a line in the report).
 */
import { type BimElement, type Wall, landImport, takeoffTotals } from "@permitzip/bim-kernel";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importIfc, readIfcSource } from "../src";
import { IfcText, hostModel } from "./i9-fixtures";

const asText = (t: IfcText): string => t.text();

const opts = (disciplines: readonly string[] = ["architecture"]) => ({ model: hostModel(), referenceId: "ref-axis", sourceKey: "v1", sourceId: "ver-axis-1", label: "Wall lines", disciplines });

const READ = { sourceId: "ver-axis-1", label: "Wall lines", disciplines: ["architecture"] } as const;

const walls = (records: readonly BimElement[]): Wall[] => records.filter((r): r is Wall => r.kind === "wall");

/** `15.` / `-100.` as STEP writes them. */
const n = (v: number): string => (Number.isInteger(v) ? `${v}.` : String(v));

/** An `IfcMaterialLayerSet` of `layers`, and the usage that places its reference line `offset` mm from the outer face. */
function layerSet(t: IfcText, layers: readonly { readonly material: string; readonly thickness: number }[], offset: number): number {
  const materials = layers.map((l) => t.add("IFCMATERIAL", `'${l.material}',$,$`));
  const made = layers.map((l, i) => t.add("IFCMATERIALLAYER", `#${materials[i]},${n(l.thickness)},$,$,$,$,$`));
  const set = t.add("IFCMATERIALLAYERSET", `(${made.map((i) => `#${i}`).join(",")}),'Wall',$`);
  return t.add("IFCMATERIALLAYERSETUSAGE", `#${set},.AXIS2.,.POSITIVE.,${n(offset)},$`);
}

/** A file of one wall across a storey, with whatever the test gives it. */
function file(wall: (t: IfcText, storey: string) => number, material?: (t: IfcText, id: number) => number): string {
  const t = IfcText.start("mm");
  t.storey("Level 1", 0);
  const id = wall(t, "Level 1");
  const m = material?.(t, id);
  if (m !== undefined) t.add("IFCRELASSOCIATESMATERIAL", `${t.guid()},$,$,$,(#${id}),#${m}`);
  return asText(t);
}

describe("i9-wall-axis", () => {
  it("the reader keeps the axis as the product's reference line, in the file's length unit", () => {
    const text = file((t, storey) => t.wall(storey, "Wall A", [0, 0], 6000, 200, 3000));
    const [product] = readIfcSource(text, READ).products;
    expect(product?.referenceLine).toEqual({ points: [{ x: 0, y: 0, z: 0 }, { x: 6000, y: 0, z: 0 }], straight: true });

    // A file in feet gives its axis in feet: the neutral line is in millimetres.
    const feet = IfcText.start("ft");
    feet.storey("Level 1", 0);
    feet.wall("Level 1", "Wall A", [0, 0], 20, 8, 10);
    const [inFeet] = readIfcSource(asText(feet), READ).products;
    const points = inFeet?.referenceLine?.points ?? [];
    expect(points.map((p) => Math.round(p.x))).toEqual([0, 6096]);
    expect(points.every((p) => p.z === 0)).toBe(true);
  });

  it("start and end are the axis, not the body's centre line", () => {
    // The body sits 100 mm to the left of the axis (a wall justified to one
    // face): a centre line derived from its footprint would run at y = 100.
    const text = file((t, storey) => t.wall(storey, "Wall A", [0, 0], 6000, 200, 3000, 0, { bodyOffset: 100 }));
    const plan = importIfc(text, opts());
    const [wall] = walls(plan.records);
    expect(wall).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 }, thickness: 200, height: 3000, offsetFromReferenceLineMm: 100 });
    // The reference line is the body's right face, looking from start to end.
    expect(wall?.referenceJustification).toBe("right");
    expect(wall?.referenceLineInferred).toBeUndefined();
    // Nothing to report: the file stated the line.
    expect(plan.report.notes).toEqual([]);
    // Length is still the body's 6 m, measured along the line rather than beside it.
    const length = takeoffTotals(landImport(hostModel(), plan.records).model.elements).find((t) => t.measure.key === "qto.length");
    expect(Math.round(length?.value ?? 0)).toBe(6);
  });

  it("an axis given as an IfcLine is a straight run too", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    const body = t.extrude(t.rect(6000, 200, [3000, 0]), 3000);
    const line = t.add("IFCLINE", `#${t.pt(0, 0)},#${t.add("IFCVECTOR", `#${t.dir(1, 0, 0)},6000.`)}`);
    t.product("Level 1", "IFCWALL", "Wall A", [0, 0, 0], t.shape([body], null, line), ".STANDARD.");
    const plan = importIfc(asText(t), opts());
    const [wall] = walls(plan.records);
    expect(wall).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 }, thickness: 200, referenceJustification: "center" });
  });

  it("a layered wall's stated reference line is the axis the body sits on", () => {
    // 170 + 15 + 15, the reference line stated at −100 mm from the outer face:
    // half the build-up's 200 mm, which is the number a centred wall carries.
    const text = file(
      (t, storey) => t.wall(storey, "Layered", [0, 0], 6000, 200, 3000),
      (t) => layerSet(t, [{ material: "Tuğla", thickness: 170 }, { material: "Sıva", thickness: 15 }, { material: "Sıva", thickness: 15 }], -100),
    );
    const plan = importIfc(text, opts());
    const [wall] = walls(plan.records);
    expect(wall?.thickness).toBe(200);
    expect(wall?.start).toEqual({ x: 0, y: 0 });
    expect(wall?.end).toEqual({ x: 6000, y: 0 });
    expect(wall?.referenceJustification).toBe("center");
    expect(wall?.offsetFromReferenceLineMm).toBeUndefined();
    // The build-up rides along, with the reference line where the file puts it.
    expect(wall?.layers).toMatchObject({ totalThicknessMm: 200, referenceLineOffsetMm: 100 });
    // The outer face sits 100 mm from the reference line and the set grows back
    // across it: the 170 + 15 + 15 faces fall at −100, +70 and +85, which is the
    // body the axis runs through the middle of.
    expect(wall?.layers?.layers.map((l) => l.offsetFromReferenceLineMm)).toEqual([-100, 70, 85]);
    // Stated total and measured thickness agree, so there is nothing to warn about.
    expect(plan.report.notes).toEqual([]);
  });

  it("where the body actually sits is what the record carries, and it says nothing it can't tell", () => {
    // The body is 60 mm to the left of the axis while the layer set states its
    // reference line at −100: the two disagree, and the body's place is measured,
    // not assumed. 60 mm is neither a face (at ±100) nor the centre, so the
    // record claims no justification rather than rounding to the nearest one.
    const text = file(
      (t, storey) => t.wall(storey, "Wall A", [0, 0], 6000, 200, 3000, 0, { bodyOffset: 60 }),
      (t) => layerSet(t, [{ material: "Tuğla", thickness: 200 }], -100),
    );
    const [wall] = walls(importIfc(text, opts()).records);
    expect(wall?.offsetFromReferenceLineMm).toBe(60);
    expect(wall?.referenceJustification).toBeUndefined();
  });

  it("a wall with no axis converts as it always did, and says its line was inferred", () => {
    // Two walls the file gives no Axis: the second's body is off to one side, so
    // its inferred line lands beside the first's — which is exactly what the flag
    // and the report line warn a reader about.
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    t.wall("Level 1", "Wall A", [0, 0], 6000, 200, 3000, 0, { axis: false });
    t.wall("Level 1", "Wall B", [0, 1000], 6000, 200, 3000, 0, { axis: false, bodyOffset: 100 });
    const plan = importIfc(asText(t), opts());
    const [a, b] = walls(plan.records).sort((x, y) => x.start.y - y.start.y);
    expect(a).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 }, thickness: 200, referenceLineInferred: true });
    expect(a?.offsetFromReferenceLineMm).toBeUndefined();
    // The body's centre line, as before this change.
    expect(b).toMatchObject({ start: { x: 0, y: 1100 }, end: { x: 6000, y: 1100 }, referenceLineInferred: true });
    expect(plan.report.notes).toEqual([
      "2 elements came in on a reference line inferred from their body's footprint (the file states no reference line for it), so a thickness change moves the line rather than the face. Check them against the source model.",
    ]);
  });

  it("a curved axis is reported as unread, never chorded", () => {
    // An axis that bends: its chord is a different line, and a wall is a straight
    // one, so the body's footprint places it and the report names the curve.
    const bent = file((t, storey) => t.wall(storey, "Bent", [0, 0], 6000, 200, 3000, 0, { axisCurve: t.line([[0, 0], [3000, 300], [6000, 0]]) }));
    const [product] = readIfcSource(bent, READ).products;
    expect(product?.referenceLine?.straight).toBe(false);
    expect(product?.referenceLine?.unread).toBeUndefined();
    expect(product?.referenceLine?.points).toHaveLength(3);
    const bentPlan = importIfc(bent, opts());
    expect(walls(bentPlan.records)[0]).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 }, thickness: 200, referenceLineInferred: true });
    expect(bentPlan.report.notes.join(" | ")).toMatch(/inferred from its body's footprint \(the file's reference line is curved\)/);

    // An axis built from an arc is named, not approximated: no ArcIndex point list
    // is guessed at, and a circle axis says so.
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    const circle = t.add("IFCCIRCLE", `#${t.axis2([0, 0])},3000.`);
    t.product("Level 1", "IFCWALL", "Curved", [0, 0, 0], t.shape([t.extrude(t.rect(6000, 200, [3000, 0]), 3000)], null, circle), ".STANDARD.");
    const arcPlan = importIfc(asText(t), opts());
    const [arcProduct] = readIfcSource(asText(t), READ).products;
    expect(arcProduct?.referenceLine).toEqual({ points: [], straight: false, unread: "a curve with arcs" });
    expect(arcPlan.report.notes.join(" | ")).toMatch(/the file's reference line is a curve with arcs/);
  });

  it("the sample model: every wall on the axis the file gives, at the counts steps 1-5 reached", () => {
    const text = readFileSync(join(__dirname, "../../../sample-models/IfcOpenHouse_IFC4.ifc"), "utf8");
    const input = { model: hostModel(), referenceId: "ref-house", sourceKey: "v1", sourceId: "ver-house-1", label: "IfcOpenHouse", disciplines: ["architecture", "structure"] } as const;
    const source = readIfcSource(text, input);
    expect(source.products).toHaveLength(34);
    const read = source.products.filter((p) => p.entity === "IfcWall");
    expect(read).toHaveLength(4);
    // Every wall carries an Axis, and every one of them is a straight run.
    expect(read.every((p) => p.referenceLine?.straight === true && p.referenceLine.points.length === 2)).toBe(true);
    const plan = importIfc(text, input);
    expect(walls(plan.records)).toHaveLength(4);
    expect(plan.records.filter((r) => r.kind === "opening")).toHaveLength(1);
    expect(plan.report.converted).toBe(6);
    expect(plan.report.summary).toBe("Converted 4 walls, 1 door and 1 footing. Left 20 members, 5 plates, 2 roof decks, 1 roof, 1 stair flight and 5 windows as the linked model.");
    // The file's 360 mm brick wall is centred on its axis, so nothing to carry and
    // nothing inferred: same thickness, same 30 m of wall as the body derivation gave.
    for (const wall of walls(plan.records)) {
      expect(wall.thickness).toBe(360);
      expect(wall.referenceJustification).toBe("center");
      expect(wall.offsetFromReferenceLineMm).toBeUndefined();
      expect(wall.referenceLineInferred).toBeUndefined();
    }
    const length = takeoffTotals(landImport(hostModel(), plan.records).model.elements).find((t) => t.measure.key === "qto.length");
    expect(Math.round(length?.value ?? 0)).toBe(30);
    expect(plan.report.notes.join(" | ")).not.toMatch(/reference line inferred/);
    // The file's one 360 mm brick layer states its outer face 180 mm from the
    // reference line: the set spans ±180 round the axis, which is exactly where
    // the body sits. Read the other way round it would sit at 180…540.
    const south = source.products.find((p) => p.name === "South wall");
    expect(south?.layerSet).toMatchObject({ referenceLineOffsetMm: 180, totalThicknessMm: 360 });
    expect(south?.layerSet?.layers.map((l) => l.offsetFromReferenceLineMm)).toEqual([-180]);
  });
});
