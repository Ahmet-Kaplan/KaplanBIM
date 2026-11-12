/**
 * The layout tree in two languages — the guard for `src/editor/layout`.
 *
 * What this file proves, and the hole each proof closes:
 *
 *   1. **Every caption is keyed, with its English** — `editorSourceCaptions()`
 *      reads every `t('<key>', '<English>'` call in the tree. The negative-space
 *      guard (`i18n-negative-space.test.ts`) proves the other half: no visible
 *      English sits *outside* a translator. 6 sites went to zero in this round.
 *   2. **Every key has Turkish, and its placeholders match** — a `{{…}}` on one
 *      side and not the other ships a raw `{{why}}` in a toast, or drops the
 *      reason the save failed.
 *   3. **The English is unchanged** — the toast's description is one `{{why}}`
 *      frame rather than a sentence spliced onto the server's error, and the
 *      provider's "not available here" sentence still says exactly what
 *      `unavailableWords` said.
 *
 * The chrome here is what a person sees on every screen (the rail's drag edge),
 * which is why it is a tree of its own in the guard.
 */
import fs from 'node:fs'
import path from 'node:path'
import { unavailableWords } from '@permitzip/bim-editor/host/unavailable'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor } from './helpers/editor-i18n'
import { englishOnly } from '../src/editor/i18n/translate'
import { unavailableIn } from '../src/editor/i18n/unavailable'

const TR = translateFor('tr')

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

/** `{ layout: { notSaved: 'Düzeniniz kaydedilmedi' } }` → `"layout.notSaved"`. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') out[id] = value
    else if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id))
  }
  return out
}

/** Every `layout.*` key the source writes, read at each test rather than at import: the scan is the thing under test. */
const layoutKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith('layout.'))

/**
 * A caption written twice or more is pinned here: "the key is still in the source"
 * alone would stay green while one of its sites went back to a literal.
 */
const SITES: Readonly<Record<string, number>> = {
  // `responseError`'s fallback and the `.catch`'s own fallback.
  'layout.couldNotRead': 2,
  'layout.couldNotSave': 2,
}

test('the tree is keyed: this guard is looking at layout captions, not an empty list', () => {
  // Without this a broken scan would leave every test below scanning nothing and reporting green.
  expect(layoutKeys().length).toBeGreaterThan(5)
})

test('every layout caption has its Turkish', () => {
  expect(layoutKeys().filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  expect(layoutKeys().filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(LOCALE[key] ?? ''))).toEqual([])
})

test('a placeholder on one side is on the other, and no sentence loses its reason', () => {
  const english = editorSourceCaptions()
  const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1]).sort().join(',')
  const wrong = layoutKeys()
    .filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? ''))
    .map((key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`)
  expect(wrong).toEqual([])
})

test('a caption that is written in more than one place is pinned at that count', () => {
  const source = editorSourceCaptions()
  for (const [key, sites] of Object.entries(SITES)) {
    expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites })
  }
  // The other half: a key that gained a second site is named here, not silently assumed one.
  const unpinned = [...source.entries()]
    .filter(([key, caption]) => key.startsWith('layout.') && caption.sites > 1 && SITES[key] === undefined)
    .map(([key, caption]) => `${key}: ${caption.sites}`)
  expect(unpinned).toEqual([])
})

// ---------------------------------------------------------------------------
// The English is unchanged: the toast still reads what it read before
// ---------------------------------------------------------------------------

test('the save failure still reads as one English sentence, and the English default is the whole frame', () => {
  const english = editorSourceCaptions()
  expect(english.get('layout.notSaved')?.english).toBe("Your layout wasn't saved")
  // One `{{why}}` frame, not `message` spliced onto an English tail: Turkish would
  // have read "Kaydedilemedi. It stays this way until you reload…".
  expect(english.get('layout.notSavedWhy')?.english).toBe('{{why}}. It stays this way until you reload; the next change tries again.')
  const whole = TR('layout.notSavedWhy', '{{why}}. It stays this way until you reload; the next change tries again.', {
    ns: 'editor',
    why: "Düzeniniz kaydedilemedi",
  })
  expect(whole.startsWith('Düzeniniz kaydedilemedi. ')).toBe(true)
  expect(whole.endsWith('yeniden dener.')).toBe(true)
  // The percentage-free sentence keeps its semicolon: two clauses, one sentence.
  expect(whole).toContain(';')
})

test('the rail tooltip and the provider sentence read their English exactly', () => {
  const english = editorSourceCaptions()
  expect(english.get('layout.dragToResize')?.english).toBe('Drag to resize. Double-click for the default width.')
  expect(TR('layout.dragToResize', 'Drag to resize. Double-click for the default width.', { ns: 'editor' })).toBe(
    'Yeniden boyutlandırmak için sürükleyin. Varsayılan genişlik için çift tıklayın.',
  )
  // The provider replaces `unavailableWords('Saving your layout')` with the editor's
  // own `unavailableIn`: character for character the same English (§7 of the
  // glossary's contract with `@permitzip/bim-editor/host/unavailable`).
  expect(unavailableIn(englishOnly('layout.savingLayout', 'Saving your layout'), null, englishOnly)).toBe(unavailableWords('Saving your layout'))
})
