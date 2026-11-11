/**
 * The plumbing tree in two languages — the guard for `src/editor/plumbing`.
 *
 * What this file proves, and the hole each proof closes:
 *
 *   1. **Every caption is keyed, with its English** — `editorSourceCaptions()`
 *      reads every `t('<key>', '<English>'` call in the tree. The negative-space
 *      guard (`i18n-negative-space.test.ts`) proves the other half: no visible
 *      English sits *outside* a translator. 402 sites went to zero in this round.
 *   2. **Every key has Turkish, and its placeholders match** — a `{{…}}` on one
 *      side and not the other ships a raw `{{count}}` or drops a figure.
 *   3. **The glossary holds where it matters most here**: §9/Ç9 (*hat* for a run,
 *      *çalıştır* for the command), §9/Ç17 (*boru*, never *kanal*), §9/Ç12
 *      (*armatür* for a fixture, *yük birimi* for its units), §9/Ç8 (*branşman*,
 *      never *dal*), §9/Ç13 (*debi* / *eğim* / *sürtünme oranı*), §2.3 (*kat*,
 *      *mekan*) and §7 (the unit symbols never travel).
 *   4. **The English is unchanged** — the `label(t)` accessors are asked in
 *      English in this file and must equal the kernel's and the pack's own
 *      tables, character for character, and every panel reads English with no
 *      translator at all.
 */
import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import {
  SYSTEM_PATTERN_LABEL,
  SYSTEM_WEIGHT_LABEL,
  SYSTEM_LINE_PATTERNS,
  SYSTEM_LINE_WEIGHTS,
  type ModelState,
} from '@permitzip/bim-kernel'
import {
  BUILDING_TYPE_LABEL,
  DEMAND_CURVE_LABEL,
  GAS_FUEL_LABEL,
  PLUMBING_BUILDING_TYPES,
  PLUMBING_DEMAND_CURVES,
} from '@permitzip/bim-pack-plumbing'
import { PlumbingSystemsDialog } from '../src/editor/plumbing/PlumbingSystemsDialog'
import { StacksDialog } from '../src/editor/plumbing/StacksDialog'
import { buildingTypeWord, demandCurveWord, gasFuelWord, linePatternWord, lineWeightWord, materialWord } from '../src/editor/plumbing/plumbing-words'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor, Wrap } from './helpers/editor-i18n'

const TR = translateFor('tr')
const EN = translateFor('en')

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

/** `{ plumbing: { stacks: 'Kolonlar' } }` → `"plumbing.stacks"`. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') out[id] = value
    else if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id))
  }
  return out
}

/** Every `plumbing.*` key the source writes, read at each test rather than at import: the scan is the thing under test. */
const plumbingKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith('plumbing.'))

test('the tree is keyed: this guard is looking at plumbing captions, not an empty list', () => {
  // Without this a broken scan would leave every test below scanning nothing and reporting green.
  expect(plumbingKeys().length).toBeGreaterThan(450)
})

test('every plumbing caption has its Turkish', () => {
  expect(plumbingKeys().filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  const wrong = plumbingKeys().filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(LOCALE[key] ?? ''))
  expect(wrong).toEqual([])
})

test('a placeholder on one side is on the other, and no figure is dropped', () => {
  const english = editorSourceCaptions()
  const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1]).sort().join(',')
  const wrong = plumbingKeys().filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? '')).map(
    (key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`,
  )
  expect(wrong).toEqual([])
})

// ---------------------------------------------------------------------------
// §9/Ç9 — a pipe run is a hat; the command is çalıştır
// ---------------------------------------------------------------------------

test('§9/Ç9: a pipe run reads hat, and the word çalıştır is never a run', () => {
  // The scope toggle's Run is the run of pipe, not the command that runs something.
  expect(TR('plumbing.scopeRun', 'Run', { ns: 'editor' })).toBe('Hat')
  expect(TR('plumbing.scopeRun', 'Run', { ns: 'editor' })).not.toContain('çalıştır')
  // The column that counts how many runs a stack has is a hat too.
  expect(TR('plumbing.runs', 'Runs', { ns: 'editor' })).toBe('Hatlar')
  // …and the riposte: no plumbing caption spends *hat* on the verb.
  const wrong = plumbingKeys().filter((key) => LOCALE[key]?.includes('çalıştır') === true && /^plumbing\.(routePipe|hydraulics)/u.test(key))
  expect(wrong).toEqual([])
})

// ---------------------------------------------------------------------------
// §9/Ç17 — pipe is boru, duct is kanal
// ---------------------------------------------------------------------------

test('§9/Ç17: a pipe is a boru, never a kanal', () => {
  expect(TR('plumbing.routePipe', 'Route pipe', { ns: 'editor' })).toBe('Boru çiz')
  expect(TR('plumbing.pipeSize', 'Pipe size', { ns: 'editor' })).toBe('Boru ölçüsü')
  expect(TR('plumbing.pipeTypes', 'Pipe types', { ns: 'editor' })).toBe('Boru tipleri')
  // Not one plumbing caption calls a pipe a duct.
  expect(plumbingKeys().filter((key) => (LOCALE[key] ?? '').includes('kanal'))).toEqual([])
  // The invented verb the glossary forbids ("to pipe") never appears — *borular* is the plural, not the verb.
  expect(plumbingKeys().filter((key) => /\bborula(?![r])/u.test(LOCALE[key] ?? ''))).toEqual([])
})

// ---------------------------------------------------------------------------
// §9/Ç12 — a plumbing fixture is an armatür; fixture units are yük birimi
// ---------------------------------------------------------------------------

test('§9/Ç12: a fixture is an armatür, and its units are yük birimi', () => {
  expect(TR('plumbing.fixture', 'Fixture', { ns: 'editor' })).toBe('Armatür')
  expect(TR('plumbing.attachAFixture', 'Attach a fixture', { ns: 'editor' })).toBe('Armatür bağla')
  // Fixture units are a unit, not an armatür: the glossary keeps both words apart.
  expect(TR('plumbing.fixtureUnitsWord', 'Fixture units', { ns: 'editor' })).toBe('Yük birimi')
  expect(TR('plumbing.fixtureUnitsWord', 'Fixture units', { ns: 'editor' })).not.toContain('armatür')
  // The fixture-mark field is the armatür's mark (§2.3 mark = işaret).
  expect(TR('plumbing.fixtureMark', 'Fixture mark', { ns: 'editor' })).toBe('Armatür işareti')
})

// ---------------------------------------------------------------------------
// §9/Ç8 — a MEP branch is a branşman; a version branch is a dal
// ---------------------------------------------------------------------------

test('§9/Ç8: a MEP branch is a branşman, never a dal', () => {
  expect(TR('plumbing.branchWord', 'Branch', { ns: 'editor' })).toBe('Branşman')
  expect(TR('plumbing.end.branch', 'Branch', { ns: 'editor' })).toBe('Branşman')
  expect(TR('plumbing.branchLengthMethod', 'branch length', { ns: 'editor' })).toBe('branşman uzunluğu')
  // *Dal* is a version branch (§9/Ç8) and this tree has no versions in it.
  expect(plumbingKeys().filter((key) => /\bdal\b/u.test(LOCALE[key] ?? ''))).toEqual([])
})

// ---------------------------------------------------------------------------
// §9/Ç13 — rate: flow is debi, slope is eğim, friction is sürtünme
// ---------------------------------------------------------------------------

test('§9/Ç13: a flow is a debi, a slope an eğim, a friction rate a sürtünme', () => {
  expect(TR('plumbing.flowWord', 'Flow', { ns: 'editor' })).toBe('Debi')
  expect(TR('plumbing.slopeInPerFt', 'Slope (in per ft)', { ns: 'editor' })).toBe('Eğim (in/ft)')
  expect(TR('plumbing.frictionWord', 'Friction', { ns: 'editor' })).toBe('Sürtünme')
  // The design rainfall is a şiddet (an intensity), not a debi and not an eğim.
  const rainfall = TR('plumbing.designRainfall', 'Design rainfall (in/h)', { ns: 'editor' })
  expect(rainfall).toContain('şiddeti')
  expect(rainfall).not.toContain('Debi')
})

// ---------------------------------------------------------------------------
// §2.3 — level is kat, space is mekan
// ---------------------------------------------------------------------------

test('§2.3: a level is a kat, and a space is never an alan', () => {
  expect(TR('plumbing.floor', 'Floor', { ns: 'editor' })).toBe('Kat')
  expect(TR('plumbing.floorByFloor', 'Floor by floor, bottom up', { ns: 'editor' })).toBe('Kat kat, aşağıdan yukarı')
  // *Alan* is reserved for "area" (§2.3): a roof area and a drainage area are alans, a space never is.
  expect(plumbingKeys().filter((key) => /\balan/iu.test(LOCALE[key] ?? '') && !/(çatı|drenaj) alan/u.test(LOCALE[key] ?? ''))).toEqual([])
})

// ---------------------------------------------------------------------------
// §7 — unit symbols never travel
// ---------------------------------------------------------------------------

test('§7: the unit symbols are the same in both languages', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['plumbing.inWc', 'in. w.c.'],
    ['plumbing.designRainfall', 'Design rainfall (in/h)'],
    ['plumbing.pipeSize', 'Pipe size'],
    ['plumbing.thicknessIn', 'Thickness (in.)'],
    ['plumbing.smallestIn', 'Smallest (in)'],
    ['plumbing.totalWsfu', 'Total WSFU'],
    ['plumbing.totalGpm', 'Total gpm'],
  ]
  for (const [key, english] of cases) {
    const turkish = TR(key, english, { ns: 'editor' })
    for (const symbol of ['in. w.c.', 'in/h', 'in.', '(in)', 'WSFU', 'gpm']) {
      if (!english.includes(symbol)) continue
      expect({ key, symbol, has: turkish.includes(symbol) }).toEqual({ key, symbol, has: true })
    }
  }
  // The unit words that carry a figure keep the figure and the symbol.
  expect(TR('plumbing.dfuGpm', '{{dfu}} DFU ({{gpm}} gpm)', { ns: 'editor', dfu: '24', gpm: '38' })).toBe('24 DFU (38 gpm)')
  expect(TR('plumbing.mbhCfh', '{{mbh}} MBH ({{cfh}} cfh)', { ns: 'editor', mbh: '120', cfh: '116' })).toBe('120 MBH (116 cfh)')
  // A regulator's pressure unit is a toggle, and its symbol is a symbol.
  expect(TR('plumbing.inWc', 'in. w.c.', { ns: 'editor' })).toBe('in. w.c.')
})

// ---------------------------------------------------------------------------
// The label(t) accessors: the English is the kernel's and the pack's, unchanged
// ---------------------------------------------------------------------------

test('every building-type, curve, fuel, pattern, weight and material word is the table it replaces', () => {
  for (const type of PLUMBING_BUILDING_TYPES) {
    expect({ type, word: buildingTypeWord(type, EN) }).toEqual({ type, word: BUILDING_TYPE_LABEL[type] })
  }
  for (const curve of PLUMBING_DEMAND_CURVES) {
    expect({ curve, word: demandCurveWord(curve, EN) }).toEqual({ curve, word: DEMAND_CURVE_LABEL[curve] })
  }
  expect(gasFuelWord('natural', EN)).toBe(GAS_FUEL_LABEL.natural)
  expect(gasFuelWord('propane', EN)).toBe(GAS_FUEL_LABEL.propane)
  for (const pattern of SYSTEM_LINE_PATTERNS) {
    expect({ pattern, word: linePatternWord(pattern, EN) }).toEqual({ pattern, word: SYSTEM_PATTERN_LABEL[pattern] })
  }
  for (const weight of SYSTEM_LINE_WEIGHTS) {
    expect({ weight, word: lineWeightWord(weight, EN) }).toEqual({ weight, word: SYSTEM_WEIGHT_LABEL[weight] })
  }
  const materials = ['copper', 'pex', 'cpvc', 'cast_iron', 'pvc', 'abs', 'steel', 'black_steel', 'galvanized', 'pp_r', 'csst', 'pe'] as const
  const english = materials.map((material) => materialWord(material, EN))
  expect(english).toEqual(['Copper', 'PEX', 'CPVC', 'Cast iron', 'PVC', 'ABS', 'Steel', 'Black steel', 'Galvanized steel', 'PP-R', 'CSST', 'Polyethylene (PE)'])
  // …and each one is Turkish on a Turkish screen, which is why the accessor exists.
  expect([...new Set(materials.map((material) => materialWord(material, TR)))][0]).not.toBe('Copper')
  expect(buildingTypeWord('nursing_home', TR)).toBe('Bakımevi')
  expect(linePatternWord('dash_dot', TR)).toBe('Çizgi nokta')
  expect(lineWeightWord('heavy', TR)).toBe('Kalın')
})

// ---------------------------------------------------------------------------
// Rendered surfaces
// ---------------------------------------------------------------------------

const MODEL = { elements: {}, revision: 1 } as unknown as ModelState
const NOOP = (): void => {}
const NO_REFUSAL = (): string | null => null

test('the stacks dialog draws its Turkish, and never the English beside it', () => {
  render(
    <Wrap language="tr">
      <StacksDialog open onOpenChange={NOOP} model={MODEL} editBlocked={null} submit={NO_REFUSAL} />
    </Wrap>,
  )
  expect(screen.getAllByText('Kolonlar').length).toBeGreaterThan(0)
  expect(screen.getByText('Henüz kolon çizilmedi')).toBeTruthy()
  const shown = document.body.textContent ?? ''
  expect(shown).not.toContain('No stacks drawn yet')
  // §9/Ç12: a fixture unit is a *yük birimi*, and the DFU column keeps its symbol.
  expect(shown).toContain('yük birim')
})

test('the stacks dialog is unchanged in English', () => {
  render(
    <Wrap language="en">
      <StacksDialog open onOpenChange={NOOP} model={MODEL} editBlocked={null} submit={NO_REFUSAL} />
    </Wrap>,
  )
  expect(screen.getAllByText('Stacks').length).toBeGreaterThan(0)
  expect(screen.getByText('No stacks drawn yet')).toBeTruthy()
})

test('the systems dialog reads Turkish tabs, and its empty state says what to draw', () => {
  render(
    <Wrap language="tr">
      <PlumbingSystemsDialog open onOpenChange={NOOP} tab="systems" model={MODEL} editBlocked={null} submit={NO_REFUSAL} />
    </Wrap>,
  )
  const shown = document.body.textContent ?? ''
  expect(shown).toContain('Sıhhi tesisat sistemleri')
  expect(shown).toContain('Henüz boru sistemi yok')
  expect(shown).not.toContain('No pipe systems yet')
})

test('the systems dialog is unchanged in English', () => {
  render(
    <Wrap language="en">
      <PlumbingSystemsDialog open onOpenChange={NOOP} tab="systems" model={MODEL} editBlocked={null} submit={NO_REFUSAL} />
    </Wrap>,
  )
  const shown = document.body.textContent ?? ''
  expect(shown).toContain('Plumbing systems')
  expect(shown).toContain('No pipe systems yet')
})
