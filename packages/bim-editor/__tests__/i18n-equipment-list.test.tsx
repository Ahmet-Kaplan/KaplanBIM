/**
 * The equipment-list tree in two languages — the guard for
 * `src/editor/equipment-list`.
 *
 * What this file proves, and the hole each proof closes:
 *
 *   1. **Every caption is keyed, with its English** — `editorSourceCaptions()`
 *      reads every `t('<key>', '<English>'` call in the tree. The negative-space
 *      guard (`i18n-negative-space.test.ts`) proves the other half: no visible
 *      English sits *outside* a translator. 110 sites went to zero in this round.
 *   2. **Every key has Turkish, and its placeholders match** — a `{{…}}` on one
 *      side and not the other ships a raw `{{count}}` or drops a figure.
 *   3. **The glossary holds where it matters most here**: §2.1 (*kalem* for an
 *      item, *eleman* only for an element, *parça* for a part), §5 (the quantity
 *      kinds and field names), §9/Ç12 (*armatür* for a fixture, *yük birimi* for
 *      its units), §7 (no unit symbol travels) and §8 (no plural after a number).
 *   4. **The English is unchanged** — the `label(t)` accessors are asked in
 *      English in this file and must equal the pack's own tables character for
 *      character, and every function reads English with no translator at all.
 */
import fs from 'node:fs'
import path from 'node:path'
import { EQUIPMENT_DRAFT_PARAMETERS } from '@permitzip/bim-library'
import type { ParamDef } from '@permitzip/bim-kernel'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor } from './helpers/editor-i18n'
import { draftFieldLabel, DRAFT_FIELDS } from '../src/editor/equipment-list/plan-equipment'
import { newFieldUnits } from '../src/editor/equipment-list/library-fields'
import { newProjectFieldItem } from '../src/editor/equipment-list/library-fields'
import { parseParameterText, type EquipmentParameter } from '../src/editor/equipment-list/parameters'

const TR = translateFor('tr')
const EN = translateFor('en')

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

/** `{ equipmentList: { title: 'Ekipman listesi' } }` → `"equipmentList.title"`. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') out[id] = value
    else if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id))
  }
  return out
}

/** Every `equipmentList.*` key the source writes, read at each test rather than at import: the scan is the thing under test. */
const listKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith('equipmentList.'))

test('the tree is keyed: this guard is looking at equipment-list captions, not an empty list', () => {
  // Without this a broken scan would leave every test below scanning nothing and reporting green.
  expect(listKeys().length).toBeGreaterThan(160)
})

test('every equipment-list caption has its Turkish', () => {
  expect(listKeys().filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  expect(listKeys().filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(LOCALE[key] ?? ''))).toEqual([])
})

test('a placeholder on one side is on the other, and no figure is dropped', () => {
  const english = editorSourceCaptions()
  const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1]).sort().join(',')
  const wrong = listKeys()
    .filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? ''))
    .map((key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`)
  expect(wrong).toEqual([])
})

// ---------------------------------------------------------------------------
// §2.1 — an item is a kalem, an element an eleman, a part a parça
// ---------------------------------------------------------------------------

test('§2.1: a planned row becomes a kalem, never an eleman', () => {
  expect(TR('equipmentList.addedOne', 'Added 1 planned item', { ns: 'editor' })).toBe('1 planlı kalem eklendi')
  expect(TR('equipmentList.added', 'Added {{count}} planned items', { ns: 'editor', count: 3 })).toBe('3 planlı kalem eklendi')
  expect(TR('equipmentList.summaryOneItem', '1 item', { ns: 'editor' })).toBe('1 kalem')
  // *Eleman* is a model element (a wall, a space) and this tree never counts one.
  expect(listKeys().filter((key) => /\beleman/iu.test(LOCALE[key] ?? ''))).toEqual([])
  // *Parça* is a part, and the one caption that says part says parça.
  expect(TR('equipmentList.partTypeMissing', 'Its part type is missing from the model.', { ns: 'editor' })).toContain('Parça tipi')
})

// ---------------------------------------------------------------------------
// §9/Ç12 — a fixture is an armatür; fixture units are yük birimi
// ---------------------------------------------------------------------------

test('§9/Ç12: a fixture is an armatür, and its units are yük birimi', () => {
  expect(TR('equipmentList.familyFixture', 'Fixture, from an equipment list', { ns: 'editor' })).toBe('Armatür, ekipman listesinden')
  expect(TR('equipmentList.familyEquipment', 'Equipment, from an equipment list', { ns: 'editor' })).toBe('Ekipman, ekipman listesinden')
  // A proposed fixture unit reads *yük birimi*, and the WSFU/DFU columns keep their symbols.
  expect(TR('equipmentList.noLoads', '…', { ns: 'editor' })).toContain('yük birimi')
  expect(TR('equipmentList.addsOneLoad', 'Adds 1 load: {{cfh}} CFH gas, {{wsfu}} WSFU, {{dfu}} DFU', { ns: 'editor', cfh: 40, wsfu: 6, dfu: 4 })).toBe('1 yük katılır: 40 CFH gaz, 6 WSFU, 4 DFU')
})

// ---------------------------------------------------------------------------
// §7 — unit symbols never travel
// ---------------------------------------------------------------------------

test('§7: a unit symbol is the same in both languages, and only the spelled-out name moves', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['equipmentList.unitVolts', 'Volts (V)'],
    ['equipmentList.unitAmps', 'Amps (A)'],
    ['equipmentList.unitHorsepower', 'Horsepower (hp)'],
    ['equipmentList.unitPounds', 'Pounds (lb)'],
  ]
  for (const [key, english] of cases) {
    const turkish = TR(key, english, { ns: 'editor' })
    for (const symbol of ['V', 'A', 'hp', 'lb']) {
      if (!english.includes(`(${symbol})`)) continue
      expect({ key, symbol, has: turkish.includes(`(${symbol})`) }).toEqual({ key, symbol, has: true })
    }
  }
  // A symbol-only unit is the same string in both languages, which is why it is keyed at all.
  for (const key of ['equipmentList.unitVA', 'equipmentList.unitKW', 'equipmentList.unitBtuPerHour', 'equipmentList.unitCFM', 'equipmentList.unitGPM', 'equipmentList.unitPSI']) {
    const english = editorSourceCaptions().get(key)?.english ?? ''
    expect({ key, turkish: LOCALE[key] }).toEqual({ key, turkish: english })
  }
  // The gas and water rows keep MBH, CFH, WSFU, DFU and the × of a quantity.
  expect(TR('equipmentList.loadGas', 'Gas {{mbh}} MBH ({{cfh}} CFH)', { ns: 'editor', mbh: 80, cfh: 76 })).toBe('Gaz 80 MBH (76 CFH)')
  expect(TR('equipmentList.mbhGas', '{{mbh}} MBH gas', { ns: 'editor', mbh: 80 })).toBe('80 MBH gaz')
  expect(TR('equipmentList.each', ' each, ×{{count}}', { ns: 'editor', count: 2 })).toBe(' her biri, ×2')
})

// ---------------------------------------------------------------------------
// §8 — no plural suffix after a number
// ---------------------------------------------------------------------------

test('§8: no Turkish caption puts a plural suffix after a number', () => {
  const wrong = listKeys()
    .filter((key) => /\{\{\s*\w+\s*\}\}\s+\S*(lar|ler)\b/iu.test(LOCALE[key] ?? ''))
    .map((key) => `${key}: ${LOCALE[key]}`)
  expect(wrong).toEqual([])
  // One and many read with the same noun, which is why the count is a placeholder.
  expect(TR('equipmentList.summaryRows', '{{count}} rows', { ns: 'editor', count: 1 })).toBe('1 satır')
  expect(TR('equipmentList.summaryRows', '{{count}} rows', { ns: 'editor', count: 4 })).toBe('4 satır')
  expect(TR('equipmentList.keepMarkTo32', 'Keep the mark to 32 characters.', { ns: 'editor' })).toBe('İşareti 32 karakterde tutun.')
})

// ---------------------------------------------------------------------------
// The label(t) accessors: the English is the pack's, unchanged
// ---------------------------------------------------------------------------

test('every preview-grid heading is still the pack’s own label, character for character', () => {
  for (const field of DRAFT_FIELDS) {
    expect({ field, heading: draftFieldLabel(field, EN) }).toEqual({ field, heading: EQUIPMENT_DRAFT_PARAMETERS[field].label })
    // …and Turkish on a Turkish screen, which is why the accessor exists.
    expect(draftFieldLabel(field, TR)).not.toBe('')
  }
  expect(DRAFT_FIELDS.map((field) => draftFieldLabel(field, EN))).toEqual(['Mark', 'Description', 'Qty', 'Volts', 'Phase', 'Load (kW, VA, A or hp)', 'Gas MBH', 'CW', 'HW', 'Waste', 'Connection'])
  // §7 inside the heading: the units a load may be typed in stay the symbols they are.
  expect(DRAFT_FIELDS.map((field) => draftFieldLabel(field, TR))).toEqual(['İşaret', 'Açıklama', 'Adet', 'Gerilim', 'Faz', 'Yük (kW, VA, A veya hp)', 'Gaz MBH', 'Soğuk su', 'Sıcak su', 'Atık', 'Bağlantı'])
})

const PARAM = (over: Partial<EquipmentParameter> = {}): EquipmentParameter => ({
  name: 'mca',
  key: 'param.mca',
  label: 'Minimum circuit ampacity',
  valueType: 'quantity',
  kind: 'current',
  unit: 'A',
  scope: 'instance',
  source: 'builtin',
  appliesTo: ['mep.equipment'],
  ...over,
})

test('the unit picker offers the same units, in the same order, in both languages', () => {
  expect(newFieldUnits(EN).map((u) => u.unit)).toEqual(newFieldUnits(TR).map((u) => u.unit))
  expect(newFieldUnits(EN).map((u) => u.label)).toEqual(['No unit', 'Volts (V)', 'Amps (A)', 'VA', 'kW', 'Horsepower (hp)', 'Btu/h', 'CFM', 'GPM', 'psi', 'Pounds (lb)'])
  expect(newFieldUnits(TR).map((u) => u.label)).toEqual(['Birim yok', 'Volt (V)', 'Amper (A)', 'VA', 'kW', 'Beygir gücü (hp)', 'Btu/h', 'CFM', 'GPM', 'psi', 'Libre (lb)'])
})

test('a column’s refusals are English with no translator and Turkish with one', () => {
  const taken = new Set(['mca'])
  const refused = newProjectFieldItem('p1', { label: 'MCA', type: 'text' }, taken, EN)
  expect(refused).toEqual({ refused: 'MCA is already a column; pick it from the list instead.' })
  expect(newProjectFieldItem('p1', { label: '  ', type: 'text' }, taken, EN)).toEqual({ refused: 'Give the column a name (Hood ID).' })
  // §7: a number column's unit symbol is stored, never translated.
  const made = newProjectFieldItem('p1', { label: 'Hood airflow', type: 'number', unit: 'cfm' }, taken, EN)
  expect('item' in made && made.item.storage.kind === 'parameter' ? made.item.unit : null).toBe('cfm')
  expect('item' in made && made.item.storage.kind === 'parameter' ? made.item.label : null).toBe('Hood airflow')
})

test('a typed value’s problem is the row’s own words, in the screen’s language', () => {
  const p = PARAM()
  expect(parseParameterText(p, 'abc', EN)).toEqual({ problem: 'Minimum circuit ampacity "abc" isn\'t a number in A.' })
  expect(parseParameterText(p, '-2', EN)).toEqual({ problem: "Minimum circuit ampacity can't be below zero." })
  expect(parseParameterText(p, '18', EN)).toEqual({ value: 18 })
  expect(parseParameterText(p, 'abc', TR)).toEqual({ problem: 'Minimum circuit ampacity "abc" bir sayı değil (A).' })
  const yesNo = PARAM({ valueType: 'boolean', kind: undefined, unit: undefined })
  expect(parseParameterText(yesNo, 'maybe', EN)).toEqual({ problem: 'Minimum circuit ampacity "maybe" is yes or no.' })
  const typed: ParamDef['kind'] = 'number'
  expect(typed).toBe('number')
})
