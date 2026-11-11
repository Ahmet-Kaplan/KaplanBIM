/**
 * The questions tree in two languages — the guard for `src/editor/questions`.
 *
 * What this file proves, and the hole each proof closes:
 *
 *   1. **Every caption is keyed, with its English** — `editorSourceCaptions()`
 *      reads every `t('<key>', '<English>'` call in the tree. The negative-space
 *      guard (`i18n-negative-space.test.ts`) proves the other half: no visible
 *      English sits *outside* a translator. 213 sites went to zero in this round.
 *   2. **Every key has Turkish, and its placeholders match** — a `{{…}}` on one
 *      side and not the other ships a raw `{{number}}` or drops the question's
 *      number from the sentence.
 *   3. **The glossary holds where it matters most here**: §6 (*soru*, *yanıt*,
 *      *varsayım*, *bilgi talebi (RFI)*), §2.3 (*mekan*, never *alan*; *kat*),
 *      §8 (no plural suffix after a number; the status vocabulary) and §0.7
 *      (a button is a singular command, a sentence speaks in the polite plural).
 *   4. **The English is unchanged** — the `label(t)` accessors are asked in
 *      English in this file and must equal the kernel's own tables character for
 *      character, and every row is read in English with no translator at all.
 */
import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { BUILTIN_QUESTION_OUTCOME_IDS, listQuestionOutcomes, type ElementId, type ModelState } from '@permitzip/bim-kernel'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor, Wrap } from './helpers/editor-i18n'
import { ANSWER_CHOICES, outcomeWord } from '../src/editor/questions/thread-rows'
import { AskQuestionDialog } from '../src/editor/questions/AskQuestionDialog'
import { audienceLabel, selectionLabel, statusLabel, typeLabel } from '../src/editor/questions/question-rows'
import { ProjectPersonPicker } from '../src/editor/questions/ProjectPersonPicker'

const TR = translateFor('tr')
const EN = translateFor('en')

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

/** `{ questions: { open: 'Açık' } }` → `"questions.open"`. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') out[id] = value
    else if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id))
  }
  return out
}

/** Every `questions.*` key the source writes, read at each test rather than at import: the scan is the thing under test. */
const questionKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith('questions.'))

test('the tree is keyed: this guard is looking at question captions, not an empty list', () => {
  // Without this a broken scan would leave every test below scanning nothing and reporting green.
  expect(questionKeys().length).toBeGreaterThan(230)
})

test('every question caption has its Turkish', () => {
  expect(questionKeys().filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  expect(questionKeys().filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(LOCALE[key] ?? ''))).toEqual([])
})

test('a placeholder on one side is on the other, and no figure is dropped', () => {
  const english = editorSourceCaptions()
  const placeholders = (text: string): string => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1]).sort().join(',')
  const wrong = questionKeys()
    .filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? ''))
    .map((key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`)
  expect(wrong).toEqual([])
})

// ---------------------------------------------------------------------------
// §6 — a question is a soru, an answer a yanıt, an assumption a varsayım
// ---------------------------------------------------------------------------

test('§6: a question is a soru, its answer a yanıt, an assumption a varsayım', () => {
  expect(TR('questions.typeQuestion', 'Question', { ns: 'editor' })).toBe('Soru')
  expect(TR('questions.answer', 'Answer', { ns: 'editor' })).toBe('Yanıtla')
  expect(TR('questions.typeAssumption', 'Assumption', { ns: 'editor' })).toBe('Varsayım')
  // The answer column and the answer action are the same noun; the verb is singular.
  expect(TR('questions.answerPrefix', 'Answer: ', { ns: 'editor' })).toContain('Yanıt')
  expect(statusLabel('answered', TR)).toBe('Yanıtlandı')
  expect(typeLabel('assumption', TR)).toBe('Varsayım')
  // The named parties are the glossary's words, not a second vocabulary.
  expect(audienceLabel('client', TR)).toBe('Müşteri')
  expect(audienceLabel('contractor', TR)).toBe('Yüklenici')
  expect(audienceLabel('architect', TR)).toBe('Mimar')
  expect(audienceLabel('structural', TR)).toBe('Statik')
  expect(audienceLabel('internal', TR)).toBe('Bizim ekip')
  // A firm-typed audience is the project's own word and is left exactly as it is.
  expect(audienceLabel('Acme Steel', TR)).toBe('Acme Steel')
})

test('§6/§8: open and closed are açık and kapalı, and the statuses are one vocabulary', () => {
  expect(TR('questions.filterOpen', 'Open', { ns: 'editor' })).toBe('Açık')
  expect(TR('questions.filterAll', 'All', { ns: 'editor' })).toBe('Tümü')
  expect(statusLabel('open', TR)).toBe('Açık')
  expect(statusLabel('declined', TR)).toBe('Yanıtlanmadı')
  expect(statusLabel('withdrawn', TR)).toBe('Geri çekildi')
  expect(statusLabel('not_in_scope', TR)).toBe('Kapsam dışı')
  expect(statusLabel('assumed', TR)).toBe('Varsayıldı')
  // §8: a date the answer is needed by is a son tarih, never a "due date" loan.
  expect(TR('questions.neededByOptional', 'Needed by (optional)', { ns: 'editor' })).toBe('Son tarih (isteğe bağlı)')
  expect(TR('questions.neededByDot', ' · needed by {{when}}', { ns: 'editor', when: 'DD' })).toContain('son tarih')
  // The five answer outcomes are the kernel's five rows, in Turkish.
  expect(TR('questions.outcomeClarification', 'Clarification', { ns: 'editor' })).toBe('Açıklama')
  expect(TR('questions.outcomeDecisionRecorded', 'Decision recorded', { ns: 'editor' })).toBe('Karar kaydedildi')
  expect(TR('questions.outcomeDesignRevision', 'Design revision', { ns: 'editor' })).toBe('Tasarım revizyonu')
})

// ---------------------------------------------------------------------------
// §2.3 — space is mekan, why the questions tree never says alan
// ---------------------------------------------------------------------------

test('§2.3: a space is a mekan, and no question caption calls one an alan', () => {
  // *Alan* is "area" (§2.3) — a load area, a gross area. This tree has no area in it.
  expect(questionKeys().filter((key) => /\balan/iu.test(LOCALE[key] ?? ''))).toEqual([])
  // …and a pinned spot is a nokta, not a place in the plan's area.
  expect(TR('questions.aSpotOnThePlan', 'a spot on the plan', { ns: 'editor' })).toBe('planda bir nokta')
})

// ---------------------------------------------------------------------------
// §8 — no plural suffix after a number
// ---------------------------------------------------------------------------

test('§8: no Turkish caption puts a plural suffix after a number', () => {
  const wrong = questionKeys()
    .filter((key) => /\{\{\s*\w+\s*\}\}\s+\S*(lar|ler)\b/iu.test(LOCALE[key] ?? ''))
    .map((key) => `${key}: ${LOCALE[key]}`)
  expect(wrong).toEqual([])
  // The two counted rows read the same for one and for three.
  expect(TR('questions.openCount', '{{n}} open', { ns: 'editor', n: 1 })).toBe('1 açık')
  expect(TR('questions.openCount', '{{n}} open', { ns: 'editor', n: 3 })).toBe('3 açık')
  expect(TR('questions.andMore', 'and {{n}} more', { ns: 'editor', n: 3 })).toBe(' ve 3 tane daha')
})

// ---------------------------------------------------------------------------
// §0.5/§0.7 — a button is a singular command, a sentence is polite plural
// ---------------------------------------------------------------------------

test('§0.7: a button speaks in the singular, a sentence in the polite plural', () => {
  // Commands: one word, no suffix, the imperative a person gives a person.
  expect(TR('questions.askAboutSelection', 'Ask about selection', { ns: 'editor' })).toBe('Seçim hakkında sor')
  expect(TR('questions.askAgain', 'Ask again', { ns: 'editor' })).toBe('Yeniden sor')
  expect(TR('questions.showOnPlan', 'Show on plan', { ns: 'editor' })).toBe('Planda göster')
  expect(TR('questions.withdraw', 'Withdraw', { ns: 'editor' })).toBe('Geri çek')
  expect(TR('questions.copyEmail', 'Copy email', { ns: 'editor' })).toBe('E-postayı kopyala')
  // Sentences: the polite second person plural.
  expect(TR('questions.selectAboutFirst', 'Select what the question is about on the plan first.', { ns: 'editor' })).toContain('seçin')
  expect(TR('questions.emptyHint', '…', { ns: 'editor' })).toContain('basın')
  expect(TR('questions.noReplies', '…', { ns: 'editor' })).toContain('mecbur değil')
})

// ---------------------------------------------------------------------------
// The label(t) accessors: the English is the kernel's and the tree's, unchanged
// ---------------------------------------------------------------------------

test('every accessor reads the English it replaced, character for character', () => {
  for (const status of ['open', 'answered', 'assumed', 'withdrawn', 'declined', 'not_in_scope'] as const) {
    const english = { open: 'Open', answered: 'Answered', assumed: 'Assumed', withdrawn: 'Withdrawn', declined: 'Declined', not_in_scope: 'Not in scope' }[status]
    expect({ status, word: statusLabel(status, EN) }).toEqual({ status, word: english })
  }
  expect(typeLabel('question', EN)).toBe('Question')
  expect(typeLabel('assumption', EN)).toBe('Assumption')
  expect(typeLabel('field_verify', EN)).toBe('Verify on site')
  expect(audienceLabel('client', EN)).toBe('Client')
  expect(audienceLabel('internal', EN)).toBe('Our team')
  // The five answer choices, in English, are the labels the dialog drew before.
  expect(ANSWER_CHOICES.map((c) => c.label(EN))).toEqual(['Clarify', 'Record a decision', 'Revise the design (opens a branch)', 'Not in scope', 'Decline'])
  expect(ANSWER_CHOICES.map((c) => c.hint(EN))).toEqual([
    'Explain; nothing in the design changes.',
    'A judgment call the model can cite later.',
    'Record that the design will change, then open a branch to change it. Main is not changed.',
    "It isn't yours to answer. The pin leaves the plan; the asker can ask again.",
    'You choose not to answer. The pin leaves the plan; the asker can ask again.',
  ])
  // …and each one is Turkish on a Turkish screen, which is why the accessor exists.
  expect(ANSWER_CHOICES[0]?.label(TR)).toBe('Açıklığa kavuştur')
  expect(ANSWER_CHOICES[3]?.label(TR)).toBe('Kapsam dışı')
  // A selection reads the same in both languages: it is the model's own names.
  const model = { elements: {} } as unknown as ModelState
  expect(selectionLabel(model, [], TR)).toBe('')
})

// ---------------------------------------------------------------------------
// Rendered surfaces
// ---------------------------------------------------------------------------

const NOOP = (): void => {}
const NO_REFUSAL = (): string | null => null

test('the ask dialog draws its Turkish, and never the English beside it', () => {
  render(
    <Wrap language="tr">
      <AskQuestionDialog open elementIds={['a' as ElementId]} aboutLabel="SD-1" submit={NO_REFUSAL} onClose={NOOP} />
    </Wrap>,
  )
  const shown = document.body.textContent ?? ''
  expect(shown).toContain('SD-1 hakkında sor')
  expect(shown).toContain('Soru')
  expect(shown).toContain('Varsayım')
  expect(shown).toContain('İşi durdurur')
  expect(shown).not.toContain('Ask about SD-1')
  expect(shown).not.toContain('Holds the issue')
})

test('the ask dialog is unchanged in English', () => {
  render(
    <Wrap language="en">
      <AskQuestionDialog open elementIds={['a' as ElementId]} aboutLabel="SD-1" submit={NO_REFUSAL} onClose={NOOP} />
    </Wrap>,
  )
  const shown = document.body.textContent ?? ''
  expect(shown).toContain('Ask about SD-1')
  expect(shown).toContain('Holds the issue')
  expect(shown).toContain('Needed by (optional)')
})

test('the person picker says its empty state in the screen language', () => {
  render(
    <Wrap language="tr">
      <ProjectPersonPicker state={{ kind: 'ready', people: [] }} selected={null} onSelect={NOOP} onRetry={NOOP} />
    </Wrap>,
  )
  const shown = document.body.textContent ?? ''
  expect(shown).toContain('Burada başka kimse modeli açamıyor')
  expect(shown).not.toContain('No one else here can open the model')
})

test('the person picker is unchanged in English', () => {
  render(
    <Wrap language="en">
      <ProjectPersonPicker state={{ kind: 'ready', people: [] }} selected={null} onSelect={NOOP} onRetry={NOOP} />
    </Wrap>,
  )
  expect(screen.getByText('No one else here can open the model')).toBeTruthy()
})

test('every built-in answer outcome has a Turkish word of its own', () => {
  // The five built-ins are the kernel's rows; a sixth added there would fall back to its
  // English label on a Turkish screen, which is exactly what this list is here to catch.
  expect(BUILTIN_QUESTION_OUTCOME_IDS.length).toBeGreaterThan(0)
  for (const id of BUILTIN_QUESTION_OUTCOME_IDS) expect({ id, word: outcomeWord(id, TR) }).not.toEqual({ id, word: listQuestionOutcomes().find((row) => row.id === id)?.label })
})
