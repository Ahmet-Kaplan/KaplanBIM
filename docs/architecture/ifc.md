# IFC

## What it owns

| Where | What |
|---|---|
| `packages/bim-ifc/src/import/read-products.ts` | A hand-written STEP reader. `readIfcSource` (`:119`) turns every placed product into a neutral `ImportProduct` and **decides nothing** |
| `packages/bim-ifc/src/import/geometry.ts` | Placements and the solids it reads exactly: extruded area solids (rectangle, circle, polyline, a steel section's bounding rectangle), mapped items, bounding boxes, and mesh bounds. Everything else is reported in words (`:1-9`) |
| `packages/bim-ifc/src/import/index.ts` | `importIfc` (`:21`): read, then plan, in one step |
| `packages/bim-kernel/src/import/types.ts` | The neutral IR: `ImportProduct`, `ImportGeometry`, `ImportLayerSet`, `IfcImportPlan`, `IfcImportReport` |
| `packages/bim-kernel/src/import/plan.ts` | `planIfcImport` (`:61`): the second, separate step. The reverse class map picks a class and a rule; levels, types, layers and the report come out of it |
| `packages/bim-kernel/src/import/rules.ts` | The kernel's ten rules (`KERNEL_IMPORT_RULES`, `:420`): wall, slab, room, ceiling, column, beam, opening, run segment, part, component |
| `packages/bim-pack-architecture/src/import.ts` | The architecture add-on's four rules (`ARCHITECTURE_IMPORT_RULES`): roof, stair, glazed panel, mullion/transom — the last two over the add-on's own `curtain.ts` kinds |
| `packages/bim-kernel/src/import/shape.ts` | The few readings every rule shares: a vertical prism, a straight sweep, a plan rectangle's centre line |
| `packages/bim-kernel/src/import/joins.ts` | Step 6: a file's wall pieces become the walls the building has — fragments merged, L and T ends slid onto their neighbours — on the products, before any of them becomes a record |
| `packages/bim-kernel/src/import/room-identity.ts` | `matchRooms`: which room of an earlier import a room of this one is — its number or label, then its seed, then its outline's share/cover fit — with the thresholds it uses |
| `packages/bim-kernel/src/import/room-changes.ts` | `roomChanges`: the room-level change set between two revisions (added, removed, area delta, label, height), as data |
| `packages/bim-ifc/src/export.ts` | Model → IFC 4.3 ADD2 (`IFC_SCHEMA`, `:76`), deterministic, no clock, GlobalIds derived from stable ids |

## The contract

1. **Reading and deciding are two steps, and the reader never decides.** The
   reader's output is products with geometry, properties, ports, groups, a
   storey, a type id and a layer set (`read-products.ts:298-330`). *What* a
   product becomes is answered in `planIfcImport` (`plan.ts:61`), by the class
   whose registry `ifc` hint matches it and that class's import rule
   (`import/rule-point.ts:1-16`). A pack's class comes in through its own rule
   with no kernel or importer edit (`i9-reverse-map.test.ts:54`).
2. **What is read.** Local placements; extruded area solids; mapped items; a
   type's representation when the product has none of its own
   (`read-products.ts:263-271`); `IfcRelAggregates`,
   `IfcRelContainedInSpatialStructure`, `IfcRelDefinesByType`,
   `IfcRelAssociatesClassification`, `IfcRelDefinesByProperties`,
   `IfcRelVoidsElement` + `IfcRelFillsElement`, `IfcRelAssociatesMaterial`
   (including `IfcMaterialLayerSetUsage`), `IfcRelNests` +
   `IfcRelConnectsPortToElement` + `IfcRelConnectsPorts`,
   `IfcRelAssignsToGroup`. Length scale comes from the project's unit
   assignment, defaulting to metres (`:85-105`).
3. **What is refused, in words, on the linked model.** A union or an
   intersection, a mesh or faceted BRep, a bounding box only, an unreadable
   section, a shape placed on a grid or alignment, a form the reader has no case
   for. Each becomes a `stay` line in the report with its reason and count
   (`plan.ts:139-143`), never a record. **Body only**: `bodyFirst`
   (`geometry.ts:154-165`) reads the Body representation, else Box, else
   everything that is not `Axis`, `Footprint`, `Annotation` or `Plan`. The
   `Axis` is not part of the body and is read on its own (item 7).
4. **A clipped solid is measured, not vetoed.** The reader reads a boolean
   difference's first operand — the whole solid with the cut left in — sets
   `cutsLeftIn` and keeps `unread = "cut by another shape"` (`geometry.ts:203-208`).
   `holdsWholeShape` (`shape.ts:26`) admits it, because a cut-left-in reading
   **over**-measures and never under-measures. The plan then says what was
   measured: "N elements were measured from its uncut solid … so what was cut
   out isn't subtracted" (`plan.ts:252-256`). Before this fix the same walls
   were refused, and every door behind them went with them.
5. **A file's type becomes a real `element_type`.** The reader carried a
   type's GlobalId, name and codes on the neutral product all along
   (`read-products.ts:159-173,307-309`); what it had nowhere to put was a
   record. `typeFor` (`plan.ts:158-200`) makes one `element_type` per converted
   type — carrying the type's build-up and classification — and stamps `typeId`
   on its instances, so the takeoff groups by the file's own type name or code
   instead of collapsing a trade into one line. A free-string `wallType` stays
   on the wall for older readers and groups nothing
   (`i9-import-types.test.ts:1-11`).
6. **A build-up takes off per layer, per face.** `IfcMaterialLayerSetUsage` is
   read whole — material, thickness, order and `OffsetFromReferenceLine`, with
   the layers re-based on the reference line (`read-products.ts:385-429`) — and
   lands on the wall or its type as `layers` (`import/layers.ts`). The takeoff
   then measures each layer's net face area and its own volume
   ([qto](qto.md)). `material` remains the first layer's name for older readers.
   The stated offset is where the set's **outer face** falls from the reference
   line, and `DirectionSense` says which way the build-up grows from it, so the
   layers' faces are `offset ± thickness` in turn, not the offset counted
   backwards. The sample model settles it: its centred 360 mm wall states −180,
   which places the set across the line (−180…+180, where its body is) rather
   than beside it (180…540).
7. **A wall's reference line is the file's Axis.** The reader keeps the `Axis`
   representation as `ImportReferenceLine` on the neutral product
   (`geometry.ts:176` `readAxis`: `IfcPolyline`, `IfcIndexedPolyCurve`, `IfcLine`,
   `IfcTrimmedCurve`, `IfcCompositeCurve`), and the wall rule stores it as
   `start`/`end`, measures the body **across** it (`shape.ts:115` `acrossReferenceLine`) for the
   thickness, and carries where the body's centre falls from it as
   `offsetFromReferenceLineMm` (positive to the left, with `referenceJustification`
   when the line is one of the body's faces or its centre). Thickening such a
   wall leaves the line — and its neighbours' faces — alone. IFC has no
   justification attribute, so nothing is read as one: a file expresses the
   reference line geometrically (the body's place) and in
   `IfcMaterialLayerSetUsage.OffsetFromReferenceLine` (the line's place in the
   build-up), and both are kept as the numbers they are.
8. **A curtain wall comes in as the two things a firm prices.** An `IfcPlate`
   is a panel and an `IfcMember` a line of framing, through the Architecture
   add-on's own classes and kinds (`arch.curtain_panel`,
   `arch.curtain_member`) — the words *mullion*, *transom* and *curtain* stay
   out of the kernel, whose ten rules read a plain solid. A panel's quantity is
   the sheet's own largest face (so a curved, tapered or lying-flat sheet still
   comes in, stating `areaSqM` when that face isn't the upright rectangle its
   plan extent and height give); a member's is its length along the direction
   it runs furthest in — its push (a mullion extruded up) or one of its
   profile's sides (a transom extruded up its own 90 mm) — with its section
   `volume / length`, exact for a prism whatever plane its profile is in, and
   its rectangle or circle kept as the profile size the takeoff groups by
   (`i9-curtain-walls.test.ts`). Neither class names a predefined type: a
   façade exports its glass as `CURTAIN_PANEL` and as often as the plain
   `SHEET`, and a class that does name one outranks these.
9. **Export is IFC 4.3 ADD2 and preserves the links, not just the shapes.**
   Spatial tree, spaces and zones, distribution systems and circuits, ports and
   port connections, types through `IfcRelDefinesByType`, property sets and
   quantity sets, assemblies, groups, grid axes, units from `bim-units`
   (`c5i-export.test.ts:122-238`). An element no class recognises, or a hint the
   schema lacks, is written as `IfcBuildingElementProxy` **and reported**:
   'used IfcBuildingElementProxy for 2 building elements because class
   "arch.wall" is unavailable' (`proxy-diagnostics.test.ts`).
10. **A room keeps its identity when the walls around it change.** A firm
    receiving a model each revision cannot compare quantities otherwise: a
    re-export gives every product a new GlobalId, so revision 2's "Room 101"
    would be a different record from revision 1's and no delta could be read.
    `matchRooms` (`import/room-identity.ts`) pairs them, strongest claim first:
    the file's own number (`Name`) and then its label (`LongName`) where a key
    names exactly one room on each side, then the polylabel seed within
    `SEED_MATCH_MM`, then the share/cover fit above `FIT_MATCH_SCORE`, each on
    one storey. A room nothing older resembles is **new**; a pairing is written
    on the new record as `continuesId` (`types.ts` `Room`), never by rewriting
    the earlier record, and `import/room-changes.ts` says what moved — area with
    its delta, number, label, height. **Nothing here renames, merges or deletes
    a room**: a person's name for a room is theirs, and the report carries the
    disagreement for them to settle. A first import matches nothing, because
    there is nothing to match against: the section reports `comparedAgainst: 0`
    and every room is added (`room-identity.test.ts`).

## How it goes wrong

- **A clipped solid vetoed.** The symptom is not "one wall missing". The walls
  vanish, then the door hosted in one of them has no host and goes too, and the
  report says the geometry was unreadable while the reader had in fact read a
  clean base extrusion. `i9-boolean-clip.test.ts` and the sample-model counts pin
  it (products 34, walls 4, door 1).
- **`unread` set and then silently measured less than the model holds.** A union
  or an intersection measuring its first operand is the dangerous direction: a
  wall half its real length still lands, still measures, and nobody notices.
  `holdsWholeShape` (`shape.ts:26`) exists for that asymmetry alone.
- **A layer offset dropped.** Without `referenceLineOffsetMm`, a 15 + 170 + 15
  wall cannot say which face the reference line is on, so every layer's offset
  is relative to nothing. The reader re-bases on it
  (`read-products.ts:426-428`); a build-up whose stated total and the shape's
  thickness part ways by more than 5 mm is a report note (`plan.ts:258-266`),
  because the layers' volumes then do not add up to the element's.
- **A proxy fallback that does not report the classification it lost.** An
  export that quietly writes `IfcBuildingElementProxy` hands the reader a
  model with no classes in it and no reason. The warning names the class and
  the add-on that would have provided it (`proxy-diagnostics.test.ts`).
- **The wall axis reconstructed from the body.** This was the state before
  step 6's prerequisite: the reader took only Body (`bodyFirst`) and the rule
  rebuilt a centre line from the body footprint's long side, so `start`/`end`
  were the *body's* centre line. A justification had nowhere to live, the layer
  offsets were relative to a reference nobody had read, and thickening a wall
  moved its line and every neighbour's face with it. The reader now keeps the
  Axis (`ImportReferenceLine`), the rule stores it as `start`/`end` and measures
  the body across it (`i9-wall-axis.test.ts`). What is left for joins is the
  direction they were waiting for: the stored line is the reference line, and
  `offsetFromReferenceLineMm` says where the body is, so the join solve
  (`bim-kernel/src/joins/solve.ts:1-27`) can place faces instead of guessing
  them from a centre line.
- **A reference line inferred and not said.** A file may give a wall no Axis at
  all, or one that is an arc. The rule then falls back to the body footprint —
  the old behaviour — and marks the record `referenceLineInferred`, with a line
  in the report naming why; otherwise an inferred line looks exactly like a read
  one, and a thickness edit later moves the line while everyone assumes the
  face.
- **A revision compared as if it were a new model.** Two imports of one linked
  model produce two sets of room records with different ids. Without the
  pairing every room reads as removed and every room as added, the takeoff
  totals look unchanged while every line in them is a different element, and the
  one number a firm wants — *Room 101: 18.4 m² → 17.9 m²* — cannot be produced
  at all. The change set is data, not prose, so a schedule or a script reads it.
- **A room renamed from a file.** The file's label is not the model's. Writing it
  onto the record a person named is the one act that makes a quantity history
  untrustworthy, so the pass reports the difference and changes nothing
  (`room-identity.test.ts`, "does not rename a room a person named").

## Where the guard is

`packages/bim-ifc/__tests__/` is the suite; the `i9-*` families carry the import.

| Guard | Pins |
|---|---|
| `i9-convert-sample.test.ts` | The sample model: **34 products** read, **31 converted** (`report.converted = 31`: 20 mullions and transoms, 5 curtain wall panels, 4 walls, 1 door, 1 footing), the exact summary sentence, the 2 roof decks, roof, stair and 5 windows left linked; four walls as one `class|Walls|4` takeoff line because the file carries no type; total length 30 m of wall, 32.8 m of framing, 11.93 m² of glazing |
| `i9-curtain-walls.test.ts` | A `.SHEET.` plate as a panel by m² and a `.MULLION.` member by length (section 0.0081 m², size group `90 × 90 mm`); a transom drawn as its section pushed along its length reading the same; the file's type reaching a panel and a member (`element_type`, grouped by type); a tapered sheet converting with its face area; a flat-lying sheet stating its own m²; an L-section keeping length and area and saying it named no profile size; two pieces of sheet staying linked with the reason |
| `i9-boolean-clip.test.ts` | A difference converts with `unread` and `cutsLeftIn` both set and the note saying so; a union and an intersection stay linked, in words |
| `i9-import-types.test.ts` | Two typed walls as two lines named after their types; one type as one line with both walls; an untyped wall keeping the class line beside the typed one; a type's code grouping by classification |
| `i9-import-layers.test.ts` | The whole build-up in order with its offsets; a ventilated cavity named; the layers landing and taking off per face (three faces of 18.00 m²); the 240-vs-200 mm note; the sample model's one 360 mm brick layer over four walls summing to their net face area (117.8 m²) |
| `i9-wall-axis.test.ts` | The axis kept on the product in mm whatever the file's unit; `start`/`end` from the axis where the body sits 100 mm to one side; a layered wall whose stated `OffsetFromReferenceLine` is the line the body sits on; the body's measured place winning where the two disagree; an axis-less wall falling back with `referenceLineInferred` and a report line; a curved axis reported as unread rather than chorded; the sample model's four walls each on a straight axis at the counts above |
| `bim-kernel/__tests__/i9-reference-line.test.ts` | The sign of `offsetFromReferenceLineMm` (positive to the left of start → end), the extent across the line rather than a box round an angled end, and a bent or unread line answering null |
| `i9-report.test.ts` | The sentence a person reads; a shardless curtain wall staying linked with its reason; a clipped wall measured and its door arriving with it |
| `bim-kernel/__tests__/room-identity.test.ts` | A first import pairing nothing and stamping nothing; a second revision pairing a room whose wall moved with its area delta reported and the untouched rooms unchanged; a room a person renamed keeping the person's name with the disagreement reported; a new room added rather than paired with the nearest; two rooms sharing a label settled by seed and then by outline; rooms on different storeys never pairing; and both thresholds just inside and just outside (400 mm of seed, 0.8 of fit, and a division under a new number staying unpaired) |
| `i9-reverse-map.test.ts` | Every built-in class with an IFC home mapping back to itself; a pack's class mapping back with zero kernel edits |
| `proxy-diagnostics.test.ts` | The proxy fallback reporting the class it lost, and not warning when nothing was lost |
| `c5i-export.test.ts`, `c5i-tower.test.ts` | IFC4X3_ADD2 with no dangling references, identical bytes twice, stable GlobalIds across edits, types, ports, quantity sets, units |
| `i9-import-layers.test.ts` + `bim-kernel/src/__tests__/import-layers.test.ts` | that the importer adds no i18n or React to the kernel |
