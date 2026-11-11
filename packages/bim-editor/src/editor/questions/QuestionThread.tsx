'use client'

import { useMemo, useState } from 'react'
import { Ellipsis, MessageSquarePlus, MessageSquareReply, RotateCcw, TriangleAlert, Undo2 } from 'lucide-react'
import type { AuthorRef, ModelState } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { Field, FieldLabel } from '../../ui/field'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Textarea } from '../../ui/textarea'
import type { QuestionCommand } from '../../contracts/bim/questions/kernel'
import { DEFAULT_HOST_IDENTITY } from '../../contracts/bim/identity/host-provider'
import { useOptionalEditorHost } from '@permitzip/bim-editor/host'
import type { QuestionRow } from './question-rows'
import { askAgainBlocked, askedBeforeWords, askedByLine, iCarry, keptClosed, threadLines } from './thread-rows'
import { QuestionLinks } from './QuestionLinks'
import { ForwardQuestionDialog, type ForwardTarget } from './ForwardQuestionDialog'
import { QuestionReaders } from './QuestionReaders'
import type { ForwardCandidate } from '../../contracts/bim/questions/contract'
import { useEditorTranslate } from '../i18n/translate'

export interface QuestionThreadProps {
  readonly model: ModelState
  readonly row: QuestionRow
  /** Why editing is off, or null. */
  readonly editReason: string | null
  /** The signed-in person, so Ask again can say who may press it. Absent: the model's refusal says it. */
  readonly me?: AuthorRef | null
  readonly send: (command: QuestionCommand, label: string) => boolean
  /** Open the answer choices (Clarify, Record a decision, Revise the design, Not in scope, Decline). */
  readonly onAnswer: () => void
  /** Saved: tell the asker, owner and person asked (the bell). */
  readonly onActed?: (event: 'replied' | 'asked_again' | 'withdrawn' | 'took_over', text: string) => void
  /** Forwarded and saved (round 10): tell the new addressee and the rest, and keep it readable for whoever is now outside. `people`: the roster as loaded, null when it didn't load. */
  readonly onForwarded?: (target: ForwardTarget, people: readonly ForwardCandidate[] | null) => void
  /** Bumped after a share, so "Read-only for people outside the project" reloads. */
  readonly readersVersion?: number
  /** A kept-closed question: ask a new one that links back to it. */
  readonly onAskAnew?: (askedBefore: { readonly id: string; readonly words: string }) => void
  /** Where its links to client RFIs, submissions and Procore items live. Absent: no links shown. */
  readonly links?: { readonly projectId: string; readonly modelId: string } | null
}

/**
 * A question's conversation, oldest first: who said what, and every change
 * of state ("J. Rao declined", "Asked again", "Took it over", "Forwarded it"),
 * and an answer that may no longer hold says what changed. Anyone may reply;
 * a reply never reopens a declined question. Four controls: Reply, Answer,
 * Ask again (or Withdraw, or Ask a new question once kept closed), and More
 * (Take over, Forward). Never "overdue": nobody is obliged to answer.
 */
export function QuestionThread({ model, row, editReason, me, send, onAnswer, onActed, onForwarded, onAskAnew, links, readersVersion = 0 }: QuestionThreadProps) {
  const t = useEditorTranslate()
  const [reply, setReply] = useState('')
  const [forwarding, setForwarding] = useState(false)
  const hostProviderId = (useOptionalEditorHost()?.identity.provider ?? DEFAULT_HOST_IDENTITY).id
  const locked = keptClosed(model, row.id)
  const carrying = me ? iCarry(model, row.id, me) : false
  const lines = useMemo(() => threadLines(model, row.id, t), [model, row.id, t])
  const askedBy = useMemo(() => askedByLine(model, row.id, t), [model, row.id, t])
  const closed = row.status === 'declined' || row.status === 'not_in_scope'
  const reopenable = closed || row.status === 'answered' || row.status === 'withdrawn'
  const blocked = me === undefined ? null : askAgainBlocked(model, row.id, me, t)
  const askAgainReason = editReason ?? blocked
  const replyReason = editReason ?? (reply.trim() === '' ? t('questions.typeReplyFirst', 'Type a reply first.', { ns: 'editor' }) : null)

  const sendReply = () => {
    const text = reply.trim()
    if (!text) return
    if (send({ type: 'reply_question', questionId: row.id, text }, t('questions.undoReply', 'Reply', { ns: 'editor' }))) {
      setReply('')
      onActed?.('replied', text)
    }
  }

  return (
    <div className="flex w-full flex-col gap-2" data-testid="question-thread" data-question={row.id} data-status={row.status}>
      <p className="text-xs text-muted-foreground" data-testid="question-thread-state">
        {[askedBy, closed ? t('questions.threadStateClosed', '{{status}}. The pin is off the plan; the question stays here.', { ns: 'editor', status: row.statusLabel }) : t('questions.threadState', '{{status}}.', { ns: 'editor', status: row.statusLabel })].filter(Boolean).join(' · ')}
      </p>
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="question-thread-empty">
          {t('questions.noReplies', 'No replies yet. Anyone on the project can reply; nobody has to.', { ns: 'editor' })}
        </p>
      ) : (
        <ItemGroup className="gap-1" aria-label={t('questions.conversationOn', 'Conversation on {{number}}', { ns: 'editor', number: row.number })}>
          {lines.map((l) => (
            <Item key={l.id} size="xs" variant="muted" className="items-start p-2" data-testid="question-thread-line">
              <ItemContent className="min-w-0">
                <ItemTitle className="whitespace-normal text-xs font-medium">
                  {l.who}
                  {l.act ? ` · ${l.act}` : ''}
                  {l.when ? <span className="ml-1 font-normal text-muted-foreground">{l.when}</span> : null}
                </ItemTitle>
                {l.text ? <ItemDescription className="line-clamp-none whitespace-pre-wrap text-xs text-foreground">{l.text}</ItemDescription> : null}
                {l.stale ? (
                  <ItemDescription className="flex items-center gap-1 text-xs text-warning-700" data-testid="question-thread-stale">
                    <TriangleAlert className="size-3" aria-hidden="true" />
                    {t('questions.staleLine', '{{words}}. Nothing was reopened; answer again or ask again if it matters.', { ns: 'editor', words: l.stale })}
                  </ItemDescription>
                ) : null}
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
      <Field>
        <FieldLabel htmlFor={`question-reply-${row.id}`} className="sr-only">
          {t('questions.replyOn', 'Reply on {{number}}', { ns: 'editor', number: row.number })}
        </FieldLabel>
        <Textarea id={`question-reply-${row.id}`} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('questions.replyPlaceholder', 'Reply, ask back or add a detail', { ns: 'editor' })} maxLength={2000} rows={2} disabled={editReason !== null} data-testid="question-reply-text" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={sendReply} disabled={replyReason !== null} title={replyReason ?? t('questions.replyHint', 'Replying keeps the question as it is', { ns: 'editor' })} data-testid="question-reply-send">
          <MessageSquareReply data-icon="inline-start" />
          {t('questions.reply', 'Reply', { ns: 'editor' })}
        </Button>
        {row.status !== 'withdrawn' ? (
          <Button size="sm" variant="outline" onClick={onAnswer} disabled={editReason !== null} title={editReason ?? t('questions.answerHint', 'Clarify, record a decision, revise the design, not in scope, or decline', { ns: 'editor' })} data-testid="questions-answer">
            {t('questions.answer', 'Answer', { ns: 'editor' })}
          </Button>
        ) : null}
        {locked ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const words = askedBeforeWords(model, row.id, t)
              if (words) onAskAnew?.({ id: row.id, words })
            }}
            disabled={editReason !== null || !onAskAnew}
            title={editReason ?? t('questions.askAnewHint', 'It was closed and kept closed. A new question links back to this one.', { ns: 'editor' })}
            data-testid="questions-ask-anew"
          >
            <MessageSquarePlus data-icon="inline-start" />
            {t('questions.askAnew', 'Ask a new question', { ns: 'editor' })}
          </Button>
        ) : reopenable ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (send({ type: 'set_question_status', questionIds: [row.id], status: 'open' }, t('questions.undoAskAgain', 'Ask again', { ns: 'editor' }))) onActed?.('asked_again', '')
            }}
            disabled={askAgainReason !== null}
            title={askAgainReason ?? (closed ? t('questions.askAgainHintClosed', 'Open it again; its pin comes back on the plan', { ns: 'editor' }) : t('questions.askAgainHint', 'Open it again; the answer is cleared', { ns: 'editor' }))}
            data-testid="questions-reopen"
          >
            <RotateCcw data-icon="inline-start" />
            {t('questions.askAgain', 'Ask again', { ns: 'editor' })}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (send({ type: 'set_question_status', questionIds: [row.id], status: 'withdrawn' }, t('questions.undoWithdraw', 'Withdraw question', { ns: 'editor' }))) onActed?.('withdrawn', '')
            }}
            disabled={editReason !== null}
            title={editReason ?? t('questions.withdrawHint', 'No longer asked; it stays in the history and Undo brings it back', { ns: 'editor' })}
            data-testid="questions-withdraw"
          >
            <Undo2 data-icon="inline-start" />
            {t('questions.withdraw', 'Withdraw', { ns: 'editor' })}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={t('questions.moreFor', 'More for {{number}}', { ns: 'editor', number: row.number })} disabled={editReason !== null} title={editReason ?? t('questions.moreHint', 'Take over or forward', { ns: 'editor' })} data-testid="question-more">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={carrying}
              onSelect={() => {
                if (send({ type: 'take_over_question', questionId: row.id }, t('questions.undoTakeOver', 'Take over question', { ns: 'editor' }))) onActed?.('took_over', '')
              }}
              data-testid="question-take-over"
            >
              {carrying ? t('questions.youCarryThis', 'You carry this question', { ns: 'editor' }) : t('questions.takeOver', 'Take over (you carry it from now on)', { ns: 'editor' })}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={locked || row.status === 'withdrawn'} onSelect={() => setForwarding(true)} data-testid="question-forward">
              {locked ? t('questions.forwardClosed', 'Forward (closed and kept closed)', { ns: 'editor' }) : t('questions.forwardElsewhere', 'Forward to someone else…', { ns: 'editor' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {links ? <QuestionLinks projectId={links.projectId} modelId={links.modelId} recordKind="question" recordId={row.id} number={row.number} editReason={editReason} /> : null}
      {links ? <QuestionReaders projectId={links.projectId} modelId={links.modelId} questionId={row.id} model={model} version={readersVersion} canEdit={editReason === null} /> : null}
      <ForwardQuestionDialog
        open={forwarding}
        onClose={() => setForwarding(false)}
        number={row.number}
        askOfLabel={row.askOfLabel}
        projectId={links?.projectId ?? null}
        onForward={(target, people) => {
          const command: QuestionCommand =
            target.kind === 'person'
              ? { type: 'forward_question', questionId: row.id, askOf: target.person.name.slice(0, 60), askOfAuthor: { provider: hostProviderId, subject: target.person.userId, displayName: target.person.name.slice(0, 120) } }
              : { type: 'forward_question', questionId: row.id, askOf: target.company }
          if (!send(command, t('questions.undoForward', 'Forward question', { ns: 'editor' }))) return t('questions.forwardNotSaved', 'The model didn’t save the forward; the reason is shown above the list.', { ns: 'editor' })
          onForwarded?.(target, people)
          return null
        }}
      />
      {askAgainReason && reopenable && !editReason ? (
        <p className="text-xs text-muted-foreground" data-testid="question-ask-again-reason">
          {askAgainReason}
        </p>
      ) : null}
    </div>
  )
}
