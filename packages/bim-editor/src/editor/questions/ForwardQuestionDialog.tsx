'use client'

import { useCallback, useEffect, useState } from 'react'
import { Forward } from 'lucide-react'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { fetchForwardCandidatesFrom } from '../../contracts/bim/questions/readers'
import type { ForwardCandidate } from '../../contracts/bim/questions/contract'
import { ProjectPersonPicker, type PeopleState } from './ProjectPersonPicker'
import { useEditorTranslate } from '../i18n/translate'

/** Where the question goes: a person picked from the project, or a company outside it (by name, with their person's email to share the thread). */
export type ForwardTarget = { readonly kind: 'person'; readonly person: ForwardCandidate } | { readonly kind: 'outside'; readonly company: string; readonly email: string | null }

export interface ForwardQuestionDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly number: string
  /** Who it is asked of now, in words: they keep the conversation. */
  readonly askOfLabel: string
  /** Where the project's people come from. Null: only "outside the project" by name (no roster). */
  readonly projectId: string | null
  /**
   * Forward it. Returns the model's refusal in words, or null when it saved.
   * `people`: the roster as loaded (null when it didn't load), so the caller
   * can tell who is outside the project.
   */
  readonly onForward: (target: ForwardTarget, people: readonly ForwardCandidate[] | null) => string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Forward a question (round 10): pick a person on the project, who hears it
 * in their bell, or name a company outside the project and give their
 * person's email so they can read this one conversation, read-only. Whoever
 * had it keeps the conversation. Cancel and Esc close it; forwarding back
 * undoes it (Nielsen 3). At most five controls in view (8): why it moved
 * goes in a reply, where everyone reads it.
 */
export function ForwardQuestionDialog({ open, onClose, number, askOfLabel, projectId, onForward }: ForwardQuestionDialogProps) {
  const t = useEditorTranslate()
  const questions = useEditorHost().data.questions
  const [where, setWhere] = useState<'person' | 'outside'>(projectId ? 'person' : 'outside')
  const [people, setPeople] = useState<PeopleState>({ kind: 'loading' })
  const [picked, setPicked] = useState<ForwardCandidate | null>(null)
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)

  const fetchPeople = useCallback(() => {
    if (!projectId) return
    fetchForwardCandidatesFrom(questions, projectId)
      .then((list) => setPeople({ kind: 'ready', people: list }))
      .catch((err: unknown) => {
        console.error('[ForwardQuestionDialog] loading the project people failed', err)
        setPeople({ kind: 'error', message: err instanceof Error ? err.message : t('questions.peopleDidntLoad', "The project's people didn't load.", { ns: 'editor' }) })
      })
  }, [questions, projectId, t])

  useEffect(() => {
    if (open) fetchPeople()
  }, [open, fetchPeople])

  const retry = () => {
    setPeople({ kind: 'loading' })
    fetchPeople()
  }

  const reset = () => {
    setPicked(null)
    setCompany('')
    setEmail('')
    setRefusal(null)
  }
  const close = () => {
    reset()
    onClose()
  }

  const emailTyped = email.trim()
  const emailBad = emailTyped !== '' && !EMAIL.test(emailTyped)
  const why =
    where === 'person'
      ? picked
        ? null
        : t('questions.pickPersonFirst', 'Pick the person to ask first.', { ns: 'editor' })
      : company.trim() === ''
        ? t('questions.nameCompanyFirst', 'Name the company first.', { ns: 'editor' })
        : emailBad
          ? t('questions.badEmail', 'That email doesn’t look right (name@company.com).', { ns: 'editor' })
          : null

  const send = () => {
    if (why) return
    const target: ForwardTarget = where === 'person' && picked ? { kind: 'person', person: picked } : { kind: 'outside', company: company.trim(), email: emailTyped === '' ? null : emailTyped }
    const refused = onForward(target, people.kind === 'ready' ? people.people : null)
    if (refused) {
      setRefusal(refused)
      return
    }
    close()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent data-testid="question-forward-dialog">
        <DialogHeader>
          <DialogTitle>{t('questions.forwardTitle', 'Forward {{number}}', { ns: 'editor', number })}</DialogTitle>
          <DialogDescription>{t('questions.forwardDescription', '{{who}} keeps the conversation and still hears about it.', { ns: 'editor', who: askOfLabel })}</DialogDescription>
        </DialogHeader>
        {projectId ? (
          <ToggleGroup type="single" variant="outline" value={where} onValueChange={(v) => (v === 'person' || v === 'outside') && setWhere(v)} aria-label={t('questions.whoToAsk', 'Who to ask', { ns: 'editor' })} data-testid="question-forward-where">
            <ToggleGroupItem value="person" data-testid="question-forward-person">
              {t('questions.someoneOnProject', 'Someone on the project', { ns: 'editor' })}
            </ToggleGroupItem>
            <ToggleGroupItem value="outside" data-testid="question-forward-outside">
              {t('questions.companyOutside', 'A company outside it', { ns: 'editor' })}
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}
        {where === 'person' ? (
          <ProjectPersonPicker state={people} selected={picked?.userId ?? null} onSelect={setPicked} onRetry={retry} />
        ) : (
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="forward-company">{t('questions.company', 'Company', { ns: 'editor' })}</FieldLabel>
              <Input id="forward-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={60} placeholder={t('questions.placeholderCompany', 'Acme Steel', { ns: 'editor' })} data-testid="question-forward-to" />
            </Field>
            <Field>
              <FieldLabel htmlFor="forward-email">{t('questions.theirPersonEmail', "Their person's email (optional)", { ns: 'editor' })}</FieldLabel>
              <Input id="forward-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} placeholder={t('questions.placeholderEmail', 'name@acme-steel.com', { ns: 'editor' })} aria-invalid={emailBad} data-testid="question-forward-email" />
              <FieldDescription>{t('questions.outsideHint', 'They can read this one conversation, read-only, once they sign in as a guest. Nothing else in the model.', { ns: 'editor' })}</FieldDescription>
            </Field>
          </div>
        )}
        {refusal ? (
          <p role="alert" className="text-sm text-danger-600" data-testid="question-forward-refusal">
            {refusal}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t('questions.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button onClick={send} disabled={why !== null} title={why ?? undefined} data-testid="question-forward-save">
            <Forward data-icon="inline-start" />
            {where === 'person' && picked ? t('questions.forwardToName', 'Forward to {{name}}', { ns: 'editor', name: picked.name }) : t('questions.forward', 'Forward', { ns: 'editor' })}
          </Button>
        </DialogFooter>
        {why ? (
          <p className="text-xs text-muted-foreground" data-testid="question-forward-why">
            {why}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
