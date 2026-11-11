'use client'

import { useMemo, type ReactNode } from 'react'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../ui/select'
import { keynoteChoices } from './keynotes'
import { useEditorTranslate } from '../i18n/translate'

type Props = {
  readonly value: string
  readonly onChange: (key: string) => void
}

/**
 * The Keynote tool's bar: pick a keynote from the tables in force (each add-on
 * ships one; a firm's own joins them), or type a key. The words show under it,
 * so a person sees what the key will mean in the sheet's keynote list.
 */
export function KeynotePicker({ value, onChange }: Props): ReactNode {
  const t = useEditorTranslate()
  const choices = useMemo(() => keynoteChoices(), [])
  const tables = useMemo(() => {
    const out = new Map<string, { name: string; rows: typeof choices }>()
    for (const c of choices) {
      const t = out.get(c.tableId) ?? { name: c.tableName, rows: [] }
      out.set(c.tableId, { name: t.name, rows: [...t.rows, c] })
    }
    return [...out.entries()]
  }, [choices])
  const picked = choices.find((c) => c.key === value.trim())
  return (
    <div className="pointer-events-auto absolute bottom-16 left-1/2 z-20 w-96 -translate-x-1/2 rounded-md border border-border bg-background p-3 shadow-md" data-testid="keynote-picker">
      <Field>
        <FieldLabel htmlFor="keynote-picker-key">{t('keynote.keynote', 'Keynote', { ns: 'editor' })}</FieldLabel>
        <div className="flex items-center gap-2">
          <Select value={picked ? picked.key : ''} onValueChange={onChange}>
            <SelectTrigger
              className="h-8 flex-1"
              aria-label={t('keynote.pickAKeynote', 'Pick a keynote', { ns: 'editor' })}
              data-testid="keynote-picker-select"
            >
              <SelectValue
                placeholder={
                  choices.length > 0
                    ? t('keynote.pickAKeynote', 'Pick a keynote', { ns: 'editor' })
                    : t('keynote.noTablesYet', 'No keynote tables yet', { ns: 'editor' })
                }
              />
            </SelectTrigger>
            <SelectContent>
              {tables.map(([id, t]) => (
                <SelectGroup key={id}>
                  <SelectLabel>{t.name}</SelectLabel>
                  {t.rows.map((c) => (
                    <SelectItem key={`${id}:${c.key}`} value={c.key}>
                      {c.key} · {c.text}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="keynote-picker-key"
            className="h-8 w-24"
            placeholder={t('keynote.orType', 'or type', { ns: 'editor' })}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            data-testid="keynote-picker-input"
          />
        </div>
        <FieldDescription data-testid="keynote-picker-words">
          {picked
            ? `${picked.key}: ${picked.text}`
            : value.trim()
              ? t('keynote.notInTable', '{{key}}: not in a keynote table yet; the sheet’s list will say so.', { ns: 'editor', key: value.trim() })
              : t('keynote.pickOrType', 'Pick or type a key, then click the elements it applies to.', { ns: 'editor' })}
        </FieldDescription>
      </Field>
    </div>
  )
}
