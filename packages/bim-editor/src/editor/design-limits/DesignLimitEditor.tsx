'use client'

import { useState } from 'react'
import type { DesignLimit, DesignLimitSeverity } from '@permitzip/bim-kernel/policy'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Textarea } from '../../ui/textarea'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

/**
 * What breaking the limit means, as an accessor: a table of English is how
 * "Holds the issue until fixed" stayed English in a Turkish dialog.
 */
function severityWords(severity: DesignLimitSeverity, t: Translate = englishOnly): string {
  switch (severity) {
    case 'error':
      return t('designLimits.severity.error', 'Holds the issue until fixed', { ns: 'editor' })
    case 'warning':
      return t('designLimits.severity.warning', 'Warning', { ns: 'editor' })
    case 'info':
      return t('designLimits.severity.info', 'Note only', { ns: 'editor' })
  }
}

interface Draft {
  label: string
  quantity: string
  unit: string
  min: string
  max: string
  target: string
  severity: DesignLimitSeverity
  source: string
  note: string
  discipline: string
  systems: string
}

function draftOf(limit: DesignLimit | null): Draft {
  return {
    label: limit?.label ?? '',
    quantity: limit?.quantity ?? 'velocity',
    unit: limit?.unit ?? 'ft/s',
    min: limit?.band.min?.toString() ?? '',
    max: limit?.band.max?.toString() ?? '',
    target: limit?.band.target?.toString() ?? '',
    severity: limit?.severity ?? 'warning',
    source: limit?.citation.source ?? '',
    note: limit?.citation.note ?? '',
    discipline: limit?.appliesTo.discipline ?? '',
    systems: (limit?.appliesTo.systems ?? []).join(', '),
  }
}

const num = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s))
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'limit'

/** The limit a draft describes, keeping the id (and what it applies to beyond discipline and systems) of the row being changed. */
function limitOf(draft: Draft, initial: DesignLimit | null): DesignLimit {
  const systems = draft.systems.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  const min = num(draft.min)
  const max = num(draft.max)
  const target = num(draft.target)
  return {
    id: initial?.id ?? `firm:${slug(draft.label)}`,
    label: draft.label.trim(),
    quantity: draft.quantity.trim(),
    unit: draft.unit.trim(),
    appliesTo: {
      ...(initial?.appliesTo ?? {}),
      ...(draft.discipline.trim() ? { discipline: draft.discipline.trim() } : { discipline: undefined }),
      ...(systems.length > 0 ? { systems } : { systems: undefined }),
    },
    band: { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(target !== undefined ? { target } : {}) },
    severity: draft.severity,
    citation: { source: draft.source.trim(), ...(draft.note.trim() ? { note: draft.note.trim() } : {}) },
    ...(initial?.stages ? { stages: initial.stages } : {}),
  }
}

function withoutUndefined(limit: DesignLimit): DesignLimit {
  const a = Object.fromEntries(Object.entries(limit.appliesTo).filter(([, v]) => v !== undefined))
  return { ...limit, appliesTo: a }
}

/**
 * Add or change one design limit. Esc and Cancel close without saving; Save
 * checks the limit in words first ("the minimum is above the maximum") and
 * stays open with the problem shown until it is fixed or cancelled.
 */
export function DesignLimitEditor({ initial, fallback, onCancel, onSave }: { readonly initial: DesignLimit | null; readonly fallback: DesignLimit | null; readonly onCancel: () => void; readonly onSave: (limit: DesignLimit) => Promise<boolean> }) {
  const t = useEditorTranslate()
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial))
  const [problems, setProblems] = useState<readonly string[]>([])
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  const submit = async () => {
    const limit = withoutUndefined(limitOf(draft, initial))
    const bad = [limit.band.min, limit.band.max, limit.band.target].some((v) => v !== undefined && !Number.isFinite(v))
    const { designLimitSchema } = await import('@permitzip/bim-kernel/policy')
    const parsed = designLimitSchema.safeParse(limit)
    const found = [
      ...(bad ? [t('designLimits.minMaxNumber', 'Minimum, maximum and target must be numbers.', { ns: 'editor' })] : []),
      ...(parsed.success
        ? []
        : parsed.error.issues.map((i) =>
            t('designLimits.issueLine', '{{where}}: {{message}}', {
              ns: 'editor',
              where: i.path.join(' ') || t('designLimits.limit', 'Limit', { ns: 'editor' }),
              message: i.message,
            }),
          )),
    ]
    setProblems(found)
    if (found.length > 0) return
    setSaving(true)
    const ok = await onSave(limit)
    setSaving(false)
    if (!ok) setProblems([t('designLimits.notSaved', 'It wasn’t saved; the reason is shown above the list.', { ns: 'editor' })])
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial
              ? t('designLimits.changeNamed', 'Change {{name}}', { ns: 'editor', name: initial.label })
              : t('designLimits.addTitle', 'Add a design limit', { ns: 'editor' })}
          </DialogTitle>
          <DialogDescription>
            {fallback
              ? t('designLimits.defaultIs', 'The default is {{value}} {{unit}} ({{source}}).', {
                  ns: 'editor',
                  value: fallback.band.max ?? fallback.band.min ?? fallback.band.target,
                  unit: fallback.unit,
                  source: fallback.citation.source,
                })
              : t('designLimits.addWhy', 'Say what it measures, the band to stay inside and where the number comes from.', { ns: 'editor' })}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="dl-label">{t('designLimits.name', 'Name', { ns: 'editor' })}</FieldLabel>
            <Input
              id="dl-label"
              value={draft.label}
              onChange={set('label')}
              placeholder={t('designLimits.namePlaceholder', 'Domestic cold water velocity', { ns: 'editor' })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="dl-quantity">{t('designLimits.quantity', 'What it measures', { ns: 'editor' })}</FieldLabel>
              <Input
                id="dl-quantity"
                value={draft.quantity}
                onChange={set('quantity')}
                placeholder={t('designLimits.quantityPlaceholder', 'velocity', { ns: 'editor' })}
                disabled={initial !== null}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dl-unit">{t('designLimits.unit', 'Unit', { ns: 'editor' })}</FieldLabel>
              <Input id="dl-unit" value={draft.unit} onChange={set('unit')} placeholder={t('designLimits.unitPlaceholder', 'ft/s', { ns: 'editor' })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="dl-min">{t('designLimits.atLeast', 'At least', { ns: 'editor' })}</FieldLabel>
              <Input id="dl-min" inputMode="decimal" value={draft.min} onChange={set('min')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dl-max">{t('designLimits.atMost', 'At most', { ns: 'editor' })}</FieldLabel>
              <Input id="dl-max" inputMode="decimal" value={draft.max} onChange={set('max')} data-testid="design-limit-max" />
            </Field>
            <Field>
              <FieldLabel htmlFor="dl-target">{t('designLimits.aimFor', 'Aim for', { ns: 'editor' })}</FieldLabel>
              <Input id="dl-target" inputMode="decimal" value={draft.target} onChange={set('target')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="dl-discipline">{t('designLimits.discipline', 'Discipline', { ns: 'editor' })}</FieldLabel>
              <Input id="dl-discipline" value={draft.discipline} onChange={set('discipline')} placeholder={t('designLimits.any', 'Any', { ns: 'editor' })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dl-systems">{t('designLimits.systems', 'Systems', { ns: 'editor' })}</FieldLabel>
              <Input id="dl-systems" value={draft.systems} onChange={set('systems')} placeholder={t('designLimits.any', 'Any', { ns: 'editor' })} />
              <FieldDescription>{t('designLimits.systemsWhy', 'Separate with commas.', { ns: 'editor' })}</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="dl-severity">{t('designLimits.whenBroken', "When it's broken", { ns: 'editor' })}</FieldLabel>
            <Select value={draft.severity} onValueChange={(v) => setDraft((d) => ({ ...d, severity: v === 'error' || v === 'info' ? v : 'warning' }))}>
              <SelectTrigger id="dl-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['error', 'warning', 'info'] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {severityWords(s, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="dl-source">{t('designLimits.source', 'Source', { ns: 'editor' })}</FieldLabel>
            <Input
              id="dl-source"
              value={draft.source}
              onChange={set('source')}
              placeholder={t('designLimits.sourcePlaceholder', 'PermitZIP practice, design review Nov 2026', { ns: 'editor' })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dl-note">{t('designLimits.note', 'Note', { ns: 'editor' })}</FieldLabel>
            <Textarea id="dl-note" value={draft.note} onChange={set('note')} rows={2} />
          </Field>
          {problems.length > 0 && <FieldError errors={problems.map((message) => ({ message }))} />}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('designLimits.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button onClick={() => void submit()} disabled={saving} data-testid="design-limit-save">
            {saving ? t('designLimits.saving', 'Saving…', { ns: 'editor' }) : t('designLimits.save', 'Save', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
