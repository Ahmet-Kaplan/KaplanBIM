/**
 * The linked-display tree in two languages — the guard for
 * `src/editor/linked-display`.
 *
 * This file proves, and the hole each proof closes:
 *
 *   1. **Every caption is keyed, with its English** — `editorSourceCaptions()`
 *      reads every `t('<key>', '<English>'` call in the tree. The negative-space
 *      guard (`i18n-negative-space.test.ts`) proves the other half: no visible
 *      English sits *outside* a translator. 53 sites went to zero in this round.
 *   2. **Every key has Turkish, and its placeholders match** — a `{{…}}` on one
 *      side and not the other ships a raw `{{name}}` in a slider's accessible name.
 *   3. **The English is unchanged** — every look still reads `Normal`, `Halftone`,
 *      `See-through`, `Underlay`, `Hidden`, `Custom` (the kernel's own
 *      `REFERENCE_PRESET_LABEL`), the see-through label still ends in `%`, and an
 *      undo label still says `change how Sample draws its walls`.
 *   4. **The glossary holds**: §2.4 *half tone* = **yarım ton**, §2.3 *underlay* =
 *      **altlık**, and a see-through look is **yarı saydam**.
 *
 * Four English tables became `switch`es of literal `t()` calls
 * (`linked-display-words.ts`), and the kernel's `REFERENCE_PRESET_LABEL` — which
 * used to be spliced into the panels and the undo labels — is no longer read on
 * screen: a Turkish frame never carries the kernel's English.
 */
import fs from 'node:fs'
import path from 'node:path'
import { REFERENCE_PRESET_LABEL, type ReferenceDisplayPreset } from '@permitzip/bim-kernel'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor } from './helpers/editor-i18n'
import { englishOnly } from '../src/editor/i18n/translate'
import { categoryListWord, categoryNounWord, penSideWord, presetWord } from '../src/editor/linked-display/linked-display-words'

const TR = translateFor('tr')

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

/** `{ linkedDisplay: { undoShow: '…' } }` → `"linkedDisplay.undoShow"`. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') out[id] = value
    else if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id))
  }
  return out
}

/** The keys the tree's captions live under, read at each test rather than at import: the scan is the thing under test. */
const treeKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith('linkedDisplay.') || key.startsWith('linkedModel.'))

test('the tree is keyed: this guard is looking at linked-display captions, not an empty list', () => {
  expect(treeKeys().length).toBeGreaterThan(80)
})

test('every caption in the tree has its Turkish', () => {
  expect(treeKeys().filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  expect(treeKeys().filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(LOCALE[key] ?? ''))).toEqual([])
})

test('a placeholder on one side is on the other, and no control loses its name', () => {
  const english = editorSourceCaptions()
  const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1]).sort().join(',')
  const wrong = treeKeys()
    .filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? ''))
    .map((key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`)
  expect(wrong).toEqual([])
})

test('no key in this tree is written twice without a pinned count', () => {
  // Every word here is one lookup, so a second site is a revert somebody wrote.
  const source = editorSourceCaptions()
  const keys = new Set(treeKeys())
  const twice = [...source.entries()]
    .filter(([key, caption]) => keys.has(key) && caption.sites > 1)
    .map(([key, caption]) => `${key}: ${caption.sites}`)
  expect(twice).toEqual([])
})

// ---------------------------------------------------------------------------
// The English is unchanged: the kernel's own words, and the labels the toast read
// ---------------------------------------------------------------------------

test('the six looks read exactly the kernel’s words in English', () => {
  const presets: readonly (ReferenceDisplayPreset | 'custom')[] = ['normal', 'halftone', 'transparent', 'underlay', 'hidden', 'custom']
  const english = presets.map((preset) => englishOnly('x', 'y') && presetWord(preset, englishOnly))
  // The kernel's table is what the screen read before this round; it is no longer read on screen.
  expect(english).toEqual(presets.map((preset) => REFERENCE_PRESET_LABEL[preset]))
  // §2.4: half tone is yarım ton; §2.3: underlay is altlık.
  expect(TR('linkedDisplay.presetHalftone', 'Halftone', { ns: 'editor' })).toBe('Yarım ton')
  expect(TR('linkedDisplay.presetUnderlay', 'Underlay', { ns: 'editor' })).toBe('Altlık')
  expect(TR('linkedDisplay.presetTransparent', 'See-through', { ns: 'editor' })).toBe('Yarı saydam')
  expect(TR('linkedDisplay.presetHidden', 'Hidden', { ns: 'editor' })).toBe('Gizli')
})

test('the see-through label keeps its %, and the undo labels keep their words', () => {
  const english = editorSourceCaptions()
  expect(english.get('linkedDisplay.seeThroughIn3d')?.english).toBe('See-through in 3D: {{pct}}%')
  // §7: a percent sign stays where English put it in the English default; Turkish moves it
  // in front of the figure, which is where a Turkish reader expects it.
  expect(TR('linkedDisplay.seeThroughIn3d', 'See-through in 3D: {{pct}}%', { ns: 'editor', pct: 40 })).toBe('3B\'de yarı saydamlık: %40')
  // `show ${label} ${REFERENCE_PRESET_LABEL[preset].toLowerCase()}`.
  expect(englishOnly('linkedDisplay.undoPreset', 'show {{name}} {{look}}', { name: 'Sample', look: presetWord('halftone', englishOnly).toLowerCase() })).toBe('show Sample halftone')
  // `change ${label}'s ${kind === 'cut' ? 'cut' : 'beyond'} line weight`.
  expect(english.get('linkedDisplay.undoPen')?.english).toBe("change {{name}}'s {{where}} line weight")
  expect(penSideWord('cut', englishOnly)).toBe('cut')
  expect(penSideWord('beyond', englishOnly)).toBe('beyond')
  // `change how ${label} draws its ${categoryNoun(category)}` — "walls", not "wall".
  expect(categoryNounWord('IFCWALL', englishOnly)).toBe('walls')
  expect(categoryNounWord('IFCFURNISHINGELEMENT', englishOnly)).toBe('furnishingelements')
  // The list titles are the panel's own words, and they are Turkish now.
  expect(categoryListWord('IFCWALL', TR)).toBe('Duvarlar')
  expect(categoryListWord('IFCCOVERING', TR)).toBe('Asma tavanlar ve kaplamalar')
  expect(categoryNounWord('IFCWALL', TR)).toBe('duvarları')
  // A category no list names keeps its IFC id, as data.
  expect(categoryListWord('IFCRAILING', englishOnly)).toBe('railings')
})
