import type { BimElement, ElementId, ParamValue, Vec2 } from "../types";

/**
 * A linked model's products as the importer reads them, before anything
 * decides what they become (round 9 I9). Neutral: an IFC reader fills it
 * (`@permitzip/bim-ifc`), and so could any other open format. Lengths are
 * millimetres in the host model's plan frame (x east, y north, z up), the
 * linked model's placement already applied.
 */
export interface ImportPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A plane profile pushed along a vector: the one solid the importer reads exactly. */
export interface ImportExtrusion {
  /** The profile's outline in world space, in order (a circle is sampled; `radius` says it was one). */
  readonly base: readonly ImportPoint[];
  /** Where the profile moves to: `base[i] + along` is the far face. */
  readonly along: ImportPoint;
  /** Set when the profile is a circle: its centre and radius. */
  readonly circle?: { readonly centre: ImportPoint; readonly radius: number };
  /** Set when the profile is a rectangle: its two side lengths (first along the profile's own x). */
  readonly rectangle?: { readonly x: number; readonly y: number };
}

/** What the reader understood of a product's shape. */
export interface ImportGeometry {
  readonly extrusions: readonly ImportExtrusion[];
  /** World box of everything it read (extrusions, boxes, mapped shapes). Null: no shape it could read. */
  readonly bounds: { readonly min: ImportPoint; readonly max: ImportPoint } | null;
  /** Why the shape couldn't be read exactly ("a curved surface", "a boolean cut"), when it couldn't. */
  readonly unread: string | null;
  /**
   * Set when `extrusions` is the product's own solid with its cuts left in (a
   * boolean difference's first operand). It measures what the model holds or
   * more, never less, so an import rule converts it and the report says that
   * what was cut out isn't subtracted; `unread` still names the cut. Absent for
   * any other reading that isn't exact (a mesh, a box, a shape on a grid),
   * which holds the product on the linked model: measuring less than the model
   * holds is worse than refusing.
   */
  readonly cutsLeftIn?: true;
}

/**
 * A product's own reference line, as the file states it apart from the solid
 * (an IFC `IfcShapeRepresentation` whose identifier is `Axis`): the line the
 * element is dimensioned and placed by, which its body sits across. A wall is
 * thickened on each side of this line and never moved by it, so it is what an
 * import stores as the wall's `start`/`end`. Points are world mm, start to
 * end.
 */
export interface ImportReferenceLine {
  /** Along the line, start to end (empty when the file gives an Axis nothing here could read). */
  readonly points: readonly ImportPoint[];
  /**
   * Whether it is one straight run. False when it bends or is built from
   * arcs: a straight line cannot stand for it, and a rule that needs one must
   * say the reference was inferred rather than use the chord.
   */
  readonly straight: boolean;
  /** Why it could not be read as a line at all, when it could not ("a curve with arcs"). */
  readonly unread?: string;
}

/** A code from the file's own classification (Uniclass, OmniClass, a firm's list), as text. */
export interface ImportClassification {
  readonly system: string;
  readonly code: string;
}

/**
 * One layer of a product's build-up, as the file states it (an IFC
 * `IfcMaterialLayer` in an `IfcMaterialLayerSet`, directly or through an
 * `IfcMaterialLayerSetUsage`): what it is made of, how thick it is, where it
 * sits in the build-up and where its outer face falls from the file's
 * reference line. Read, never interpreted: what a layer costs is the firm's
 * data, not this.
 */
export interface ImportLayer {
  /** The layer's material, as the file names it ("Brick", "Sıva"). */
  readonly materialName: string;
  /** Its thickness, mm (the file's length unit converted). */
  readonly thicknessMm: number;
  /** Its place in the build-up, 1 for the file's first (outermost) layer. */
  readonly order: number;
  /**
   * Where its outer face falls from the reference line, mm: the set's own
   * outer face where the file states it, then each layer's thickness in turn
   * in the direction the build-up grows. Negative when the face is on the
   * other side of the reference line. An `IfcMaterialLayer` states no offset
   * of its own, so this is worked out from the set's usage, not read.
   */
  readonly offsetFromReferenceLineMm: number;
  /** The file says this layer is ventilated (a drained cavity). */
  readonly ventilated?: true;
}

/** A product's build-up: the file's layers in its order, with the set's own numbers. */
export interface ImportLayerSet {
  /** The set's name as the file gives it ("Wall", "WD-01 200mm tuğla"). */
  readonly name: string | null;
  readonly layers: readonly ImportLayer[];
  /** The set's total thickness, mm: as the file states it, else its layers summed. */
  readonly totalThicknessMm: number;
  /**
   * Where the reference line sits inside the set, mm from its outer face along
   * the direction the build-up grows (the file's `OffsetFromReferenceLine`,
   * measured back from that face): 0 with the line on the outer face, half the
   * total with it through the middle.
   */
  readonly referenceLineOffsetMm: number;
}

/**
 * A wall the file says this one is joined to (an IFC `IfcRelConnectsPathElements`),
 * with how each side meets: `ATSTART`, `ATEND` or `ATPATH` of its own path, as the
 * file states it. Read for the join pass, which may close a larger gap between two
 * walls the file itself calls joined than between two it says nothing about.
 */
export interface ImportPathJoin {
  /** The other wall's `sourceId`. */
  readonly otherId: string;
  /** How this wall meets the other, as the file states it; null when it doesn't say. */
  readonly selfType: string | null;
  /** How the other meets this one. */
  readonly otherType: string | null;
}

/** A connection point on a product (an IFC port), for the report and for joins. */
export interface ImportPort {
  readonly id: string;
  readonly name: string | null;
  readonly position: ImportPoint | null;
  /** SOURCE, SINK, SOURCEANDSINK as the file says; null when it doesn't. */
  readonly flow: string | null;
  /** Ports it is joined to in the file (their ids). */
  readonly connectedTo: readonly string[];
}

export interface ImportProduct {
  /** The file's stable id for it (an IFC GlobalId). */
  readonly sourceId: string;
  /** The schema's entity name (`IfcWall`). */
  readonly entity: string;
  readonly predefinedType: string | null;
  readonly objectType: string | null;
  readonly name: string | null;
  readonly longName: string | null;
  readonly tag: string | null;
  /** The storey it sits in (its `sourceId`). */
  readonly storeyId: string | null;
  /** Its type object (`sourceId`) and that type's name. */
  readonly typeId: string | null;
  readonly typeName: string | null;
  /** The element whose opening it fills (doors, windows). */
  readonly hostId: string | null;
  /** Codes the file gives the type itself, for the `element_type` its instances get. */
  readonly typeClassification?: readonly ImportClassification[];
  /** Groups it is assigned to (distribution systems), by `sourceId`. */
  readonly groupIds: readonly string[];
  readonly geometry: ImportGeometry;
  /**
   * The line the file gives it apart from its body (an IFC `Axis`
   * representation). Absent: the file states none for it, and any rule that
   * needs one has to infer it from the body — and say that it did.
   */
  readonly referenceLine?: ImportReferenceLine;
  /** Property and quantity sets, by set name then property name. */
  readonly properties: Readonly<Record<string, Readonly<Record<string, ParamValue>>>>;
  /** Overall width and height the file states (doors and windows carry them). */
  readonly overall: { readonly width: number | null; readonly height: number | null };
  readonly material: string | null;
  /** Its build-up as the file states it, or null when it has none (a plain material, a shape alone). */
  readonly layerSet: ImportLayerSet | null;
  /** Walls the file says it is joined to, by `sourceId` (`IfcRelConnectsPathElements`); absent when the file states none. */
  readonly pathJoins?: readonly ImportPathJoin[];
  readonly ports: readonly ImportPort[];
}

export interface ImportStorey {
  readonly sourceId: string;
  readonly name: string;
  /** Floor elevation in the host frame, mm. */
  readonly elevationMm: number;
}

/** A group in the file (an IFC distribution system): what it carries, in the file's own words. */
export interface ImportGroup {
  readonly sourceId: string;
  readonly entity: string;
  readonly name: string | null;
  readonly predefinedType: string | null;
  readonly objectType: string | null;
}

export interface ImportSource {
  /** What the elements remember they came from (`provenance.source`): the linked model version. */
  readonly id: string;
  /** The model's name and disciplines, for the report's words ("Main St – Acme"). */
  readonly label: string;
  readonly disciplines: readonly string[];
  readonly storeys: readonly ImportStorey[];
  readonly groups: readonly ImportGroup[];
  readonly products: readonly ImportProduct[];
  /** Products the reader saw but could not read at all, and why (counts by entity). */
  readonly unreadable: readonly { readonly entity: string; readonly count: number; readonly reason: string }[];
}

/** One class's line in the report. */
export interface ImportClassLine {
  readonly classId: string | null;
  /** What a person calls them ("Walls"; the file's entity name when no class knows it). */
  readonly label: string;
  readonly converted: number;
  /** Stayed on the linked model, by reason in plain words. */
  readonly linked: readonly { readonly reason: string; readonly count: number }[];
}

/**
 * A wall the file splits into pieces, which the import merged back into one
 * (`import/joins.ts`). Named here rather than only counted, because a merge
 * shortens the wall's takeoff line: a person has to be able to see which wall
 * changed and what it was before.
 */
export interface ImportWallMerge {
  /** The product the pieces became (the first piece's id). */
  readonly sourceId: string;
  /** The name a person reads for it. */
  readonly name: string;
  /** Every piece it came from, the kept one included, in line order. */
  readonly pieces: readonly { readonly sourceId: string; readonly name: string }[];
  /** The pieces' lines summed, and the merged line, mm: the wall reads shorter than the pieces did. */
  readonly lengthBeforeMm: number;
  readonly lengthAfterMm: number;
  /** The closest the pieces were to each other, mm: positive for a gap, negative for an overlap. */
  readonly gapMm: number;
}

/** What the wall join pass did (`import/joins.ts`), for the report and for review. */
export interface ImportJoinResult {
  readonly merged: readonly ImportWallMerge[];
  /** Wall ends slid along their own axis onto a neighbour's reference line or face, and the longest of those moves, mm. */
  readonly endsMoved: number;
  readonly longestMoveMm: number;
  /** Pairs left as two walls because they lie on one line and overlap further than a merge may. */
  readonly coincidentPairs: number;
  /** Junctions the join pass made that the file itself states (`IfcRelConnectsPathElements`), of those it states among converted walls. */
  readonly statedJoins: number;
  readonly statedJoinsInFile: number;
  /** Walls whose reference line was inferred from the body, which take no part in joining or merging. */
  readonly inferredLeft: number;
}

export interface IfcImportReport {
  readonly source: { readonly id: string; readonly label: string; readonly disciplines: readonly string[] };
  readonly converted: number;
  readonly stayLinked: number;
  /** New levels made for storeys no level matched. */
  readonly levelsAdded: readonly string[];
  readonly classes: readonly ImportClassLine[];
  /** What the wall join pass did before any product became a record (absent in plans that made no such pass). */
  readonly joins?: ImportJoinResult;
  /** Joins between converted parts the file had and the model couldn't make, and other things to look at. */
  readonly notes: readonly string[];
  /** One sentence: "Converted 412 walls, 96 doors, 38 rooms. Left 4 roofs, 6 stairs as the linked model." */
  readonly summary: string;
}

/** What an import writes: every record new, each carrying `provenance`. */
export interface IfcImportPlan {
  readonly records: readonly BimElement[];
  /** Source ids that converted, by the element id they became. */
  readonly converted: ReadonlyMap<string, ElementId>;
  readonly report: IfcImportReport;
}

/** What a rule writes for one product. */
export type ImportRuleResult =
  | { readonly ok: true; readonly records: readonly BimElement[] }
  | { readonly ok: false; readonly reason: string };

/** A 2D outline helper's answer. */
export type PlanOutline = readonly Vec2[];
