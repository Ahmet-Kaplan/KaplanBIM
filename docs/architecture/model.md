# The model

## What it owns

`packages/bim-kernel/src/types.ts` (`ModelState`, the element records,
`Partition`, `Connection`), `registry/` (element kinds and the class registry),
`kinds/` (a kind's ends, values and stored shape), `parts.ts` (types,
parameters), `connections/` and `routing/` (connected networks),
`organization/` (groups, phases, filters), `partition.ts`, and the record
directories — `questions/`, `submittals/`, `lifecycle/` (gates),
`responsibility/` (sign-offs), `site.ts`. Nothing here knows a price.

## The contract

1. **`ModelState` is the whole of it**: `{ modelId, revision, elements,
   connections, settings }` (`types.ts:547-553`). Elements are a plain record
   keyed by id; `settings` is four tolerances plus the model's pack pins and
   requirements sources (`types.ts:555-577`). Everything is a plain serializable record, frozen and
   shared between revisions (`store.ts`), which is what makes a commit copy only
   what changed.
2. **An element kind is a registry row, not a union member.** The kernel types
   its own generic kinds (`KERNEL_ELEMENT_KINDS`, `registry/element-kinds.ts:8-49`)
   and declares them exhaustively at `:52-54`, so a new kernel kind that this
   list misses is a compile error. Everything else arrives as a row of
   `ELEMENT_KIND_POINT` (`registry/element-kind-point.ts:11-31`): the parameter
   values a record keeps, the flat fields older records stored them under, the
   kind's checks, its connector ends, its stored shape, its nature
   (`physical`/`intent`/`record`/`document`), how it draws and what it is called.
   A record whose kind this build cannot type is kept as stored (`UnknownRecord`,
   `types.ts:525-534`), and an add-on that wants a TypeScript shape for its own
   kind fills `AddOnElementTypes` by declaration merging (`types.ts:120-130`) —
   that shaping is a convenience for the add-on, never a kernel dependency.
3. **Types and parameters.** Elements may share a type. A value on the element
   beats its type's, which beats the parameter's default
   (`parts.ts:669-671`). Every parameter names a unit kind: a `ParamDef` carries
   the stored v1 unit name and resolves through `paramUnitBinding`
   (`parts.ts:135-142`) to a `ParameterDef` with a `kind` and a `unit`
   (`parts.ts:150-180`), and the kernel holds no unit table of its own
   (`registry/units.ts:1-6`). A length is millimetres, an angle degrees, on the
   wire and in the model; display conversion happens at the edge.
4. **Connected networks.** A connection is one record naming both ends
   (`types.ts:541-545`), so a link cannot exist on one side only. Which ends a
   kind has, which lead downstream and where each sits come from its row
   (`kinds/ends.ts:7-18`, `connectorEndsTable`), not from a kernel list. Where a
   run meets a part or another run, the routing checks own size, system and
   domain; the integrity checks own end types, and they only advise
   (`connections/integrity.ts:16-30`). Network adapters, from add-ons
   (`connections/adapter.ts:31-38`), say what can serve what; the core owns ids,
   back-links, slot bookkeeping, undo and validation (`:27-29`).
5. **Organization.** Every element is in a group and is created in a phase,
   optionally demolished in a later one (`types.ts:97-102`); views show a group
   and a phase through a filter. The group, phase and filter lists are model
   elements of kind `organization`, so they sync, conflict and undo like
   everything else (`organization/model.ts:10-23`). Nothing in a locked group is
   created, changed, moved in, moved out or deleted, and a derived total still
   recomputes inside it (`organization/rules.ts:1-14`, `lockRefusal` at `:75`).
6. **Partitions.** Every element falls into a `{ level, zone, discipline }`
   partition (`types.ts:83-87`), so a client can load only the areas it needs.
   The index is carried forward per revision, never rebuilt.
7. **Records without geometry are elements too.** A site constraint, a program
   area, a question, a submittal, a gate, a sign-off is a record with a kind and
   a nature of `intent`, `record` or `document`
   (`registry/element-kind-point.ts:150-165`). They are in `elements`, so they
   merge, undo and partition like a wall. `k10-record-kind-row.test.ts` proves a
   row that is never drawn survives the store, the index, validation and the
   derived pass.
8. **No money in the model.** Models hold quantities; a price comes from the
   reader's own cost source at read time (`qto/types.ts:1-10`,
   `cost/price.ts:10-16`). The reason is not taste: one model is read by the
   owner, the contractor and every subcontractor, and each has their own price
   book. A price stored in the model would be one party's number, months stale,
   and wrong for everyone else — and it would be wrong in the place where it
   looks authoritative. So `bim-units` still has a `money` kind
   (`bim-units/src/codes.ts:56`) for money that exists outside a model, and
   `priceTakeoff` multiplies the model's quantities in the reader's process and
   writes nothing.
9. **Derived values are recomputed, never stored as intent.** `finish`
   recomputes derived fields for the ids a command touched and counts them in
   `changedIds`, and records them as *never authored intent*
   (`command-core.ts:249-250`, `derived.ts:16-22`).

## How it goes wrong

- **A new element kind as a kernel union member.** It works, and it puts a
  trade's shape in the layer every trade shares: the next pack copies it, and
  the kernel grows a table of words (`KERNEL_ELEMENT_KINDS` is already 40). The
  test of the right thing is a row plus `ELEMENT_KIND_POINT`, and
  `k10-addon-kind-shape-and-ends.test.ts` / `k14-outside-pack-kind-rows.test.ts`
  are the worked examples. *Tell:* a `case "<kind>"` in `command-core.ts` or a
  new member in `types.ts`.
- **A parameter without a unit kind.** It resolves to
  `PARAM_UNIT_BINDINGS.none`, then sums against a length, and the total is
  nonsense no reader can see is nonsense. *Tell:* a `ParamDef` with `kind:
  "number"` and no `unit`.
- **A price smuggled into a parameter.** A number parameter with `unit: "USD"`
  passes `isUnitCode`, saves, syncs, and prices the model through the back door.
  **No test refuses it**: `parts.ts` and the registry never mention money or
  currency, and `q7-cost-never-stored.test.ts:66-71` checks the *command keys*
  only. Review-only.
- **Derived state written back.** A command that sets `airflowTotal`, or a
  client that sends a total as an edit, lands an authored write on a computed
  field; the next legitimate recompute then conflicts with it, or the number is
  simply stale. Derived numbers belong in `derived.ts`'s output, never in a
  command's `authored` list.
- **Two places holding "the same" number.** A type's value and an element's
  copy, both edited: the element wins at read time, so the type's edit silently
  does nothing. The rule is one direction only — element over type.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-kernel/src/registry/element-kinds.ts:52-54` (compile) | a kernel element kind missing from `KERNEL_ELEMENT_KINDS` | a trade kind added there |
| `packages/bim-kernel/__tests__/k10-addon-kind-shape-and-ends.test.ts`, `k10-record-kind-row.test.ts` | an add-on kind joining the network with no kernel edit; a record kind (no shape, no ends) passing conformance | a kernel `case` on a trade kind |
| `packages/bim-kernel/__tests__/k14-no-mechanical-kind-names.test.ts`, `k14-outside-pack-kind-rows.test.ts` | the kernel naming or narrowing on a Mechanical kind; row-driven schedule listing, authored marks and zone membership | the same for the other trades |
| `packages/bim-kernel/__tests__/q7-cost-never-stored.test.ts` | no model command takes money (`:66`); pricing leaves the model, its next changeset and the stored records byte-identical (`:44`) | a currency parameter, a price in a note |
| `packages/bim-kernel/__tests__/organization.test.ts`, `model-settings.test.ts` | groups, phases and locks; settings round-tripping, including the double-encoded settings old models hold (`types.ts:590-596`) | a rule that bypasses `finish` |
| `packages/bim-kernel/__tests__/c5s-changeset-carry.test.ts`, `g7-incremental.test.ts` | carried indexes, and the requirements graph, answering exactly as a fresh build does after random edits | a derived value a client computed and sent |
| `packages/bim-kernel/src/__tests__/r5p-parameters.test.ts`, `packages/bim-kernel/__tests__/c11-addon-unit-kind.test.ts`, `packages/bim-kernel/src/part-model/unit-gate.ts` | one unit vocabulary; an add-on's own unit kind; a unit code written only to a peer that reads it | a **missing** unit on a new parameter: no guard; review-only |
