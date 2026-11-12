# Quantities and takeoff

## What it owns

| Where | What |
|---|---|
| `packages/bim-kernel/src/qto/measure.ts` | How each element measures itself: the `kernel` rules for its building classes (`:37-360`) and the resolution that picks one (`measureElement`, `:443`) |
| `packages/bim-kernel/src/qto/takeoff.ts` | `takeoffTotals` (`:163`): every measured value totalled into lines, keyed by group, size, stage, type and measure, rebuilt per element record and carried to the next revision by re-measuring only what changed |
| `packages/bim-kernel/src/qto/group.ts` | `qtoGroupOf` (`:45`) — what a line groups under — and `qtoLineGroupOf` (`:74`) — where a line a rule reports on its own hangs |
| `packages/bim-kernel/src/qto/types.ts` | The vocabulary: `MeasureDef` (key, kind, unit, "from", label, primary), `MeasureLine` (a layer), `MeasureRuleDef`, and the extension points `MEASURE_RULE_POINT` and `COST_SOURCE_POINT` (`:203`) |
| `packages/bim-kernel/src/qto/fields.ts` | The `qto.*` derived parameters a schedule column reads (`:91-100`) |
| `packages/bim-kernel/src/qto/boundary.ts`, `hosted.ts` | Boundary measures for a room's faces; the per-revision index of what each host hosts |
| `packages/bim-kernel/src/elements/material-layers.ts` | A build-up on a type or an element, and `MATERIAL_LAYER_CODE_POINT` (`:86`) with `layerCodeOf` (`:93`) — the firm's material → code rows |
| `packages/bim-kernel/src/cost/` | `priceTakeoff` (`price.ts:102`) and the party-filtered price sources (`sources.ts:55,60`). **Outside the model** |

## The contract

1. **The chain is measure → total → group.** `measureElement(elements, el, set)`
   (`measure.ts:443`) returns SI values by `qto.*` key plus any lines the rule
   reports on their own. `takeoffTotals(elements)` (`takeoff.ts:163`) turns each
   element's measurement into one line per (group, size, stage, type, measure)
   and adds it to the running total. Grouping is `qtoGroupOf`, in this order —
   **classification code → the type's name → the class → the kind**
   (`group.ts:45-62`), and every group carries words a person reads
   (`"TEST-0100 Partitions"`, `"1-hour wall"`, `"Doors"`).
2. **The measure vocabulary is short and each key states what it is measured
   from.** `qto.count` (`ea`), `qto.length` (`m`, centreline), `qto.area`
   (plan area less holes), `qto.area_gross` and `qto.area_net` (one wall face,
   then less hosted doors and windows), `qto.volume`, `qto.area_surface`,
   `qto.mass` (count × a type's unit weight, or length × weight per length).
   Each `MeasureDef` names its unit code as well as its kind
   (`types.ts:24-38`), so a measure cannot be added without saying what unit it
   is in.
3. **Layer measures are what a finish is priced by.** For each layer of a
   host's build-up, `qto.layer_area` is **m² of one face of the host, net of its
   openings**, and `qto.layer_volume` is that face × the layer's thickness
   (`measure.ts:44-55`). A rule reports layers through `lines()`, and the wall's
   is `layerLines(set, wallFaces(el, elements).net)` (`:99-105`), where `net` is
   `length × height` less `voidAreaM2` of every `hostVoidsOf` the wall hosts
   (`:123-130`; `hosting/voids.ts:34`). So a 15 + 170 + 15 mm wall with plaster
   at both ends takes off as **two plaster faces and one block face**, each with
   its own volume (`__tests__/q7-layer-takeoff.test.ts:76-86`). Each layer line
   groups *under* its element's group but on its own key
   (`group.ts:1-15,75`), so plaster never folds into the wall's volume.
4. **Grouping order is a money decision, not a formatting one.** A Revit type
   name carried as a free string groups nothing: every imported wall collapses
   into one "Walls" line. A real `element_type` record does group, by its name
   or by the code it carries (`group.ts:58-59`). The wall rule still writes
   `wallType` as a free string for older readers (`import/rules.ts:90`); the
   grouping uses `typeId`.
5. **The cost-code seam is data, not logic.** A firm maps its own layer names
   to its own codes through `MATERIAL_LAYER_CODE_POINT` rows
   (`material-layers.ts:86`). A layer no row names **still takes off**,
   labelled by its own material — a named but unpriced line is useful, a
   dropped line is not (`group.ts:64-72`; `__tests__/q7-layer-takeoff.test.ts:99-120`).
   The kernel knows no cost code of its own.
6. **No money in the model.** QTO reads quantities. A price is somebody's price
   book, applied in the reader's process only: `COST_SOURCE_POINT`
   (`types.ts:203`) filtered by party (`cost/sources.ts:55`), multiplied by
   `priceTakeoff` (`cost/price.ts:102`). Models hold quantities; the next
   changeset is byte-identical with and without the pricing.

## How it goes wrong

- **A measure that silently omits openings.** `qto.area_net` forgetting
  `hostVoidsOf`, or a rule that cannot read an opening because it is not hosted,
  reports a face as bigger than it is — and every finish priced on it is over.
  *Tell:* a net value equal to the gross value on a wall with a door.
- **A wall collapsing into one "Walls" line because it has no type.** No
  `element_type`, no `typeId`, so grouping falls through to the class. The
  sample model shows it: four walls, one line, and the report says so
  (`bim-ifc/__tests__/i9-convert-sample.test.ts:165-175`).
- **A layer dropped when it has no cost code.** The tempting fix for "unpriced
  lines" is to filter them out; the result is a plasterer whose m² vanished from
  the takeoff. *Tell:* a `takeoffTotals` caller filtering on
  `group.classification !== undefined`.
- **A measure added without a unit kind.** `MeasureDef` requires `kind` and
  `unit` (`types.ts:24-38`); a rule that returns a bare number in a new key
  produces a value whose column has no unit and whose total is not a quantity.
- **A layer's m² read as a per-element field.** The layer measures exist in the
  takeoff, not in `qto/fields.ts`'s eight fields (`fields.ts:91-100`), so a
  schedule column cannot yet show "plaster m² for this wall" — it shows the
  takeoff line. *Tell:* a schedule definition naming `qto.layer_area`.
- **A price creeping into the model.** A cost slot stored on an element, or a
  command that takes money. `__tests__/q7-cost-never-stored.test.ts` and
  `q7-party-privacy.test.ts` exist precisely for this.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-kernel/__tests__/q7-layer-takeoff.test.ts` | each layer's face and volume as its own line; a two-sided finish staying two lines; a face net of the door it hosts (18 → 16.11 m²); a mapped layer taking the firm's code and an unmapped one keeping its name; a wall with no build-up measuring exactly as before | a build-up whose layers sum to a different thickness than the shape (that is a report note, `import/plan.ts:255-266`) |
| `packages/bim-kernel/__tests__/q7-measure-rules.test.ts` | the kernel's rules: slab area net of holes, volume × thickness, a beam's weight from its type, a type edit re-measuring its instances, `qto.area_net` agreeing with a schedule column | a rule a pack adds |
| `packages/bim-kernel/__tests__/q7-takeoff-by-code-and-stage.test.ts` | an instance code beating its type's, stages grouping, totals adding per group, and codes/stages never changing a design value | — |
| `packages/bim-kernel/__tests__/q7-cost-never-stored.test.ts` | the model state, changeset and stored bytes identical with and without pricing; no model command taking money | a price a firm stores in its own library |
| `packages/bim-kernel/__tests__/q7-party-privacy.test.ts` | a sub's session not seeing, listing or being told about the GC's list | — |
| `packages/bim-kernel/__tests__/q7-dependsOn-quantity-delta.test.ts`, `q7-qto-perf.test.ts` | a measure re-running when what it read changed; the takeoff's time budget at scale | — |
| `packages/bim-ifc/__tests__/i9-import-layers.test.ts:107-121` | the sample model's four 360 mm brick layers summing to the walls' net face area (117.8 m²) | — |
