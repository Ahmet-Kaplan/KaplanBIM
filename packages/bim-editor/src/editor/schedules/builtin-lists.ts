import { equipmentListDefinition } from '@permitzip/bim-library'
import {
  elementsOfKind,
  fieldProviderRegistry,
  PLACEMENT_PLANNED,
  takeoffScheduleDefinition,
  TAKEOFF_SCHEDULE_DESCRIPTION,
  type Command,
  type ModelState,
  type Registry,
  type ScheduleColumnDef,
  type ScheduleDefinitionV2,
} from '@permitzip/bim-kernel'

import { validateScheduleDefinition } from '@permitzip/bim-kernel/schedules'
import { englishOnly, type Translate } from '../i18n/translate'


/**
 * Built-in list schedules for "list first, draw second" (NEXT-BATCH §1, F4):
 * the Equipment list, Not placed yet, and Loads. Each is an ordinary v2
 * schedule: it opens in the schedule grid, edits go back to the model, and it
 * can go on a sheet. Made from New schedule… or from the Equipment list.
 */

export type BuiltinListId = 'equipment_list' | 'not_placed_yet' | 'loads' | 'space_loads' | 'panel_loads' | 'takeoff'

export const BUILTIN_LIST_IDS: readonly BuiltinListId[] = ['equipment_list', 'not_placed_yet', 'loads', 'space_loads', 'panel_loads', 'takeoff']

/** The one-click load schedules (Views › Schedules › Load schedules, and New schedule…). */
export const LOAD_SCHEDULE_IDS: readonly BuiltinListId[] = ['space_loads', 'panel_loads', 'loads']

/*
 * The English of each list lives where it is read — `builtinListLabel` and
 * `builtinListDescription` below — not in a second table beside them. Two tables
 * of English was how a name could be fixed in one place and stay wrong in the
 * other, and it left the built-in definitions carrying a language of their own.
 */

const PART_CLASSES = ['mep.mechanical_equipment', 'mep.air_terminal', 'mep.duct_accessory', 'mep.pipe_accessory', 'mep.plumbing_fixture', 'mep.electrical_equipment', 'mep.electrical_device', 'mep.lighting_fixture', 'gen.generic_model']

const field = (id: string, heading?: string): ScheduleColumnDef => ({ id, kind: 'field', path: id, ...(heading ? { heading } : {}) })
const param = (id: string, heading: string): ScheduleColumnDef => ({ id, kind: 'parameter', path: id, heading, hideWhenEmpty: true })

/**
 * The name a built-in list's view is stored under.
 *
 * Not translated: it is the model's own word for that view, and
 * `findBuiltinListView` finds a list a person made last week by matching it, so
 * a Turkish model must still answer to the name it was made with. Everything a
 * person reads — the tree row, the ribbon, the New schedule dialog — says
 * `builtinListLabel(id, t)` instead.
 */
export function builtinListStoredName(id: BuiltinListId): string {
  return builtinListLabel(id, englishOnly)
}

/**
 * A built-in list's skeleton. `NONE` is what an empty cell prints on paper: a
 * schedule's own convention, never a sentence, and it stays as it is in every
 * language (§7: a sheet's symbols are not words).
 */
const base = (name: string): Pick<ScheduleDefinitionV2, 'name' | 'groups' | 'grandTotals' | 'itemize' | 'presentation' | 'display' | 'filters'> => ({
  name,
  filters: [],
  groups: [],
  grandTotals: false,
  itemize: true,
  presentation: { kind: 'list' },
  display: { textSizeMm: 2.5, emptyText: 'NONE' },
})

/**
 * The Equipment list: the built-in schedule template (round 5b,
 * `@permitzip/bim-library` `equipmentListDefinition`). Its columns are
 * parameters in one group per facet; today's thirteen columns lead with the
 * same ids and headings, and the baseline parameter columns stay hidden until
 * a row has a value. Lists already in a model keep the definition they store.
 */
export const EQUIPMENT_LIST_SCHEDULE: ScheduleDefinitionV2 = equipmentListDefinition()

export function notPlacedYetSchedule(t: Translate): ScheduleDefinitionV2 {
  return {
    ...base(builtinListStoredName('not_placed_yet')),
    source: { kind: 'classes', classes: PART_CLASSES, includeSubclasses: true },
    // The placement field's own word, from the kernel: a filter compares a value,
    // so it is the provider's constant and never a translated word.
    filters: [{ path: 'placement', op: 'equals', value: PLACEMENT_PLANNED }],
    columns: [
      field('mark', 'MARK'),
      field('family', 'WHAT'),
      field('type', 'TYPE'),
      param('description', 'DESCRIPTION'),
      field('planned_level', t('schedule.list.heading.plannedLevel', 'PLANNED LEVEL', { ns: 'editor' })),
    ],
    sort: [{ path: 'mark', direction: 'asc' }],
  }
}

/** A quantity column of what each load counts (the loads provider, typed units); the totals row is the project total. */
const counted = (path: string, heading: string): ScheduleColumnDef => ({ id: path, kind: 'field', path, heading, hideWhenEmpty: true, total: true })

/**
 * Every load row, fixture or point, typed or drawn: where it is in its life
 * (Status says whether it is piped yet) and what it counts, per quantity,
 * with a totals row. On 7329: 25.75 / 13.5 / 30.25 WSFU, 79 DFU, 140 gal/h,
 * 859 CFH. Estimate / Devices so far columns are in Fields.
 */
export function loadsSchedule(t: Translate): ScheduleDefinitionV2 {
  return {
    ...base(builtinListStoredName('loads')),
    grandTotals: true,
    source: { kind: 'classes', classes: ['mep.load_point'], includeSubclasses: true },
    columns: [
      field('mark', 'MARK'),
      { ...field('connection_type.mark', t('schedule.list.heading.connectionType', 'CONNECTION TYPE', { ns: 'editor' })), hideWhenEmpty: true },
      field('load.stage', 'STAGE'),
      field('load.status', 'STATUS'),
      counted('loads.counted.wsfu_cold', t('schedule.list.heading.cwWsfu', 'CW WSFU', { ns: 'editor' })),
      counted('loads.counted.wsfu_hot', t('schedule.list.heading.hwWsfu', 'HW WSFU', { ns: 'editor' })),
      counted('loads.counted.wsfu_total', t('schedule.list.heading.totalWsfu', 'TOTAL WSFU', { ns: 'editor' })),
      counted('loads.counted.dfu', 'DFU'),
      counted('loads.counted.gph_demand', t('schedule.list.heading.hwDemand', 'HW DEMAND', { ns: 'editor' })),
      counted('loads.counted.mbh', t('schedule.list.heading.gasInput', 'GAS INPUT', { ns: 'editor' })),
      counted('loads.counted_gas_flow', t('schedule.list.heading.gasFlow', 'GAS FLOW', { ns: 'editor' })),
      counted('loads.counted.va', t('schedule.list.heading.elecLoad', 'ELEC LOAD', { ns: 'editor' })),
      counted('loads.counted.cfm', 'AIRFLOW'),
    ],
    sort: [{ path: 'mark', direction: 'asc' }],
  }
}

/** Estimate, devices so far and counted for one quantity: the loads provider's three sides, hidden when empty, totalled. */
const sides = (q: string, unitHeading: string, t: Translate): ScheduleColumnDef[] => [
  { id: `loads.allocated.${q}`, kind: 'field', path: `loads.allocated.${q}`, heading: t('schedule.list.heading.estimate', 'ESTIMATE {{unit}}', { ns: 'editor', unit: unitHeading }), hideWhenEmpty: true, total: true },
  {
    id: `loads.actual.${q}`,
    kind: 'field',
    path: `loads.actual.${q}`,
    heading: t('schedule.list.heading.devicesSoFar', 'DEVICES SO FAR {{unit}}', { ns: 'editor', unit: unitHeading }),
    hideWhenEmpty: true,
    total: true,
  },
  {
    id: `loads.counted.${q}`,
    kind: 'field',
    path: `loads.counted.${q}`,
    heading: t('schedule.list.heading.counted', 'COUNTED {{unit}}', { ns: 'editor', unit: unitHeading }),
    hideWhenEmpty: true,
    total: true,
  },
]

const estimateVsDevices = (t: Translate): ScheduleColumnDef => ({
  id: 'loads.estimate_vs_devices',
  kind: 'field',
  path: 'loads.estimate_vs_devices',
  heading: t('schedule.list.heading.estimateVsDevices', 'ESTIMATE VS DEVICES', { ns: 'editor' }),
  hideWhenEmpty: true,
})

/**
 * Space loads: each space's estimate beside the devices placed in it so far
 * and what it counts (product decision, Oct 27, decision 4), for every trade at once.
 * A trade with nothing in the model hides its columns, so one list reads as
 * the electrical, plumbing, gas or air load study.
 */
export function spaceLoadsSchedule(t: Translate): ScheduleDefinitionV2 {
  return {
    ...base(builtinListStoredName('space_loads')),
    grandTotals: true,
    source: { kind: 'classes', classes: ['gen.space'], includeSubclasses: true },
    columns: [
      field('number', 'NUMBER'),
      field('name', 'NAME'),
      { ...field('area', 'AREA'), hideWhenEmpty: true },
      ...sides('va', '(VA)', t),
      ...sides('wsfu_total', '(WSFU)', t),
      ...sides('dfu', '(DFU)', t),
      ...sides('mbh', '(MBH)', t),
      ...sides('cfm', '(CFM)', t),
      estimateVsDevices(t),
    ],
    sort: [{ path: 'number', direction: 'asc' }],
  }
}

/** Panel loads: what names each panel as its source, estimates and devices, and what it counts. */
export function panelLoadsSchedule(t: Translate): ScheduleDefinitionV2 {
  return {
    ...base(builtinListStoredName('panel_loads')),
    grandTotals: true,
    source: { kind: 'classes', classes: ['mep.electrical_equipment'], includeSubclasses: true },
    columns: [field('mark', 'MARK'), field('type', 'TYPE'), ...sides('va', '(VA)', t), estimateVsDevices(t)],
    sort: [{ path: 'mark', direction: 'asc' }],
  }
}

/**
 * The registry a native v2 list that names trade provider fields (Loads, Not
 * placed yet) opens over: the kernel's, with every field provider. The model
 * server's grid and sheet printing use it when the built-in registry refuses
 * such a list (`kernelScheduleEvaluator`, `scheduleV2Paper`), so a list that
 * passes here opens and prints.
 */
export function builtinListRegistry(): Registry {
  return fieldProviderRegistry()
}

/** One built-in list, written in the language the person is working in. */
export function builtinList(id: BuiltinListId, t: Translate = englishOnly): ScheduleDefinitionV2 {
  switch (id) {
    case 'equipment_list':
      return EQUIPMENT_LIST_SCHEDULE
    case 'not_placed_yet':
      return notPlacedYetSchedule(t)
    case 'loads':
      return loadsSchedule(t)
    case 'space_loads':
      return spaceLoadsSchedule(t)
    case 'panel_loads':
      return panelLoadsSchedule(t)
    case 'takeoff':
      return takeoffScheduleDefinition()
  }
}

/**
 * Why a built-in list can't be made in this model yet, in words, or null.
 * The definition is checked against the model's fields, so a list whose
 * fields haven't shipped says so instead of opening an empty grid.
 */
function problemsOf(model: ModelState, def: ScheduleDefinitionV2, id: BuiltinListId, registry?: Registry): readonly { readonly message: string }[] {
  return validateScheduleDefinition(model, def, { viewId: `builtin-${id}`, revision: model.revision, ...(registry ? { registry } : {}) })
}

/**
 * The list as this model can open it. The Equipment list's Placement column
 * needs the placement field (planned parts); a model whose registry doesn't
 * have it yet gets the list without that one column rather than no list.
 */
export function builtinListDefinition(model: ModelState, id: BuiltinListId, t: Translate = englishOnly): ScheduleDefinitionV2 {
  const def = builtinList(id, t)
  if (id !== 'equipment_list' || problemsOf(model, def, id).length === 0) return def
  return { ...def, columns: def.columns.filter((c) => c.id !== 'placement') }
}


/** §5's words for the built-in lists, read at the places that show them rather than stored in the model. */
export function builtinListLabel(id: BuiltinListId, t: Translate): string {
  switch (id) {
    case 'equipment_list':
      return t('schedule.list.equipmentList', 'Equipment list', { ns: 'editor' })
    case 'not_placed_yet':
      return t('schedule.list.notPlacedYet', 'Not placed yet', { ns: 'editor' })
    case 'loads':
      return t('schedule.list.loads', 'Loads', { ns: 'editor' })
    case 'space_loads':
      return t('schedule.list.spaceLoads', 'Space loads', { ns: 'editor' })
    case 'panel_loads':
      return t('schedule.list.panelLoads', 'Panel loads', { ns: 'editor' })
    case 'takeoff':
      return t('schedule.list.takeoff', 'Takeoff', { ns: 'editor' })
  }
}

export function builtinListDescription(id: BuiltinListId, t: Translate): string {
  switch (id) {
    case 'equipment_list':
      return t('schedule.list.equipmentListWhy', 'Every piece of equipment and fixture, planned and placed, with its electrical, gas and water values', { ns: 'editor' })
    case 'not_placed_yet':
      return t(
        'schedule.list.notPlacedYetWhy',
        'Everything that exists but nobody has drawn yet: panels, rooftop units, kitchen items',
        { ns: 'editor' },
      )
    case 'loads':
      return t(
        'schedule.list.loadsWhy',
        'Every load row, fixture or point, typed or drawn: whether it is piped yet, and what it counts (fixture units, gas, power, air) with a totals row',
        { ns: 'editor' },
      )
    case 'space_loads':
      return t(
        'schedule.list.spaceLoadsWhy',
        'Every space with its estimate, the devices placed in it so far, and what it counts, per trade (power, water, drainage, gas, air); columns with nothing in them stay hidden',
        { ns: 'editor' },
      )
    case 'panel_loads':
      return t('schedule.list.panelLoadsWhy', 'Every panel with the estimates and devices that name it as their source, and what it counts', { ns: 'editor' })
    case 'takeoff':
      return t('schedule.list.takeoffWhy', TAKEOFF_SCHEDULE_DESCRIPTION, { ns: 'editor' })
  }
}

export function builtinListBlocked(model: ModelState | null, id: BuiltinListId, t: Translate = englishOnly): string | null {
  if (!model) return t('schedule.modelStillLoading', 'The model is still loading.', { ns: 'editor' })

  let problems: readonly { readonly message: string }[]
  try {
    // As the model server opens it: the built-in registry, else every field provider.
    const def = builtinListDefinition(model, id, t)
    const builtin = problemsOf(model, def, id)
    problems = builtin.length === 0 ? builtin : problemsOf(model, def, id, builtinListRegistry())
  } catch (err) {

    console.error('[builtin-lists] checking a built-in list failed', { id, err })
    return t('schedule.listCannotBeChecked', '{{name}} can’t be checked: {{reason}}', {
      ns: 'editor',
      name: builtinListLabel(id, t),
      reason: err instanceof Error ? err.message : String(err),
    })

  }

  const first = problems[0]
  if (!first) return null
  return t('schedule.listCannotBeMade', '{{name}} can’t be made yet: {{reason}}', { ns: 'editor', name: builtinListLabel(id, t), reason: first.message })

}

export function builtinListCommand(model: ModelState, viewId: string, name: string, id: BuiltinListId, t: Translate = englishOnly): Command {
  return { type: 'create_view', viewId, name: name.trim(), viewType: 'schedule', props: { scheduleV2: { ...builtinListDefinition(model, id, t), name: name.trim() } } }
}

/** The model's schedule view made from a built-in list, by its name, so the Equipment list opens the same one each time. */
export function findBuiltinListView(model: Pick<ModelState, 'elements'> | null, id: BuiltinListId): string | null {
  if (!model) return null
  const want = builtinListStoredName(id).toLowerCase()
  for (const el of elementsOfKind(model.elements, 'view')) {
    if (!el.deleted && el.viewType === 'schedule' && el.props?.scheduleV2 && el.name.toLowerCase() === want) return el.id
  }
  return null
}
