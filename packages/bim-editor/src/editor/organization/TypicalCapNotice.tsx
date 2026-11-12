'use client'

import { useState } from 'react'
import { MAX_TYPICAL_COPIES, typicalCapStatus, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Field, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { useEditorTranslate } from '../i18n/translate'
import type { SubmitCommand } from '../views-sheets/types'

interface Props {
  readonly model: ModelState
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
}

/**
 * How many typical types the project has against what the contract covers
 * (STATUS decision 15: default 10, a model setting). Above the cap it is a
 * warning with the count to change; within it, one quiet line. Never blocks
 * making a typical.
 *
 * The sentence is built here from `status.count` and `status.cap` rather than
 * shown from `status.message`: the kernel's own words are English, and a Turkish
 * frame with an English sentence inside it is the defect this tree is closing.
 */
export function TypicalCapNotice({ model, canEdit, blockedReason, submit }: Props) {
  const t = useEditorTranslate()
  const status = typicalCapStatus(model)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(status.cap))
  const [error, setError] = useState<string | null>(null)
  if (status.count === 0 && !status.over) return null

  const n = Number(draft)
  const reason = !canEdit
    ? blockedReason
    : !Number.isInteger(n) || n < 1 || n > MAX_TYPICAL_COPIES
      ? t('org.typicalCap.wholeNumber', 'Type a whole number from 1 to {{max}}.', { ns: 'editor', max: MAX_TYPICAL_COPIES })
      : null
  const save = () => {
    if (reason || n === status.cap) {
      setEditing(false)
      return
    }
    const refusal = submit({ type: 'set_typical_cap', cap: n }, t('org.undo.setTypicalCap', "set the contract's typicals to {{n}}", { ns: 'editor', n }))
    setError(refusal)
    if (!refusal) setEditing(false)
  }

  const form = (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <Field className="w-40">
        <FieldLabel htmlFor="typical-cap">{t('org.typicalCap.covers', 'Contract covers', { ns: 'editor' })}</FieldLabel>
        <Input
          id="typical-cap"
          inputMode="numeric"
          value={draft}
          disabled={!canEdit}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setDraft(String(status.cap))
              setEditing(false)
            }
          }}
          data-testid="typical-cap-input"
        />
      </Field>
      <Button type="submit" size="sm" disabled={reason !== null} title={reason ?? undefined} data-testid="typical-cap-save">
        {t('org.typicalCap.save', 'Save', { ns: 'editor' })}
      </Button>
      {(reason ?? error) && <span className="text-xs text-muted-foreground" data-testid="typical-cap-reason">{error ?? reason}</span>}
    </form>
  )

  if (status.over) {
    return (
      <Alert variant="default" className="border-warning-300 bg-warning-50" data-testid="typical-cap-warning">
        <AlertTitle>
          {t('org.typicalCap.overTitle', 'This project has {{n}} typicals; the contract covers {{cap}}', { ns: 'editor', n: status.count, cap: status.cap })}
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>
            {status.count - status.cap === 1
              ? t('org.typicalCap.agreeOne', 'Agree the extra one with the client, or change the number the contract covers.', { ns: 'editor' })
              : t('org.typicalCap.agreeMany', 'Agree the extra ones with the client, or change the number the contract covers.', { ns: 'editor' })}
          </span>
          {form}
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="typical-cap-line">
      <span>{t('org.typicalCap.line', '{{count}} of {{cap}} typicals the contract covers', { ns: 'editor', count: status.count, cap: status.cap })}</span>
      {editing ? (
        form
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={!canEdit}
          title={canEdit ? t('org.typicalCap.changeTitle', 'Change how many typicals the contract covers', { ns: 'editor' }) : blockedReason}
          onClick={() => setEditing(true)}
          data-testid="typical-cap-change"
        >
          {t('org.typicalCap.change', 'Change', { ns: 'editor' })}
        </Button>
      )}
    </div>
  )
}
