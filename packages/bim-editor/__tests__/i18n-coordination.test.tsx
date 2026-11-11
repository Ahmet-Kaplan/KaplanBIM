/**
 * The coordination tree in two languages — the guard for
 * `src/editor/coordination`.
 *
 * What this file proves, and the hole each proof closes:
 *
 *   1. **Every caption is keyed, with its English** — `editorSourceCaptions()`
 *      reads every `t('<key>', '<English>'` call in the tree. The negative-space
 *      guard (`i18n-negative-space.test.ts`) proves the other half: no visible
 *      English sits *outside* a translator. 58 sites went to zero in this round.
 *   2. **Every key has Turkish, and its placeholders match** — a `{{…}}` on one
 *      side and not the other ships a raw `{{count}}` or drops the rule's name
 *      from the sentence.
 *   3. **The glossary holds where it matters most here**: §2.4/§8 (*çakışma* for a
 *      clash, *girişim* for interference, *bulgu* for a finding, *birleşik model*
 *      for a federation, *inceleme* for a review), the §8 refusal and status
 *      vocabulary, §7 (`in.` and `Rev` never travel) and §0.7 (a button is a
 *      singular command).
 */
import fs from 'node:fs'
import path from 'node:path'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor } from './helpers/editor-i18n'

const TR = translateFor('tr')

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

/** `{ coordination: { retract: 'Geri al' } }` → `"coordination.retract"`. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') out[id] = value
    else if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id))
  }
  return out
}

/** Every `coordination.*` key the source writes, read at each test rather than at import: the scan is the thing under test. */
const coordinationKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith('coordination.'))

test('the tree is keyed: this guard is looking at coordination captions, not an empty list', () => {
  // Without this a broken scan would leave every test below scanning nothing and reporting green.
  expect(coordinationKeys().length).toBeGreaterThan(70)
})

test('every coordination caption has its Turkish', () => {
  expect(coordinationKeys().filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  expect(coordinationKeys().filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(LOCALE[key] ?? ''))).toEqual([])
})

test('a placeholder on one side is on the other, and no figure is dropped', () => {
  const english = editorSourceCaptions()
  const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1]).sort().join(',')
  const wrong = coordinationKeys()
    .filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? ''))
    .map((key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`)
  expect(wrong).toEqual([])
})

// ---------------------------------------------------------------------------
// §2.4/§8 — a finding is a bulgu, a clash a çakışma, interference girişim
// ---------------------------------------------------------------------------

test('§2.4: a finding is a bulgu, a clash a çakışma, and interference stays girişim', () => {
  expect(TR('coordination.findingAccepted', 'Finding accepted', { ns: 'editor' })).toBe('Bulgu kabul edildi')
  expect(TR('coordination.acceptedHeading', 'Accepted', { ns: 'editor' })).toBe('Kabul edilenler')
  // The check that finds them is *çakışmalar ve yerleşim*; §8's status words do the rest.
  expect(TR('coordination.rulesetCoordination', 'Clashes and placement', { ns: 'editor' })).toBe('Çakışmalar ve yerleşim')
  expect(TR('coordination.rulesetDocuments', 'Drawings and sheets', { ns: 'editor' })).toBe('Çizimler ve paftalar')
  expect(TR('coordination.rulesetIssue', 'Before issuing a set', { ns: 'editor' })).toBe('Set yayınlanmadan önce')
  expect(TR('coordination.rulesetEverything', 'Everything', { ns: 'editor' })).toBe('Her şey')
  // The panel's own headings come from the shared namespace, where they already lived.
  expect(TR('panel.coordination', 'Coordination', { ns: 'editor' })).toBe('Koordinasyon')
  expect(TR('panel.coordinationFindings', 'Coordination findings', { ns: 'editor' })).toBe('Koordinasyon bulguları')
  // A federated model is a birleşik model (§2.4), and no caption here calls it *federasyon*.
  expect(coordinationKeys().filter((key) => /federasyon/iu.test(LOCALE[key] ?? ''))).toEqual([])
})

// ---------------------------------------------------------------------------
// §8 — the status vocabulary, and no plural suffix after a number
// ---------------------------------------------------------------------------

test('§8: the acceptance reads as kabul, and no caption pluralises after a number', () => {
  expect(TR('coordination.retract', 'Retract', { ns: 'editor' })).toBe('Geri al')
  expect(TR('coordination.accept', 'Accept', { ns: 'editor' })).toBe('Kabul et')
  expect(TR('coordination.acceptanceRetracted', 'Acceptance retracted; the finding shows again', { ns: 'editor' })).toContain('Kabul geri alındı')
  const wrong = coordinationKeys()
    .filter((key) => /\{\{\s*\w+\s*\}\}\s+\S*(lar|ler)\b/iu.test(LOCALE[key] ?? ''))
    .map((key) => `${key}: ${LOCALE[key]}`)
  expect(wrong).toEqual([])
  // One and many are separate keys, so English reads exactly as it did and Turkish has one form.
  expect(TR('coordination.oneError', '1 error', { ns: 'editor' })).toBe('1 hata')
  expect(TR('coordination.errorCountPlain', '{{count}} errors', { ns: 'editor', count: 3 })).toBe('3 hata')
  expect(TR('coordination.withOneLinkedModel', 'with 1 linked model', { ns: 'editor' })).toBe('1 bağlı modelle')
  expect(TR('coordination.withLinkedModels', 'with {{count}} linked models', { ns: 'editor', count: 2 })).toBe('2 bağlı modelle')
})

// ---------------------------------------------------------------------------
// §7 — the unit symbol and the revision marker never travel
// ---------------------------------------------------------------------------

test('§7: the tolerance keeps its in., and the revision keeps its Rev', () => {
  expect(TR('coordination.tolerance', 'Tolerance (in.)', { ns: 'editor' })).toBe('Tolerans (in.)')
  expect(TR('coordination.scope', '{{tolerance}} in. tolerance, {{linked}}', { ns: 'editor', tolerance: '0.5', linked: 'bağlı model yok' })).toBe('0.5 in. tolerans, bağlı model yok')
  expect(TR('coordination.summary', '{{errors}} errors, {{warnings}} warnings at Rev {{revision}}: {{scope}}', { ns: 'editor', errors: '2 hata', warnings: '1 uyarı', revision: 52, scope: '0.5 in. tolerans' })).toBe('Rev 52: 2 hata, 1 uyarı, 0.5 in. tolerans')
})

// ---------------------------------------------------------------------------
// §0.7 — buttons are singular commands, sentences speak in the polite plural
// ---------------------------------------------------------------------------

test('§0.7: the buttons are singular commands and the sentences speak politely', () => {
  expect(TR('coordination.select', 'Select', { ns: 'editor' })).toBe('Seç')
  expect(TR('coordination.selectAll', 'Select all', { ns: 'editor' })).toBe('Tümünü seç')
  expect(TR('coordination.saveDefault', 'Save default', { ns: 'editor' })).toBe('Varsayılanı kaydet')
  expect(TR('coordination.tryAgain', 'Try again', { ns: 'editor' })).toBe('Yeniden dene')
  expect(TR('coordination.sayWhyFirst', 'Say why in a few words first', { ns: 'editor' })).toBe('Önce birkaç sözcükle nedenini söyleyin')
  expect(TR('coordination.retractDescription', '{{what}} …', { ns: 'editor', what: 'Bu bulgu' })).toContain('saklanır')
})

// ---------------------------------------------------------------------------
// The English is unchanged: the sentences still read what they read before
// ---------------------------------------------------------------------------

test('the composed sentences read the English they replaced', () => {
  const english = editorSourceCaptions()
  // A finding's cluster badge, one error and several.
  expect(english.get('coordination.errorCountOne')?.english).toBe(' (1 error)')
  expect(english.get('coordination.errorCount')?.english).toBe(' ({{count}} errors)')
  // The retraction's quotation marks are the typographic pair the JSX used.
  expect(english.get('coordination.retractDescription')?.english).toContain('“{{reason}}”')
  // The pane's summary keeps its comma after the revision.
  expect(english.get('coordination.summary')?.english).toBe('{{errors}} errors, {{warnings}} warnings at Rev {{revision}}: {{scope}}')
})
