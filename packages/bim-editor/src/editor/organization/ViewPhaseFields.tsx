'use client'

import { organizationOf, viewPhaseFilterId, viewPhaseId, type DisplayContext, type ModelState } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useEditorTranslate } from '../i18n/translate'

interface Props {
  readonly model: ModelState
  readonly context: DisplayContext
  /** Saves the change for a saved view, or applies it to the free 3D model; returns the plain reason when refused. */
  readonly onChange: (change: { readonly phaseId?: string; readonly phaseFilterId?: string }) => string | null
  readonly disabledReason: string | null
  readonly onEditFilters: () => void
  readonly idPrefix: string
}

/** A view's Phase and Phase filter. */
export function ViewPhaseFields({ model, context, onChange, disabledReason, onEditFilters, idPrefix }: Props) {
  const t = useEditorTranslate()
  const org = organizationOf(model)
  const phase = viewPhaseId(org, context)
  const filter = viewPhaseFilterId(org, context)
  return (
    <div className="flex flex-col gap-3" data-testid={`${idPrefix}-phase-fields`}>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-phase`}>{t('org.viewPhase.phase', 'Phase', { ns: 'editor' })}</FieldLabel>
        <Select value={phase} disabled={disabledReason !== null} onValueChange={(id) => onChange({ phaseId: id })}>
          <SelectTrigger id={`${idPrefix}-phase`} size="sm" data-testid={`${idPrefix}-phase`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {org.phases.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.entry.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>
          {disabledReason ?? t('org.viewPhase.phaseHint', 'The model as it stands at the end of this phase. Later work does not show.', { ns: 'editor' })}
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-phase-filter`}>{t('org.viewPhase.phaseFilter', 'Phase filter', { ns: 'editor' })}</FieldLabel>
        <div className="flex items-center gap-2">
          <Select value={filter} disabled={disabledReason !== null} onValueChange={(id) => onChange({ phaseFilterId: id })}>
            <SelectTrigger id={`${idPrefix}-phase-filter`} size="sm" className="flex-1" data-testid={`${idPrefix}-phase-filter`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {org.filters.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.entry.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={onEditFilters}>
            {t('org.viewPhase.edit', 'Edit…', { ns: 'editor' })}
          </Button>
        </div>
        <FieldDescription>{t('org.viewPhase.filterHint', 'How new, existing and demolished work draws here.', { ns: 'editor' })}</FieldDescription>
      </Field>
    </div>
  )
}
