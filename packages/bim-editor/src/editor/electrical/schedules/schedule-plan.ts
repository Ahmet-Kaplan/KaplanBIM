import { formScheduleKindLabel, formScheduleKinds, isBoundFormKind, documentIndex, type FormScheduleDefinition, type FormScheduleKind, type ModelState, type ScheduleDefinition } from '@permitzip/bim-kernel'
import { type DistributionSummary } from '@permitzip/bim-pack-electrical'
import { englishOnly, type Translate } from '../../i18n/translate'

/** What the schedule menus offer: the form kinds, plus the mechanical equipment list with its live electrical columns. */
export type ScheduleChoice = FormScheduleKind | 'mechanical_equipment'

/** The schedule menus' choices: the form kinds the add-ons in force make, then the mechanical equipment list. */
export function scheduleChoices(): readonly ScheduleChoice[] {
  return [...formScheduleKinds(), 'mechanical_equipment']
}

/** What the menus call a choice: the add-on's label for a form kind. */
export function scheduleChoiceLabel(choice: ScheduleChoice, t: Translate = englishOnly): string {
  if (choice === 'connection_types') return t('electrical.connectionTypeSchedule', 'Connection type schedule', { ns: 'editor' })
  if (choice === 'mechanical_equipment') return t('electrical.mechanicalEquipmentWithElectrical', 'Mechanical equipment (with electrical)', { ns: 'editor' })
  return formScheduleKindLabel(choice)
}

export const MECHANICAL_EQUIPMENT_SCHEDULE: ScheduleDefinition = {
  category: 'mechanical_equipment',
  // MCA and MOCP as the sheet prints them: the parameters' own labels spell them out in full.
  columns: [{ field: 'mark' }, { field: 'voltage_phase' }, { field: 'mca', heading: 'MCA' }, { field: 'mocp', heading: 'MOCP' }, { field: 'circuit' }],
}

export function isBoundKind(kind: ScheduleChoice): boolean {
  return isBoundFormKind(kind)
}

/** A panelboard's schedule is a panel schedule; a switchboard's or transformer's is a switchboard schedule. */
export function boundKindFor(equipment: Pick<DistributionSummary, 'kind'>): 'panel' | 'switchboard' {
  return equipment.kind === 'panelboard' ? 'panel' : 'switchboard'
}

/** Code rules ids a schedule can compute demand under; absent = connected loads only. */
export function ruleChoices(t: Translate = englishOnly): readonly { readonly value: RuleChoice; readonly label: string }[] {
  return [
    { value: 'none', label: t('electrical.ruleChoice.none', 'Connected loads only', { ns: 'editor' }) },
    { value: 'nec-2020', label: 'NEC 2020' },
    { value: 'nec-2023', label: 'NEC 2023' },
  ]
}

export type RuleChoice = 'none' | 'nec-2020' | 'nec-2023'

const RULE_VALUES: readonly RuleChoice[] = ['none', 'nec-2020', 'nec-2023']

export function ruleChoiceOf(rules: string | undefined): RuleChoice {
  return RULE_VALUES.find((r) => r === rules) ?? 'none'
}

/** The definition with `rules` set, or dropped for connected loads only. */
export function withRules(def: FormScheduleDefinition, rule: RuleChoice): FormScheduleDefinition {
  const rest: FormScheduleDefinition = { kind: def.kind, template: def.template, ...(def.elementId ? { elementId: def.elementId } : {}), ...(def.textSizeMm !== undefined ? { textSizeMm: def.textSizeMm } : {}), ...(def.templateSource ? { templateSource: def.templateSource } : {}) }
  return rule === 'none' ? rest : { ...rest, rules: rule }
}

/** "Panel L1 schedule", "Feeder schedule", made unique against the model's views ("… 2"). */
export function uniqueScheduleName(model: Pick<ModelState, 'elements' | 'connections'>, kind: ScheduleChoice, equipmentName: string | null): string {
  const base = kind === 'panel' && equipmentName ? `Panel ${equipmentName} schedule` : kind === 'switchboard' && equipmentName ? `${equipmentName} schedule` : scheduleChoiceLabel(kind)
  const taken = new Set(documentIndex(model).views.map((v) => v.name.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let n = 2; n < 100; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`
  return `${base} ${Date.now()}`
}

/** Electrical sheet numbers: E-601 (schedules) upward, the first one not taken. */
export function nextScheduleSheetNumber(model: Pick<ModelState, 'elements' | 'connections'>): string {
  const taken = new Set(documentIndex(model).sheets.map((s) => s.number.toUpperCase()))
  for (let n = 601; n < 1000; n++) if (!taken.has(`E-${n}`)) return `E-${n}`
  return 'E-1000'
}

export { freeSpotOnSheet, sheetSpotOf, type SheetSpot } from '../../schedules/new-schedule-plan'

/** The equipment list with live circuit columns, as the one New schedule window offers it (under this add-on). */
export const EQUIPMENT_LIST_CHOICE = { definition: MECHANICAL_EQUIPMENT_SCHEDULE, label: 'Equipment (with electrical)' } as const
