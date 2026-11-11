'use client'

import { useState } from 'react'
import { CHANGE_WORDS } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Spinner } from '../../ui/spinner'
import { Textarea } from '../../ui/textarea'
import { AssuranceButton } from '../signing/AssuranceButton'
import type { AssuranceOffer } from '../signing/useAssuranceOffer'
import type { Assurance } from '../../contracts/bim/signing/client'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

export type Answer = 'accepted' | 'refused' | 'no_cost'

/**
 * One answer's words — the question, the button and the reason's label. A
 * `label(t)` accessor rather than a const table: a table would freeze in
 * whichever language the module first loaded in.
 */
function answerWords(answer: Answer, t: Translate = englishOnly): { readonly title: string; readonly action: string; readonly reasonLabel: string } {
  switch (answer) {
    case 'accepted':
      return {
        title: t('changeOrders.acceptQuestion', 'Accept this change order?', { ns: 'editor' }),
        action: t('changeOrders.accept', 'Accept', { ns: 'editor' }),
        reasonLabel: t('changeOrders.whyAccept', 'Why you accept it', { ns: 'editor' }),
      }
    case 'refused':
      return {
        title: t('changeOrders.refuseQuestion', 'Refuse this change order?', { ns: 'editor' }),
        action: t('changeOrders.refuse', 'Refuse', { ns: 'editor' }),
        reasonLabel: t('changeOrders.whyRefuse', 'Why you refuse it', { ns: 'editor' }),
      }
    case 'no_cost':
      return {
        title: t('changeOrders.noCostQuestion', 'Mark this change order no cost?', { ns: 'editor' }),
        action: t('changeOrders.markNoCost', 'Mark no cost', { ns: 'editor' }),
        reasonLabel: t('changeOrders.whyNoCost', 'Why it costs nothing', { ns: 'editor' }),
      }
  }
}

/**
 * The addressed party's answer: accept, refuse or no cost, each with a
 * reason, and optionally the requirement it cites. The answer is final and
 * is recorded in the model's sign-off log. Esc and Cancel close it without
 * answering. With `signing`, the answer can also be signed with Touch ID or
 * verified with a one-time code (offered, never required: the plain button
 * records it).
 */
export function AnswerChangeOrderDialog({
  answer,
  title,
  onClose,
  onAnswer,
  signing,
}: {
  readonly answer: Answer | null
  readonly title: string
  readonly onClose: () => void
  readonly onAnswer: (input: { status: Answer; reason: string; citation?: string; assurance: Assurance | null }) => Promise<void>
  readonly signing?: AssuranceOffer
}) {
  const t = useEditorTranslate()
  const [reason, setReason] = useState('')
  const [citation, setCitation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const words = answer ? answerWords(answer, t) : null
  const blocked = reason.trim().length === 0 ? CHANGE_WORDS.reasonRequired : null

  async function confirm(assurance: Assurance | null) {
    if (!answer || blocked) return
    setSaving(true)
    setError(null)
    try {
      await onAnswer({ status: answer, reason: reason.trim(), ...(citation.trim() ? { citation: citation.trim() } : {}), assurance })
      setReason('')
      setCitation('')
      onClose()
    } catch (err) {
      console.error('[AnswerChangeOrderDialog] answering failed', err)
      setError(err instanceof Error ? err.message : t('changeOrders.answerFailed', 'Couldn\'t record your answer. Try again.', { ns: 'editor' }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={answer !== null} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{words?.title}</DialogTitle>
          <DialogDescription>
            {t('changeOrders.finalAnswer', '“{{title}}”. Your answer is final and is recorded in this model’s sign-off log with your name.', { ns: 'editor', title })}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="co-answer-reason">{words?.reasonLabel}</FieldLabel>
            <Textarea id="co-answer-reason" value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="co-answer-citation">{t('changeOrders.sectionOptional', 'Coordination requirement or specification section (optional)', { ns: 'editor' })}</FieldLabel>
            <Input id="co-answer-citation" value={citation} maxLength={500} onChange={(e) => setCitation(e.target.value)} placeholder={t('changeOrders.sectionPlaceholder', 'e.g. Spec 01 31 00, 1.4.B', { ns: 'editor' })} />
          </Field>
          {error ? <FieldError>{error}</FieldError> : null}
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('changeOrders.cancel', 'Cancel', { ns: 'editor' })}</Button>
          </DialogClose>
          {signing && words ? <AssuranceButton offer={signing} busy={saving} blockedReason={blocked} onSecure={(a) => void confirm(a)} action={words.action} testId="change-order-answer-signed" /> : null}
          <Button variant={answer === 'refused' ? 'destructive' : 'default'} disabled={blocked !== null || saving} title={blocked ?? undefined} onClick={() => void confirm(null)}>
            {saving ? <Spinner aria-hidden /> : null}
            {words?.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
