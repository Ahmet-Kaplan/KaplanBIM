import { askerWords, authorWords, isAsker, isOwner, mayAskAgain, ownerWords, questionAt, questionOutcomeLabel, questionThread, recordValidity, type AuthorRef, type QuestionEvent, type ElementId, type ModelState } from '@permitzip/bim-kernel'
import { englishOnly, type Translate } from '../i18n/translate'
import { statusLabel } from './question-rows'

/** One line of a question's thread, in operator words. */
export interface ThreadLine {
  readonly id: ElementId
  readonly who: string
  /** "2 Nov, 09:00" (local), or "" when the record has no readable time. */
  readonly when: string
  /** "Declined", "Answered: Clarification", "Asked again", or "" for a plain reply. */
  readonly act: string
  readonly text: string
  /** An answer that may no longer hold: "May no longer hold — Room 104 changed in Rev 52". */
  readonly stale?: string
}

/** What the five answer choices record. Decline isn't an answer: it writes its own status (see `decline_question`). */
export type AnswerChoice = 'clarification' | 'judgment_recorded' | 'design_revision' | 'not_in_scope' | 'decline'

/** The five choices, as functions rather than a table of English strings: every word here is read. */
export const ANSWER_CHOICES: Readonly<Array<{ readonly id: AnswerChoice; readonly label: (t: Translate) => string; readonly hint: (t: Translate) => string }>> = [
  {
    id: 'clarification',
    label: (t) => t('questions.answerClarify', 'Clarify', { ns: 'editor' }),
    hint: (t) => t('questions.answerClarifyHint', 'Explain; nothing in the design changes.', { ns: 'editor' }),
  },
  {
    id: 'judgment_recorded',
    label: (t) => t('questions.answerDecision', 'Record a decision', { ns: 'editor' }),
    hint: (t) => t('questions.answerDecisionHint', 'A judgment call the model can cite later.', { ns: 'editor' }),
  },
  {
    id: 'design_revision',
    label: (t) => t('questions.answerRevision', 'Revise the design (opens a branch)', { ns: 'editor' }),
    hint: (t) => t('questions.answerRevisionHint', 'Record that the design will change, then open a branch to change it. Main is not changed.', { ns: 'editor' }),
  },
  {
    id: 'not_in_scope',
    label: (t) => t('questions.answerNotInScope', 'Not in scope', { ns: 'editor' }),
    hint: (t) => t('questions.answerNotInScopeHint', "It isn't yours to answer. The pin leaves the plan; the asker can ask again.", { ns: 'editor' }),
  },
  {
    id: 'decline',
    label: (t) => t('questions.answerDecline', 'Decline', { ns: 'editor' }),
    hint: (t) => t('questions.answerDeclineHint', 'You choose not to answer. The pin leaves the plan; the asker can ask again.', { ns: 'editor' }),
  },
]

/** A change of status, as a thread line says it ("Asked again", "Declined", "Withdrew it"). */
export const statusAct = (status: string, t: Translate = englishOnly): string => {
  switch (status) {
    case 'open':
      return t('questions.actAskedAgain', 'Asked again', { ns: 'editor' })
    case 'answered':
      return t('questions.actAnswered', 'Answered', { ns: 'editor' })
    case 'assumed':
      return t('questions.actAssumed', 'Going ahead on an assumption', { ns: 'editor' })
    case 'withdrawn':
      return t('questions.actWithdrew', 'Withdrew it', { ns: 'editor' })
    case 'declined':
      return t('questions.actDeclined', 'Declined', { ns: 'editor' })
    case 'not_in_scope':
      return t('questions.actNotInScope', 'Marked not in scope', { ns: 'editor' })
    default:
      return t('questions.actChangedIt', 'Changed it', { ns: 'editor' })
  }
}

/**
 * A stored answer outcome in words. The English is the kernel's own label, so a
 * Turkish screen learned the same five rows the English one already had; an
 * add-on's outcome keeps the registry's word in both languages.
 */
export const outcomeWord = (id: string, t: Translate = englishOnly): string => {
  switch (id) {
    case 'clarification':
      return t('questions.outcomeClarification', questionOutcomeLabel(id), { ns: 'editor' })
    case 'not_in_scope':
      return t('questions.outcomeNotInScope', questionOutcomeLabel(id), { ns: 'editor' })
    case 'judgment_recorded':
      return t('questions.outcomeDecisionRecorded', questionOutcomeLabel(id), { ns: 'editor' })
    case 'design_revision':
      return t('questions.outcomeDesignRevision', questionOutcomeLabel(id), { ns: 'editor' })
    case 'branch_opened':
      return t('questions.outcomeBranchOpened', questionOutcomeLabel(id), { ns: 'editor' })
    default:
      return questionOutcomeLabel(id)
  }
}

/** A custody event ("Took it over from Structural", "Forwarded it to Dana"), in the screen's language. */
export const eventLine = (e: QuestionEvent, t: Translate = englishOnly): string => {
  switch (e.kind) {
    case 'took_over':
      return e.from ? t('questions.eventTookOverFrom', 'Took it over from {{from}}', { ns: 'editor', from: e.from.label }) : t('questions.eventTookOver', 'Took it over', { ns: 'editor' })
    case 'forwarded':
      return t('questions.eventForwarded', 'Forwarded it{{from}}{{to}}', {
        ns: 'editor',
        from: e.from ? t('questions.eventForwardedFrom', ' from {{from}}', { ns: 'editor', from: e.from.label }) : '',
        to: e.to ? t('questions.eventForwardedTo', ' to {{to}}', { ns: 'editor', to: e.to.label }) : '',
      })
    case 'kept_closed':
      return e.reason ? t('questions.eventKeptClosedWhy', "Kept it closed: '{{reason}}'", { ns: 'editor', reason: e.reason }) : t('questions.eventKeptClosed', 'Kept it closed', { ns: 'editor' })
    default: {
      // An event this release has no words for: the id's own words, as the contract already did.
      const words = e.kind.replace(/[._]/g, ' ').trim()
      return words ? words.charAt(0).toUpperCase() + words.slice(1) : t('questions.actChangedIt', 'Changed it', { ns: 'editor' })
    }
  }
}

export function whenWords(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function personWords(a: AuthorRef | undefined, fallback: string): string {
  return a ? authorWords(a) : fallback
}

/** The thread of one question, oldest first, as lines a person reads. */
export function threadLines(model: ModelState, questionId: string, t: Translate = englishOnly): ThreadLine[] {
  const thread = questionThread(model.elements, questionId)
  if (!thread) return []
  return thread.entries.map((e) => {
    if (e.kind === 'answer') {
      const a = e.record.answer
      const v = recordValidity(model.elements, e.id)
      return { id: e.id, who: personWords(a.author, a.by), when: whenWords(a.at), act: t('questions.actAnsweredWith', 'Answered: {{outcome}}', { ns: 'editor', outcome: outcomeWord(a.outcome, t) }), text: a.text, ...(v.state === 'may_not_hold' ? { stale: v.words } : {}) }
    }
    const r = e.record.reply
    const to = r.statusChange?.to
    const acts = [to ? statusAct(to, t) : '', r.event ? eventLine(r.event, t) : ''].filter(Boolean)
    return { id: e.id, who: authorWords(r.author), when: whenWords(r.at), act: acts.join(' · '), text: r.text }
  })
}

/** Who asked, who carries it now, whom it is asked of, and the closed question it asks anew, in words, for the thread's header. */
export function askedByLine(model: ModelState, questionId: string, t: Translate = englishOnly): string | null {
  const q = questionThread(model.elements, questionId)?.question
  if (!q) return null
  const who = askerWords(q)
  const owner = q.ownerAuthor ? ownerWords(q) : null
  const prior = q.askedBefore ? questionAt(model.elements, q.askedBefore) : undefined
  const parts = [
    who ? t('questions.askedBy', 'Asked by {{who}}', { ns: 'editor', who }) : null,
    owner ? t('questions.carriedBy', 'Carried by {{who}}', { ns: 'editor', who: owner }) : null,
    q.formerAddressees?.length
      ? t('questions.askedOfBefore', 'Asked of {{who}} (before: {{before}})', { ns: 'editor', who: q.askOf, before: q.formerAddressees.map((p) => p.label).join(', ') })
      : null,
    prior ? t('questions.askedBeforeLine', 'Asked before: {{number}}, closed: {{status}}', { ns: 'editor', number: prior.number, status: statusLabel(prior.status, t) }) : null,
  ].filter((x): x is string => x !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** "Q-12 'Is there a beam?', closed: not in scope": the words a new question links back with. */
export function askedBeforeWords(model: ModelState, questionId: string, t: Translate = englishOnly): string | null {
  const q = questionAt(model.elements, questionId)
  if (!q) return null
  const text = q.text.length > 50 ? `${q.text.slice(0, 47)}...` : q.text
  return t('questions.askedBeforeWords', "{{number}} '{{text}}', closed: {{status}}", { ns: 'editor', number: q.number, text, status: statusLabel(q.status, t) })
}

/** Whether the question is closed and kept closed (Ask again is refused; ask a new question instead). */
export function keptClosed(model: ModelState, questionId: string): boolean {
  return Boolean(questionAt(model.elements, questionId)?.keptClosed)
}

/** Whether the signed-in person carries the question now (Take over is then nothing to do). */
export function iCarry(model: ModelState, questionId: string, me: AuthorRef | null): boolean {
  const q = questionAt(model.elements, questionId)
  return Boolean(q && me && isOwner(q, me))
}

/**
 * Why Ask again is off for this person, or null when they may press it.
 * The kernel refuses the same command in the same words; this only lets the
 * button say why before anyone presses it (Nielsen 5).
 */
export function askAgainBlocked(model: ModelState, questionId: string, me: AuthorRef | null, t: Translate = englishOnly): string | null {
  const q = questionThread(model.elements, questionId)?.question
  if (!q) return null
  const may = mayAskAgain(q, me)
  if (may.ok) return null
  return q.keptClosed ? t('questions.refusedDot', '{{reason}}.', { ns: 'editor', reason: may.reason }) : t('questions.refusedReplyInstead', '{{reason}}. You can reply instead.', { ns: 'editor', reason: may.reason })
}

/** Whether the signed-in person asked this question (the bell and the thread say "you"). */
export function iAsked(model: ModelState, questionId: string, me: AuthorRef | null): boolean {
  const q = questionThread(model.elements, questionId)?.question
  return Boolean(q && me && isAsker(q, me))
}
