/**
 * The linked-reference tree in two languages — the guard for
 * `src/editor/linked-reference`.
 *
 * This file proves, and the hole each proof closes:
 *
 *   1. **Every caption is keyed, with its English** — `editorSourceCaptions()`
 *      reads every `t('<key>', '<English>'` call in the tree. The negative-space
 *      guard (`i18n-negative-space.test.ts`) proves the other half: no visible
 *      English sits *outside* a translator. 6 sites went to zero in this round,
 *      and the builder's own messages went with them.
 *   2. **Every key has Turkish, and its placeholders match** — a `{{…}}` on one
 *      side and not the other ships a raw `{{sources}}` in a tool hint, or drops
 *      the reason the linked model cannot be snapped to.
 *   3. **The English is unchanged** — the builder's sentences are the same
 *      sentences, the *opening* is a **boşluk** (never an *açıklık*, which §5.12
 *      spends on a clearance) and the snap label composes to the words the canvas
 *      said before: `linked wall face`.
 *
 * A pure builder takes its translator rather than reaching for a hook: the
 * dimension anchors and the copy builder run in the canvas' `useMemo` and in the
 * spaces tree, and `englishOnly` is the fallback a caller with no translator gets.
 */
import fs from 'node:fs'
import path from 'node:path'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor } from './helpers/editor-i18n'
import { englishOnly } from '../src/editor/i18n/translate'

const TR = translateFor('tr')

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

/** `{ linkedRef: { copyGone: 'O kopya artık modelde değil.' } }` → `"linkedRef.copyGone"`. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') out[id] = value
    else if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id))
  }
  return out
}

/** The keys the trees' captions live under, read at each test rather than at import: the scan is the thing under test. */
const treeKeys = (): string[] =>
  [...editorSourceCaptions().keys()].filter(
    (key) =>
      key.startsWith('linkedRef.') ||
      key === 'dimension.snapLinked' ||
      key === 'dimension.anchor.face' ||
      key === 'dimension.anchor.centreLine',
  )

/**
 * A caption written twice or more is pinned here: "the key is still in the source"
 * alone would stay green while one of its sites went back to a literal.
 */
const SITES: Readonly<Record<string, number>> = {
  // The wall branch's level and straight-line checks both say this.
  'linkedRef.wallNotStraight': 2,
}

test('the tree is keyed: this guard is looking at linked-reference captions, not an empty list', () => {
  expect(treeKeys().length).toBeGreaterThan(18)
})

test('every caption in the tree has its Turkish', () => {
  expect(treeKeys().filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  expect(treeKeys().filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(LOCALE[key] ?? ''))).toEqual([])
})

test('a placeholder on one side is on the other, and no sentence loses its source', () => {
  const english = editorSourceCaptions()
  const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1]).sort().join(',')
  const wrong = treeKeys()
    .filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? ''))
    .map((key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`)
  expect(wrong).toEqual([])
})

test('a caption that is written in more than one place is pinned at that count', () => {
  const source = editorSourceCaptions()
  // The key list once, not once per caption: `treeKeys()` rescans the tree.
  const keys = new Set(treeKeys())
  for (const [key, sites] of Object.entries(SITES)) {
    expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites })
  }
  const unpinned = [...source.entries()]
    .filter(([key, caption]) => keys.has(key) && caption.sites > 1 && SITES[key] === undefined)
    .map(([key, caption]) => `${key}: ${caption.sites}`)
  expect(unpinned).toEqual([])
})

// ---------------------------------------------------------------------------
// The English is unchanged: the sentences the builder returned, character for character
// ---------------------------------------------------------------------------

test('the builder’s sentences read what they read before, and its id is never a word', () => {
  const english = editorSourceCaptions()
  expect(english.get('linkedRef.ownOpenings')?.english).toBe(
    "This wall has a door or window someone added in this model; taking the link's version would remove it. Move it to another wall first, or keep yours.",
  )
  expect(english.get('linkedRef.alreadyCopied')?.english).toBe("This space's outside walls and windows from the linked model are already in the model.")
  // `Updating a ${row.kind} …` was an English id in a sentence; the frame takes a noun.
  expect(english.get('linkedRef.kindNotSupported')?.english).toBe("Updating a {{kind}} from the link isn't supported yet; keep yours, or delete it and copy it again.")
  expect(english.get('linkedRef.updateCommand')?.english).toBe('Update {{kind}} from the linked model')
  // §5.13/§2.3: an *opening* is a boşluk (the word `spaces.*` already uses for the copies); the
  // clearance keeps *açıklık* (§5.12), and the two may not swap.
  expect(TR('linkedRef.kindOpening', 'opening', { ns: 'editor' })).toBe('boşluk')
  expect(TR('linkedRef.kindWall', 'wall', { ns: 'editor' })).toBe('duvar')
  expect(Object.values(LOCALE).filter((value) => value === 'açıklık' && value !== undefined)).toEqual([])
})

test('the snap label composes to the words the canvas said, in either language', () => {
  const english = editorSourceCaptions()
  expect(english.get('dimension.snapLinked')?.english).toBe('linked {{what}} {{where}}')
  // Before this round: `` `${noun} face` `` with `noun = `linked ${item.rule.noun}``.
  const composed = (what: string, where: string): string =>
    englishOnly('dimension.snapLinked', 'linked {{what}} {{where}}', { what, where })
  expect(composed('wall', 'face')).toBe('linked wall face')
  expect(composed('wall', 'centre line')).toBe('linked wall centre line')
  expect(composed('wall', 'end')).toBe('linked wall end')
  expect(composed('column', 'middle')).toBe('linked column middle')
  // The pack's own noun is data and stays as it is; the six nouns the packs ship are translated.
  expect(TR('linkedRef.nounWall', 'wall', { ns: 'editor' })).toBe('duvar')
  expect(TR('linkedRef.nounColumn', 'column', { ns: 'editor' })).toBe('kolon')
  expect(TR('dimension.anchor.face', 'face', { ns: 'editor' })).toBe('yüz')
  expect(TR('dimension.anchor.centreLine', 'centre line', { ns: 'editor' })).toBe('merkez hattı')
})
