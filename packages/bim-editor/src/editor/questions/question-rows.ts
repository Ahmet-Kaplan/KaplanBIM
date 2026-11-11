import { answerValidity, type BimElement, type ElementId, type ModelState } from '@permitzip/bim-kernel'
import { allQuestions, modelAnswerFor, NAMED_AUDIENCES, type Question, type QuestionStatus, type QuestionType } from '../../contracts/bim/questions/kernel'
import { englishOnly, type Translate } from '../i18n/translate'

/** What the Questions list shows per question, in operator words. */
export interface QuestionRow {
  readonly id: ElementId
  readonly number: string
  readonly text: string
  readonly type: QuestionType
  readonly typeLabel: string
  readonly status: QuestionStatus
  readonly statusLabel: string
  readonly askOf: string
  readonly askOfLabel: string
  /** "SD-1, SD-2" or "a spot on the plan"; "deleted" ones say so. */
  readonly about: string
  readonly elementIds: readonly ElementId[]
  readonly blocksIssue: boolean
  readonly closeBy: string | null
  readonly answer: string | null
  /** The model already holds the value that answers it ("SD-1 mark is SD-1"); null when it can't tell. */
  readonly modelAnswer: string | null
  readonly anchorGone: boolean
  /** Answered, but what the answer relied on changed: "May no longer hold — Room 104 changed in Rev 52". */
  readonly staleWords: string | null
}

export type QuestionFilter = 'open' | 'all'

/**
 * A question's status, as the list and the thread show it.
 *
 * §6: a question is a **soru**, an answer a **yanıt**, an RFI a **bilgi talebi
 * (RFI)**; *open* is **açık** and *closed* **kapalı**. A function rather than a
 * table of English strings: a string table is how English shipped under a keyed
 * frame before (`spaces`, `plumbing`, `electrical` all learned it).
 */
export const statusLabel = (status: QuestionStatus, t: Translate = englishOnly): string => {
  switch (status) {
    case 'open':
      return t('questions.statusOpen', 'Open', { ns: 'editor' })
    case 'answered':
      return t('questions.statusAnswered', 'Answered', { ns: 'editor' })
    case 'assumed':
      return t('questions.statusAssumed', 'Assumed', { ns: 'editor' })
    case 'withdrawn':
      return t('questions.statusWithdrawn', 'Withdrawn', { ns: 'editor' })
    case 'declined':
      return t('questions.statusDeclined', 'Declined', { ns: 'editor' })
    case 'not_in_scope':
      return t('questions.statusNotInScope', 'Not in scope', { ns: 'editor' })
  }
  return String(status).replace(/_/g, ' ')
}

/** The three kinds of question, and what each one records. §6: *Question* is **soru**, *Assumption* **varsayım**. */
export const typeLabel = (type: QuestionType, t: Translate = englishOnly): string => {
  switch (type) {
    case 'question':
      return t('questions.typeQuestion', 'Question', { ns: 'editor' })
    case 'assumption':
      return t('questions.typeAssumption', 'Assumption', { ns: 'editor' })
    case 'field_verify':
      return t('questions.typeFieldVerify', 'Verify on site', { ns: 'editor' })
  }
  return String(type).replace(/_/g, ' ')
}

/** Who a question is asked of, when it is one of the named parties. */
export const audienceLabel = (askOf: string, t: Translate = englishOnly): string => {
  const key = askOf.trim().toLowerCase()
  const named = NAMED_AUDIENCES.find((a) => a === key)
  if (!named) return askOf.trim()
  switch (named) {
    case 'client':
      return t('questions.audienceClient', 'Client', { ns: 'editor' })
    case 'architect':
      return t('questions.audienceArchitect', 'Architect', { ns: 'editor' })
    case 'structural':
      return t('questions.audienceStructural', 'Structural', { ns: 'editor' })
    case 'contractor':
      return t('questions.audienceContractor', 'Contractor', { ns: 'editor' })
    default:
      return t('questions.audienceInternal', 'Our team', { ns: 'editor' })
  }
}

function elementWords(el: BimElement): string {
  if ('mark' in el && typeof el.mark === 'string' && el.mark.trim() !== '') return el.mark.trim()
  if ((el.kind === 'space' || el.kind === 'room') && `${el.number} ${el.name}`.trim() !== '') return `${el.number} ${el.name}`.trim()
  if ('name' in el && typeof el.name === 'string' && el.name.trim() !== '') return el.name.trim()
  return el.kind.replace(/_/g, ' ')
}

function about(model: ModelState, q: Question, t: Translate): { readonly text: string; readonly gone: boolean } {
  const names: string[] = []
  let gone = 0
  for (const id of q.anchor.elementIds) {
    const el = model.elements[id]
    if (el) names.push(elementWords(el))
    else gone += 1
  }
  const parts = [...new Set(names)]
  const shown = parts.slice(0, 3).join(', ') + (parts.length > 3 ? t('questions.andMore', 'and {{n}} more', { ns: 'editor', n: parts.length - 3 }) : '')
  const pieces = [shown, q.anchor.point ? t('questions.aSpotOnThePlan', 'a spot on the plan', { ns: 'editor' }) : '', gone > 0 ? t('questions.nDeleted', '{{n}} deleted', { ns: 'editor', n: gone }) : ''].filter((s) => s !== '')
  return { text: pieces.join('; '), gone: gone > 0 && parts.length === 0 && !q.anchor.point }
}

/** The selection as the person sees it ("SD-1, SD-2 and 3 more"), for Ask about selection. */
export function selectionLabel(model: ModelState | null, ids: readonly string[], t: Translate = englishOnly): string {
  if (!model || ids.length === 0) return ''
  const names = ids.flatMap((id) => {
    const el = model.elements[id]
    return el ? [elementWords(el)] : []
  })
  const unique = [...new Set(names)]
  return unique.slice(0, 3).join(', ') + (unique.length > 3 ? t('questions.andMore', 'and {{n}} more', { ns: 'editor', n: unique.length - 3 }) : '')
}

/** Open first (holding ones first), then by number. Assumed ones count as still in play for "open". */
export function questionRows(model: ModelState, filter: QuestionFilter, t: Translate = englishOnly): QuestionRow[] {
  const rows: QuestionRow[] = []
  for (const q of allQuestions(model.elements)) {
    if (filter === 'open' && q.status !== 'open' && q.status !== 'assumed') continue
    const a = about(model, q, t)
    const m = q.status === 'open' || q.status === 'assumed' ? modelAnswerFor(model, q) : null
    rows.push({
      id: q.id,
      number: q.number,
      text: q.text,
      type: q.type,
      typeLabel: typeLabel(q.type, t),
      status: q.status,
      statusLabel: statusLabel(q.status, t),
      askOf: q.askOf,
      askOfLabel: audienceLabel(q.askOf, t),
      about: a.text,
      elementIds: q.anchor.elementIds,
      blocksIssue: q.blocksIssue === true,
      closeBy: q.closeBy ?? null,
      answer: q.answer ?? null,
      modelAnswer: m?.answered ? t('questions.modelSays', '{{from}} is {{value}}', { ns: 'editor', from: m.from, value: m.value }) : null,
      anchorGone: a.gone,
      staleWords: q.status === 'answered' ? (() => { const v = answerValidity(model.elements, q.id); return v.state === 'may_not_hold' ? v.words : null })() : null,
    })
  }
  const rank = (r: QuestionRow) => (r.status === 'open' ? (r.blocksIssue ? 0 : 1) : r.status === 'assumed' ? 2 : 3)
  return rows.sort((x, y) => rank(x) - rank(y) || x.number.localeCompare(y.number, 'en', { numeric: true }))
}

/** Who has something open or assumed, for the email picker: named parties first, then firm-typed ones. */
export function audiencesWithQuestions(model: ModelState): string[] {
  const keys = new Map<string, string>()
  for (const q of allQuestions(model.elements)) if (q.status === 'open' || q.status === 'assumed') keys.set(q.askOf.trim().toLowerCase(), q.askOf.trim())
  const named = NAMED_AUDIENCES.filter((a) => keys.has(a))
  const others = [...keys.entries()].filter(([k]) => !NAMED_AUDIENCES.some((a) => a === k)).map(([, v]) => v).sort()
  return [...named, ...others]
}
