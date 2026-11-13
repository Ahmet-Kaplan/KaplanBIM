/**
 * @jest-environment node
 *
 * Room identity across design revisions: a firm that receives a model each
 * revision can only compare quantities if revision 2's "Room 101" is the same
 * room as revision 1's. `import/room-identity.ts` pairs them — its own number
 * or label first, then a seed that did not move much, then the share/cover fit
 * of its outline — and `import/room-changes.ts` says what moved.
 *
 * What is proven here:
 *
 *  - **A first import pairs nothing.** A model with no room from an earlier
 *    import of this linked model compares against nothing, every room is added,
 *    and no record is stamped: the feature is invisible until a second
 *    revision.
 *  - **A wall moves, one room changes.** Two imports differing only in one
 *    room's wall: that room is paired with its earlier record and its area
 *    delta is reported; the rooms the revision did not touch pair with
 *    nothing changed at all.
 *  - **A person's name is not touched.** A room renamed in the model, then
 *    re-imported with the file's old name, keeps the person's name on the
 *    record a person reads; the disagreement is reported, not applied.
 *  - **A new room is new.** A room the revision adds is added, never paired
 *    with the nearest old one.
 *  - **A name alone names nothing.** Two rooms sharing a label are settled by
 *    their seeds, and by their outlines when the seeds are no help.
 *  - **The thresholds are where they say**, just inside and just outside.
 */
import {
  DEFAULT_SETTINGS,
  KERNEL_IMPORT_RULES,
  asElementId,
  asRevision,
  builtinRegistry,
  labelSeedOf,
  landImport,
  matchRooms,
  outlineArea,
  planIfcImport,
  roomChanges,
  type ImportProduct,
  type ImportSource,
  type ModelState,
  type Room,
  type Vec2,
} from "@permitzip/bim-kernel";
import { FIT_MATCH_SCORE, SEED_MATCH_MM } from "../src/import/room-identity";

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function room(id: string, outline: Vec2[], words: { number: string; name: string }, opts: { level?: string; seed?: Vec2 | null; heightMm?: number } = {}): Room {
  const seed = opts.seed === null ? null : (opts.seed ?? labelSeedOf(outline));
  return {
    id: asElementId(id),
    version: 1,
    authoredRev: {},
    partition: { level: opts.level ?? "Level 1", zone: "Z1", discipline: "general" },
    kind: "room",
    number: words.number,
    name: words.name,
    outline,
    areaSqM: Math.round((outlineArea(outline) / 1e6) * 100) / 100,
    ...(seed ? { labelSeed: seed } : {}),
    ...(opts.heightMm !== undefined ? { ceilingHeightMm: opts.heightMm } : {}),
  };
}

describe("matchRooms", () => {
  it("pairs nothing when there is nothing to pair against: one import adds every room", () => {
    const now = [room("a", rect(0, 0, 4000, 3000), { number: "101", name: "Office" }), room("b", rect(4000, 0, 8000, 3000), { number: "102", name: "Store" })];
    const match = matchRooms([], now);
    expect(match.pairs).toEqual([]);
    expect(match.added).toEqual([asElementId("a"), asElementId("b")]);
    expect(match.removed).toEqual([]);
  });

  it("pairs a room with the same number and reports the area that moved", () => {
    const before = [room("old", rect(0, 0, 4000, 3000), { number: "101", name: "Office" })];
    const after = [room("new", rect(0, 0, 3700, 3000), { number: "101", name: "Office" })];
    const [pair] = matchRooms(before, after).pairs;
    expect(pair).toMatchObject({ previousId: "old", id: "new", reason: "number" });
    // A 300 mm wall move: the new room sits wholly inside the old one and fills 92.5% of it.
    expect(pair?.share).toBeCloseTo(1, 6);
    expect(pair?.cover).toBeCloseTo(0.925, 6);
    expect(pair?.score).toBeCloseTo(0.961, 3);
    const set = roomChanges(before, after);
    expect(set.unchanged).toBe(0);
    expect(set.pairs[0]?.changes).toEqual([{ field: "areaSqM", before: 12, after: 11.1, deltaSqM: -0.9 }]);
    expect(set.added).toEqual([]);
    expect(set.removed).toEqual([]);
  });

  it("pairs an unchanged room with nothing changed at all", () => {
    const before = [room("old", rect(0, 0, 4000, 3000), { number: "101", name: "Office" }, { heightMm: 2800 })];
    const after = [room("new", rect(0, 0, 4000, 3000), { number: "101", name: "Office" }, { heightMm: 2800 })];
    const set = roomChanges(before, after);
    expect(set.pairs[0]?.changes).toEqual([]);
    expect(set.unchanged).toBe(1);
  });

  it("pairs a room a person renamed when the file keeps its number, and reports the name rather than applying it", () => {
    // The model holds a room a person called "Büro"; the file still says "Office".
    const before = [room("old", rect(0, 0, 4000, 3000), { number: "101", name: "Büro" })];
    const after = [room("new", rect(0, 0, 4000, 3000), { number: "101", name: "Office" })];
    const set = roomChanges(before, after);
    expect(set.pairs[0]?.reason).toBe("number");
    expect(set.pairs[0]?.changes).toEqual([{ field: "name", before: "Büro", after: "Office" }]);
    // Nothing was renamed: both records still say what they said.
    expect(before[0]?.name).toBe("Büro");
    expect(after[0]?.name).toBe("Office");
  });

  it("pairs a renumbered room by its seed, so a fileside renumbering does not lose the history", () => {
    const outline = rect(0, 0, 4000, 3000);
    const before = [room("old", outline, { number: "101", name: "Office" })];
    // Same place, 300 mm narrower, renumbered: a number that differs refuses the
    // label's claim, and the seed (moved 150 mm) carries the room instead.
    const after = [room("new", rect(0, 0, 3700, 3000), { number: "201", name: "Büro 1" })];
    const [pair] = matchRooms(before, after).pairs;
    expect(pair).toMatchObject({ previousId: "old", id: "new", reason: "seed" });
    expect(pair?.seedApartMm).toBeCloseTo(150, 6);
  });

  it("is not fooled by a label alone: two rooms named the same are settled by their seeds", () => {
    const left = rect(0, 0, 3000, 4000);
    const right = rect(3000, 0, 6000, 4000);
    // Renumbered from 101/102 to 201/202, both still called "Office".
    const before = [room("old-l", left, { number: "101", name: "Office" }), room("old-r", right, { number: "102", name: "Office" })];
    const after = [room("new-r", right, { number: "202", name: "Office" }), room("new-l", left, { number: "201", name: "Office" })];
    const match = matchRooms(before, after);
    expect(match.pairs.map((p) => [p.previousId, p.id, p.reason]).sort()).toEqual([
      ["old-l", "new-l", "seed"],
      ["old-r", "new-r", "seed"],
    ]);
  });

  it("settles two rooms sharing a label by their outlines when their seeds are no help", () => {
    const left = rect(0, 0, 3000, 4000);
    const right = rect(3000, 0, 6000, 4000);
    const noSeed: { seed: Vec2 | null } = { seed: null };
    const before = [room("old-l", left, { number: "101", name: "Office" }, noSeed), room("old-r", right, { number: "102", name: "Office" }, noSeed)];
    const after = [room("new-r", right, { number: "202", name: "Office" }, noSeed), room("new-l", left, { number: "201", name: "Office" }, noSeed)];
    const match = matchRooms(before, after);
    expect(match.pairs.map((p) => [p.previousId, p.id, p.reason]).sort()).toEqual([
      ["old-l", "new-l", "fit"],
      ["old-r", "new-r", "fit"],
    ]);
  });

  it("adds a genuinely new room instead of pairing it with the nearest", () => {
    // A room the revision adds right beside an existing one: its seed is 1000 mm
    // away (too far) and it shares no floor, so it is new.
    const before = [room("old", rect(0, 0, 3000, 4000), { number: "101", name: "Office" })];
    const after = [room("new", rect(4000, 0, 7000, 4000), { number: "103", name: "Store" })];
    const match = matchRooms(before, after);
    expect(match.pairs).toEqual([]);
    expect(match.added).toEqual([asElementId("new")]);
    expect(match.removed).toEqual([asElementId("old")]);
    expect(roomChanges(before, after)).toMatchObject({
      pairs: [],
      added: [{ id: "new", number: "103", name: "Store", areaSqM: 12, ceilingHeightMm: null }],
      removed: [{ id: "old", number: "101", name: "Office", areaSqM: 12, ceilingHeightMm: null }],
    });
  });

  it("never pairs rooms on different storeys, however alike", () => {
    const outline = rect(0, 0, 4000, 3000);
    const before = [room("old", outline, { number: "101", name: "Office" }, { level: "Level 1" })];
    const after = [room("new", outline, { number: "101", name: "Office" }, { level: "Level 2" })];
    expect(matchRooms(before, after).pairs).toEqual([]);
  });

  it("names every pairing's signal, so a person can see why two records were called one room", () => {
    const before = [room("old", rect(0, 0, 4000, 3000), { number: "101", name: "Office" })];
    const after = [room("new", rect(0, 0, 4000, 3000), { number: "101", name: "Office" })];
    expect(matchRooms(before, after).pairs[0]).toMatchObject({ reason: "number", seedApartMm: 0, share: 1, cover: 1, score: 1 });
  });

  describe("the thresholds, just inside and just outside", () => {
    // The seed threshold, on rooms whose outlines share no floor, so nothing but
    // the seed can pair them: a seed may move SEED_MATCH_MM and no further.
    const seedCase = (apart: number): Room[] => [
      room("new", rect(8000, 0, 12000, 3000), { number: "901", name: "Store" }, { seed: { x: 2000 + apart, y: 1500 } }),
    ];
    const seedPair = (apart: number) =>
      matchRooms([room("old", rect(0, 0, 4000, 3000), { number: "101", name: "Office" }, { seed: { x: 2000, y: 1500 } })], seedCase(apart)).pairs;

    it(`a seed ${SEED_MATCH_MM} mm away still pairs`, () => {
      const [pair] = seedPair(SEED_MATCH_MM);
      expect(pair).toMatchObject({ reason: "seed", previousId: "old", id: "new" });
      expect(pair?.seedApartMm).toBeCloseTo(SEED_MATCH_MM, 6);
    });

    it(`a seed ${SEED_MATCH_MM + 1} mm away does not`, () => {
      expect(seedPair(SEED_MATCH_MM + 1)).toEqual([]);
    });

    // The fit threshold: a 6.0 × 4.0 m room whose successor is inside it and
    // 4.0 m deep. At 4.01 m wide the score is 0.801; at 3.99 m it is 0.799.
    const fitCase = (widthMm: number): Room[] => [room("new", rect(0, 0, widthMm, 4000), { number: "901", name: "Store" })];
    const fitPair = (widthMm: number) => matchRooms([room("old", rect(0, 0, 6000, 4000), { number: "101", name: "Office" })], fitCase(widthMm)).pairs;

    it(`a fit scoring just over ${FIT_MATCH_SCORE} pairs`, () => {
      const [pair] = fitPair(4010);
      expect(pair).toMatchObject({ reason: "fit", previousId: "old", id: "new" });
      expect(pair?.score).toBeGreaterThan(FIT_MATCH_SCORE);
      expect(pair?.score).toBeCloseTo(0.801, 3);
    });

    it(`a fit scoring just under ${FIT_MATCH_SCORE} does not`, () => {
      expect(fitPair(3990)).toEqual([]);
    });

    it("half of a room under a new number is a division, not a continuation", () => {
      // The old room split in two, neither half keeping its number or its label:
      // each half fills all of itself and half of the old room, scoring 0.667 —
      // under the threshold, so both are new rooms and the old one is listed as
      // gone. A division is a person's edit, not a match's.
      const before = [room("old", rect(0, 0, 6000, 4000), { number: "101", name: "Office" })];
      const after = [room("new-a", rect(0, 0, 3000, 4000), { number: "105", name: "Focus" }), room("new-b", rect(3000, 0, 6000, 4000), { number: "106", name: "Meeting" })];
      const match = matchRooms(before, after);
      expect(match.pairs).toEqual([]);
      expect(match.removed).toEqual([asElementId("old")]);
    });

    it("half of a room that keeps its number is that room, with a much smaller area", () => {
      // A partition put through 101 and the number left on one part: the file's
      // own identifier says which room survives, and the report carries the area
      // that went with the rest — the pairing is a claim, not a verdict.
      const before = [room("old", rect(0, 0, 6000, 4000), { number: "101", name: "Office" })];
      const after = [room("new-a", rect(0, 0, 3000, 4000), { number: "101", name: "Office" })];
      const set = roomChanges(before, after);
      expect(set.pairs[0]?.reason).toBe("number");
      expect(set.pairs[0]?.changes).toEqual([{ field: "areaSqM", before: 24, after: 12, deltaSqM: -12 }]);
    });
  });
});

// ---------------------------------------------------------------------------
// Through the import: the pairing is written on the record and in the report.
// ---------------------------------------------------------------------------

const STOREY = { sourceId: "storey-1", name: "Level 1", elevationMm: 0 } as const;

/** A class of this test's own that takes an IfcSpace as a room, so no add-on's packs are needed. */
const REGISTRY = builtinRegistry()
  .extend()
  .addClass({ id: "zz.room", label: "Test rooms", discipline: "general", source: "builtin", ifc: { entity: "IfcSpace", predefinedType: "INTERNAL" }, recognize: { elementKinds: ["room"] } })
  .build();

function space(sourceId: string, words: { name: string; longName: string | null }, outline: Vec2[], heightMm = 2800): ImportProduct {
  const base = outline.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  return {
    sourceId,
    entity: "IfcSpace",
    predefinedType: "INTERNAL",
    objectType: null,
    name: words.name,
    longName: words.longName,
    tag: null,
    storeyId: STOREY.sourceId,
    typeId: null,
    typeName: null,
    hostId: null,
    groupIds: [],
    geometry: {
      extrusions: [{ base, along: { x: 0, y: 0, z: heightMm } }],
      bounds: { min: { x: Math.min(...xs), y: Math.min(...ys), z: 0 }, max: { x: Math.max(...xs), y: Math.max(...ys), z: heightMm } },
      unread: null,
    },
    properties: {},
    overall: { width: null, height: null },
    material: null,
    layerSet: null,
    ports: [],
  };
}

function source(version: string, products: readonly ImportProduct[]): ImportSource {
  return { id: version, label: "Test model", disciplines: ["architecture"], storeys: [STOREY], groups: [], products, unreadable: [] };
}

function hostModel(): ModelState {
  return { modelId: "room-identity", revision: asRevision(1), elements: {}, connections: [], settings: DEFAULT_SETTINGS };
}

/** Plan a version of the file against a model, as `landImportOnBranch` does before it lands anything. */
function plan(model: ModelState, version: string, sourceKey: string, products: readonly ImportProduct[]) {
  return planIfcImport(source(version, products), { model, referenceId: "ref-1", sourceKey, registry: REGISTRY, rules: KERNEL_IMPORT_RULES });
}

const roomsOf = (records: readonly { kind: string }[]): Room[] => records.filter((r): r is Room => r.kind === "room");

describe("an import that has nothing to compare against", () => {
  it("pairs nothing, stamps nothing and says so", () => {
    const result = plan(hostModel(), "ver-1", "v1", [
      space("space-a", { name: "101", longName: "Office" }, rect(0, 0, 4000, 3000)),
      space("space-b", { name: "102", longName: "Store" }, rect(4000, 0, 8000, 3000)),
    ]);
    // The section says what was compared against, not only what it found: 0 to pair against on a first import.
    expect(result.report.rooms).toEqual({ comparedAgainst: 0, matched: 0, added: 2, byReason: { number: 0, name: 0, seed: 0, fit: 0 }, changes: [], missing: [] });
    // A single import is invisible: every room is new, unlinked to anything.
    for (const room of roomsOf(result.records)) expect(room.continuesId).toBeUndefined();
  });

  it("says nothing at all when the file holds no room", () => {
    const result = plan(hostModel(), "ver-1", "v1", []);
    expect(result.report.rooms).toBeUndefined();
  });
});

describe("a second revision of the same linked model", () => {
  /** Version 1: two rooms side by side; an office 4.0 × 3.0 m and a store 3.0 × 3.0 m. */
  const v1 = (): ModelState =>
    landImport(
      hostModel(),
      plan(hostModel(), "ver-1", "v1", [space("space-office", { name: "101", longName: "Office" }, rect(0, 0, 4000, 3000)), space("space-store", { name: "102", longName: "Store" }, rect(4000, 0, 7000, 3000))]).records,
    ).model;

  it("pairs a room whose wall moved, reports the delta, and leaves the others untouched", () => {
    const model = v1();
    const first = roomsOf(Object.values(model.elements)).sort((a, b) => a.number.localeCompare(b.number));
    const office = first[0]!;
    const store = first[1]!;

    // Version 2: the office's east wall moved 300 mm west, and nothing else in the file changed.
    const result = plan(model, "ver-2", "v2", [space("space-office", { name: "101", longName: "Office" }, rect(0, 0, 3700, 3000)), space("space-store", { name: "102", longName: "Store" }, rect(4000, 0, 7000, 3000))]);
    const now = roomsOf(result.records);
    const officeNow = now.find((r) => r.number === "101")!;
    const storeNow = now.find((r) => r.number === "102")!;

    // Identity carried: the new records name the rooms they continue.
    expect(officeNow.continuesId).toBe(office.id);
    expect(storeNow.continuesId).toBe(store.id);

    // The report: one room matched with a smaller area, one matched unchanged.
    expect(result.report.rooms).toMatchObject({ comparedAgainst: 2, matched: 2, added: 0, byReason: { number: 2, name: 0, seed: 0, fit: 0 }, missing: [] });
    const changes = result.report.rooms?.changes ?? [];
    expect(changes).toHaveLength(1);
    expect(changes[0]?.previous).toMatchObject({ id: office.id, number: "101", name: "Office", areaSqM: 12 });
    expect(changes[0]?.current).toMatchObject({ id: officeNow.id, areaSqM: 11.1 });
    expect(changes[0]?.changes).toEqual([{ field: "areaSqM", before: 12, after: 11.1, deltaSqM: -0.9 }]);
    // The untouched room is paired and reported as unchanged.
    expect(roomsOf(result.records)[1]?.areaSqM).toBe(store.areaSqM);
  });

  it("does not rename a room a person named, and reports the disagreement", () => {
    const model = v1();
    const room = roomsOf(Object.values(model.elements)).find((r) => r.number === "101")!;
    // A person renames it in this model: the record a person reads now says "Büro".
    const renamed: ModelState = { ...model, elements: { ...model.elements, [room.id]: { ...room, name: "Büro", version: room.version + 1 } } };

    // Version 2 arrives with the file's own name for that room.
    const result = plan(renamed, "ver-2", "v2", [space("space-office", { name: "101", longName: "Office" }, rect(0, 0, 4000, 3000)), space("space-store", { name: "102", longName: "Store" }, rect(4000, 0, 7000, 3000))]);

    // The record a person reads keeps their name: planning writes nothing to the model.
    const kept = roomsOf(Object.values(renamed.elements)).find((r) => r.id === room.id)!;
    expect(kept.name).toBe("Büro");
    // The new record carries the file's name and says which room it continues.
    const now = roomsOf(result.records).find((r) => r.number === "101")!;
    expect(now.name).toBe("Office");
    expect(now.continuesId).toBe(room.id);
    // And the disagreement is in the report, for a person to settle.
    const change = (result.report.rooms?.changes ?? []).find((c) => c.current.id === now.id);
    expect(change?.changes).toEqual([{ field: "name", before: "Büro", after: "Office" }]);
  });

  it("adds a room the revision added and lists a room it dropped", () => {
    const model = v1();
    const dropped = roomsOf(Object.values(model.elements)).find((r) => r.number === "102")!;
    const result = plan(model, "ver-2", "v2", [
      space("space-office", { name: "101", longName: "Office" }, rect(0, 0, 4000, 3000)),
      // The store is gone; a room in its place that neither shares its number nor
      // its label, and sits where nothing of version 1 is: genuinely new.
      space("space-meeting", { name: "103", longName: "Meeting" }, rect(9000, 0, 12000, 3000)),
    ]);
    expect(result.report.rooms).toMatchObject({ comparedAgainst: 2, matched: 1, added: 1, missing: [{ id: dropped.id, number: "102", name: "Store" }] });
    // The model keeps the dropped room: the report lists it, nothing deletes it.
    expect(Object.values(model.elements).some((el) => el.id === dropped.id)).toBe(true);
    expect(result.records.some((r) => r.kind === "room" && r.number === "103" && r.continuesId === undefined)).toBe(true);
  });

  it("pairs nothing when the storey's level is not the one the earlier import used", () => {
    // A different linked model's rooms are not candidates: same reference only.
    const model = v1();
    const other = planIfcImport(source("ver-2", [space("space-office", { name: "101", longName: "Office" }, rect(0, 0, 4000, 3000))]), {
      model,
      referenceId: "ref-2",
      sourceKey: "v2",
      registry: REGISTRY,
      rules: KERNEL_IMPORT_RULES,
    });
    expect(other.report.rooms).toMatchObject({ comparedAgainst: 0, matched: 0, added: 1 });
  });
});
