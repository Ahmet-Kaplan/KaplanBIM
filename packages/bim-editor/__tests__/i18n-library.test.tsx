/**
 * The library tree in two languages — the guard for `src/editor/library`.
 *
 * What this file proves, and the hole each proof closes:
 *
 *   1. **Every caption is keyed, with its English** — `editorSourceCaptions()`
 *      reads every `t('<key>', '<English>'` call in the tree. The negative-space
 *      guard (`i18n-negative-space.test.ts`) proves the other half: no visible
 *      English sits *outside* a translator. 68 sites went to zero in this round.
 *   2. **Every key has Turkish, and its placeholders match** — a `{{…}}` on one
 *      side and not the other ships a raw `{{name}}` or drops a discipline's name
 *      from the confirmation.
 *   3. **The glossary holds where it matters most here**: §2.2 (*tip*, *aile*,
 *      *kategori*, and **kitaplık** for the library — the same noun the schedules
 *      already inflect as *kitaplığa*), §1 (*disiplin*), §8 (no plural suffix
 *      after a number) and §0.7 (a button is a singular command).
 *   4. **The English is unchanged** — the screens are rendered in English with no
 *      Turkish loaded and must read what they read before.
 */
import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor, Wrap } from './helpers/editor-i18n'
import { DisciplinesSectionFrom } from '../src/editor/library/DisciplinesSection'
import { PacksSection } from '../src/editor/library/PacksSection'

const TR = translateFor('tr')

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

/** `{ library: { unpin: 'Sabitlemeyi kaldır' } }` → `"library.unpin"`. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') out[id] = value
    else if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, prefix === '' ? key : id))
  }
  return out
}

/** Every `library.*` key the source writes, read at each test rather than at import: the scan is the thing under test. */
const libraryKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith('library.'))

test('the tree is keyed: this guard is looking at library captions, not an empty list', () => {
  // Without this a broken scan would leave every test below scanning nothing and reporting green.
  expect(libraryKeys().length).toBeGreaterThan(65)
})

test('every library caption has its Turkish', () => {
  expect(libraryKeys().filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  expect(libraryKeys().filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(LOCALE[key] ?? ''))).toEqual([])
})

test('a placeholder on one side is on the other, and no name is dropped', () => {
  const english = editorSourceCaptions()
  const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1]).sort().join(',')
  const wrong = libraryKeys()
    .filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? ''))
    .map((key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`)
  expect(wrong).toEqual([])
})

// ---------------------------------------------------------------------------
// §2.2 — the panel is a kitaplık, a type a tip, a family an aile
// ---------------------------------------------------------------------------

test('§2.2: the library is a kitaplık, and a discipline is a disiplin', () => {
  // The schedules namespace already says `save.theLibrary` = *kitaplığa*; the same noun, inflected.
  expect(TR('library.firmLibrary', 'Firm library', { ns: 'editor' })).toBe('Firma kitaplığı')
  expect(TR('library.noFirmDisciplinesHint', '…', { ns: 'editor' })).toContain('kitaplığı')
  expect(TR('library.saveToFirmLibrary', 'Save to firm library', { ns: 'editor' })).toBe('Firma kitaplığına kaydet')
  // §1: disciplines are disiplinler, and the column heading is the singular.
  expect(TR('library.columnDiscipline', 'Discipline', { ns: 'editor' })).toBe('Disiplin')
  expect(TR('library.disciplinesTitle', 'Disciplines', { ns: 'editor' })).toBe('Disiplinler')
  // §2.2: an add-on is an eklenti and the panel keeps its established heading.
  expect(TR('panel.addOns', 'Add-ons', { ns: 'editor' })).toBe('Eklentiler')
  expect(TR('library.columnAddon', 'Add-on', { ns: 'editor' })).toBe('Eklenti')
})

// ---------------------------------------------------------------------------
// §8 — no plural suffix after a number
// ---------------------------------------------------------------------------

test('§8: no Turkish caption puts a plural suffix after a number', () => {
  const wrong = libraryKeys()
    .filter((key) => /\{\{\s*\w+\s*\}\}\s+\S*(lar|ler)\b/iu.test(LOCALE[key] ?? ''))
    .map((key) => `${key}: ${LOCALE[key]}`)
  expect(wrong).toEqual([])
  // One and many read with the same noun.
  expect(TR('library.summaryOneType', '{{file}}: 1 part type ready to review', { ns: 'editor', file: 'export.json' })).toBe('export.json: incelemeye hazır 1 parça tipi')
  expect(TR('library.summaryTypes', '{{file}}: {{count}} part types ready to review', { ns: 'editor', file: 'export.json', count: 4 })).toBe('export.json: incelemeye hazır 4 parça tipi')
})

// ---------------------------------------------------------------------------
// §0.7 — a button is a singular command
// ---------------------------------------------------------------------------

test('§0.7: the buttons are singular commands and the sentences speak politely', () => {
  expect(TR('library.pinToThisModel', 'Pin to this model', { ns: 'editor' })).toBe('Bu modele sabitle')
  expect(TR('library.unpin', 'Unpin', { ns: 'editor' })).toBe('Sabitlemeyi kaldır')
  expect(TR('library.chooseAnExport', 'Choose an export', { ns: 'editor' })).toBe('Bir dışa aktarım seçin')
  expect(TR('library.keepItPinned', 'Keep it pinned', { ns: 'editor' })).toBe('Sabit kalsın')
  // The undo labels read as the act, not as a command to the person.
  expect(TR('library.undoPin', 'pin {{name}} to this model', { ns: 'editor', name: 'İç mekan' })).toBe('İç mekan disiplinini bu modele sabitle')
})

// ---------------------------------------------------------------------------
// Rendered surfaces: the screen reads Turkish, and English with no translator
// ---------------------------------------------------------------------------

const NOOP = (): void => {}

test('the disciplines section draws its Turkish, and never the English beside it', async () => {
  const port = {
    listOfType: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ items: [{ key: 'firm:security', name: 'Güvenlik', deprecated: false }] }) }),
  } as unknown as Parameters<typeof DisciplinesSectionFrom>[0]['port']
  render(
    <Wrap language="tr">
      <DisciplinesSectionFrom port={port} />
    </Wrap>,
  )
  expect(await screen.findByText('Disiplinler')).toBeTruthy()
  const shown = document.body.textContent ?? ''
  expect(shown).toContain('Firma kitaplığı')
  expect(shown).toContain('Önerilen sorumlu rol')
  expect(shown).not.toContain('Suggested responsible role')
  expect(shown).not.toContain('Firm library')
})

test('the disciplines section is unchanged in English', async () => {
  const port = {
    listOfType: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ items: [{ key: 'firm:security', name: 'Security', deprecated: false }] }) }),
  } as unknown as Parameters<typeof DisciplinesSectionFrom>[0]['port']
  render(
    <Wrap language="en">
      <DisciplinesSectionFrom port={port} />
    </Wrap>,
  )
  expect(await screen.findByText('Disciplines')).toBeTruthy()
  const shown = document.body.textContent ?? ''
  expect(shown).toContain('Suggested responsible role')
  expect(shown).toContain('Firm library')
})

test('the add-on list says what it adds in Turkish, and keeps the count in parentheses', async () => {
  render(
    <Wrap language="tr">
      <PacksSection
        loadCatalogue={() =>
          Promise.resolve({
            rows: [{ id: 'mechanical', name: 'Mekanik', version: '1.0.0', description: 'HVAC', firstParty: true, missing: false, contributes: [{ label: 'Hizmetler', count: 3 }] }],
            previewIds: new Set<string>(['mechanical']),
          } as unknown as Parameters<typeof PacksSection>[0]['loadCatalogue'] extends (() => Promise<infer T>) | undefined ? T : never)
        }
      />
    </Wrap>,
  )
  // The heading and the columns are keyed; the pack's own name and the count are data.
  expect(await screen.findByText('Eklentiler')).toBeTruthy()
  const shown = document.body.textContent ?? ''
  expect(shown).toContain('Ne ekliyor')
  expect(shown).toContain('Hizmetler (3)')
  expect(shown).not.toContain('What it adds')
  expect(NOOP()).toBeUndefined()
})
