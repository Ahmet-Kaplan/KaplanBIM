/**
 * The schedule tab in two languages — the guard for `src/editor/schedule-tab`.
 *
 * A schedule docked beside the plan, full height at the right of the canvas: it
 * shows loading, an error with Retry, and why editing is off above the schedule. 5
 * sites went to zero in this round, and the tree leaves OUTSIDE_STAGE_4.
 *
 * The error boundary is a **class**, so it takes its two captions as props from the
 * function component: a hook it cannot call would have left "This schedule couldn't
 * be drawn" in English above a Turkish schedule, which is the exact half-translated
 * screen this guard exists to stop.
 *
 * The English is unchanged — the JSX entity `couldn&apos;t` decodes to the same
 * apostrophe a JS string carries, and §8's *read only* is **salt okunur**.
 */
import fs from 'node:fs'
import path from 'node:path'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor } from './helpers/editor-i18n'

const TR = translateFor('tr')

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

/** `{ scheduleTab: { retry: 'Yeniden dene' } }` → `"scheduleTab.retry"`. */
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
const treeKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith('scheduleTab.'))

test('the tree is keyed: this guard is looking at schedule-tab captions, not an empty list', () => {
  expect(treeKeys().length).toBeGreaterThanOrEqual(5)
})

test('every caption in the tree has its Turkish', () => {
  expect(treeKeys().filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  expect(treeKeys().filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(LOCALE[key] ?? ''))).toEqual([])
})

test('a placeholder on one side is on the other, and the read-only line keeps its reason', () => {
  const english = editorSourceCaptions()
  const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1]).sort().join(',')
  const wrong = treeKeys()
    .filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? ''))
    .map((key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`)
  expect(wrong).toEqual([])
})

test('no key in this tree is written twice without a pinned count', () => {
  const source = editorSourceCaptions()
  const keys = new Set(treeKeys())
  const twice = [...source.entries()]
    .filter(([key, caption]) => keys.has(key) && caption.sites > 1)
    .map(([key, caption]) => `${key}: ${caption.sites}`)
  expect(twice).toEqual([])
})

test('the English is unchanged, and §8’s read-only is salt okunur', () => {
  const english = editorSourceCaptions()
  // The JSX wrote `couldn&apos;t`; React decodes the entity to this apostrophe.
  expect(english.get('scheduleTab.couldNotBeDrawn')?.english).toBe("This schedule couldn't be drawn")
  expect(english.get('scheduleTab.readOnly')?.english).toBe('Read only: {{why}}')
  expect(TR('scheduleTab.readOnly', 'Read only: {{why}}', { ns: 'editor', why: 'the schedule is issued' })).toBe('Salt okunur: the schedule is issued')
  // §9/Ç7: a sheet is a **pafta**, a schedule a **çizelge**. The tab closes the schedule, never the sheet.
  expect(TR('scheduleTab.close', 'Close the schedule', { ns: 'editor' })).toBe('Çizelgeyi kapat')
  // §0.7: a button is a singular command.
  expect(TR('scheduleTab.retry', 'Retry', { ns: 'editor' })).toBe('Yeniden dene')
})
