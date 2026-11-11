'use client'

import { useMemo, useState } from 'react'
import {
  CHANGE_WORDS,
  UNCLASSIFIED_KIND,
  changeKindsFor,
  disciplineLabel,
  type ChangeSignificanceKindDef,
  type ChangeTarget,
} from '@permitzip/bim-kernel'
import type { PackSet } from '@permitzip/bim-kernel/packs'
import { Button } from '../../ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Spinner } from '../../ui/spinner'
import { Textarea } from '../../ui/textarea'
import type { ClassifierOption } from '../../contracts/bim/change-orders/model'
import { targetWords } from '../../contracts/bim/change-orders/model'
import { QuantityDeltaList } from '../change-orders/QuantityDeltaList'
import type { QuantityDeltaState } from '../change-orders/useQuantityDelta'
import { useEditorTranslate } from '../i18n/translate'

export interface ChangeKindDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly target: ChangeTarget
  readonly set: PackSet
  readonly currentKind: string | null
  /** The viewer's responsibilities that cover this change; null while the change is still loading. */
  readonly covering: readonly ClassifierOption[] | null
  readonly delta: QuantityDeltaState
  readonly onRetryDelta: () => void
  /** Saves; throws an Error with words to show when refused. */
  readonly onSave: (input: { kind: string; reason: string; citation?: string; responsibilityId: string }) => Promise<void>
}

/**
 * "What kind of change was this?": the covering professional picks a kind,
 * says why (and cites the requirement when the kind needs it). A design
 * change is never a change order; nothing here opens one. Esc and Cancel
 * close it without saving.
 */
export function ChangeKindDialog({ open, onOpenChange, target, set, currentKind, covering, delta, onRetryDelta, onSave }: ChangeKindDialogProps) {
  const t = useEditorTranslate()
  const kinds = useMemo(() => changeKindsFor(set).filter((k) => k.id !== UNCLASSIFIED_KIND), [set])
  const [kind, setKind] = useState<string>(currentKind && currentKind !== UNCLASSIFIED_KIND ? currentKind : '')
  const [reason, setReason] = useState('')
  const [citation, setCitation] = useState('')
  const [picked, setPicked] = useState('')
  const responsibilityId = picked || covering?.[0]?.responsibility.id || ''
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const def: ChangeSignificanceKindDef | undefined = kinds.find((k) => k.id === kind)
  const blocked = covering === null ? t('versions.waitForQuantity', 'Wait for the quantity change to load.', { ns: 'editor' }) : !def ? t('versions.pickAKind', 'Pick a kind of change.', { ns: 'editor' }) : reason.trim().length === 0 ? CHANGE_WORDS.reasonRequired : def.needsCitation === true && citation.trim().length === 0 ? CHANGE_WORDS.citationRequired : !responsibilityId ? CHANGE_WORDS.noResponsibility : null

  async function save() {
    if (blocked || !def) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ kind: def.id, reason: reason.trim(), ...(citation.trim() ? { citation: citation.trim() } : {}), responsibilityId })
      onOpenChange(false)
    } catch (err) {
      console.error('[ChangeKindDialog] saving the classification failed', err)
      setError(err instanceof Error ? err.message : t('versions.kindSaveFailed', 'Couldn\'t save what kind of change this was. Try again.', { ns: 'editor' }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('versions.whatKindWasThis', 'What kind of change was this?', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {targetWords(target)}. {CHANGE_WORDS.notAChangeOrder} {t('versions.kindOpeningNotChangeOrder', 'Saying what kind it was doesn’t open a change order.', { ns: 'editor' })}
          </DialogDescription>
        </DialogHeader>
        <QuantityDeltaList state={delta} onRetry={onRetryDelta} />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="change-kind">{t('versions.kindOfChange', 'Kind of change', { ns: 'editor' })}</FieldLabel>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="change-kind" aria-label={t('versions.kindOfChange', 'Kind of change', { ns: 'editor' })}>
                <SelectValue placeholder={t('versions.pickOne', 'Pick one', { ns: 'editor' })} />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {def ? <FieldDescription>{def.description}</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="change-kind-reason">{t('versions.why', 'Why', { ns: 'editor' })}</FieldLabel>
            <Textarea id="change-kind-reason" value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} placeholder={t('versions.whyExplains', 'So the record explains the decision', { ns: 'editor' })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="change-kind-citation">{def?.needsCitation ? t('versions.sectionRequired', 'Requirement or specification section (required)', { ns: 'editor' }) : t('versions.sectionOptional', 'Requirement or specification section (optional)', { ns: 'editor' })}</FieldLabel>
            <Input id="change-kind-citation" value={citation} maxLength={500} onChange={(e) => setCitation(e.target.value)} placeholder={t('versions.sectionPlaceholder', 'e.g. Spec 01 31 00, 1.4.B', { ns: 'editor' })} />
          </Field>
          {covering && covering.length > 1 ? (
            <Field>
              <FieldLabel htmlFor="change-kind-under">{t('versions.asResponsibleFor', 'As responsible for', { ns: 'editor' })}</FieldLabel>
              <Select value={responsibilityId} onValueChange={setPicked}>
                <SelectTrigger id="change-kind-under" aria-label={t('versions.asResponsibleFor', 'As responsible for', { ns: 'editor' })}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {covering.map((c) => (
                    <SelectItem key={c.responsibility.id} value={c.responsibility.id}>
                      {disciplineLabel(c.responsibility.discipline)} ({c.scopeWords})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('versions.cancel', 'Cancel', { ns: 'editor' })}</Button>
          </DialogClose>
          <Button onClick={() => void save()} disabled={blocked !== null || saving} title={blocked ?? undefined}>
            {saving ? <Spinner aria-hidden /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
