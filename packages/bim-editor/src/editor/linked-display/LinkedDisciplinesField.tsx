'use client'

import { X } from 'lucide-react'
import type { PackSet } from '@permitzip/bim-kernel/packs'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import {
  MAX_CONTRIBUTOR_CHARS,
  MAX_LINKED_DISCIPLINES,
  isLinkedDiscipline,
  linkedDisciplineChoices,
  linkedDisciplineLabel,
  type LinkedDiscipline,
} from '../../contracts/building-model/linked-contract'
import { LinkedDisciplineSelectItems } from './LinkedDisciplineSelectItems'
import { useEditorTranslate } from '../i18n/translate'

/**
 * What a linked model shows: its main discipline (the one older views use)
 * and any others it carries (one firm's model may carry several).
 * Every choice comes from the open model's registry. `value[0]` is the main one.
 */
export function LinkedDisciplinesField({
  id,
  value,
  onChange,
  set,
  disabled,
}: {
  readonly id: string
  readonly value: readonly LinkedDiscipline[]
  readonly onChange: (next: readonly LinkedDiscipline[]) => void
  readonly set?: PackSet
  readonly disabled?: boolean
}) {
  const t = useEditorTranslate()
  const [main, ...more] = value
  const primary = main ?? 'architecture'
  const left = linkedDisciplineChoices(set).filter((c) => !value.includes(c.value))
  const full = value.length >= MAX_LINKED_DISCIPLINES
  const addBlocked = disabled
    ? null
    : full
      ? t('linkedModel.tooManyDisciplines', 'A linked model can show up to {{max}} disciplines.', { ns: 'editor', max: MAX_LINKED_DISCIPLINES })
      : left.length === 0
        ? t('linkedModel.everyDisciplinePicked', 'Every discipline is already picked.', { ns: 'editor' })
        : null
  return (
    <>
      <Field>
        <FieldLabel htmlFor={id}>{t('linkedModel.whatItShows', 'What it shows', { ns: 'editor' })}</FieldLabel>
        <Select value={primary} onValueChange={(v) => isLinkedDiscipline(v) && onChange([v, ...more.filter((d) => d !== v)])} disabled={disabled}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <LinkedDisciplineSelectItems set={set} current={primary} />
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-more`}>{t('linkedModel.alsoShows', 'Also shows (optional)', { ns: 'editor' })}</FieldLabel>
        {more.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid={`${id}-more-list`}>
            {more.map((d) => {
              const label = linkedDisciplineLabel(d, set)
              return (
                <Badge key={d} variant="secondary" className="gap-1 pr-0.5">
                  {label}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t('linkedModel.removeDiscipline', 'Remove {{name}}', { ns: 'editor', name: label })}
                    disabled={disabled}
                    onClick={() => onChange([primary, ...more.filter((x) => x !== d)])}
                  >
                    <X />
                  </Button>
                </Badge>
              )
            })}
          </div>
        )}
        <Select value="" onValueChange={(v) => isLinkedDiscipline(v) && !value.includes(v) && onChange([primary, ...more, v])} disabled={disabled || addBlocked !== null}>
          <SelectTrigger id={`${id}-more`} title={addBlocked ?? undefined}>
            <SelectValue placeholder={addBlocked ?? t('linkedModel.addAnotherDiscipline', 'Add another discipline…', { ns: 'editor' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {left.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>
          {t('linkedModel.severalDisciplines', "One firm's model can carry several disciplines; pick each one it shows.", { ns: 'editor' })}
        </FieldDescription>
      </Field>
    </>
  )
}

/** Who contributed a linked model: the company and the person there to ask. Both optional. */
export function LinkedContributorFields({
  id,
  organization,
  contact,
  onChange,
  disabled,
}: {
  readonly id: string
  readonly organization: string
  readonly contact: string
  readonly onChange: (next: { organization: string; contact: string }) => void
  readonly disabled?: boolean
}) {
  const t = useEditorTranslate()
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field>
        <FieldLabel htmlFor={`${id}-company`}>{t('linkedModel.companyOptional', 'Company (optional)', { ns: 'editor' })}</FieldLabel>
        <Input
          id={`${id}-company`}
          value={organization}
          maxLength={MAX_CONTRIBUTOR_CHARS}
          disabled={disabled}
          placeholder={t('linkedModel.companyExample', 'e.g. Acme Engineering', { ns: 'editor' })}
          onChange={(e) => onChange({ organization: e.target.value, contact })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-contact`}>{t('linkedModel.contactOptional', 'Contact (optional)', { ns: 'editor' })}</FieldLabel>
        <Input
          id={`${id}-contact`}
          value={contact}
          maxLength={MAX_CONTRIBUTOR_CHARS}
          disabled={disabled}
          placeholder={t('linkedModel.contactExample', 'e.g. J. Rao', { ns: 'editor' })}
          onChange={(e) => onChange({ organization, contact: e.target.value })}
        />
      </Field>
    </div>
  )
}
