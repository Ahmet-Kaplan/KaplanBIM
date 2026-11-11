'use client'

import { useState } from 'react'
import { Columns3, Plus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../ui/select'
import { Separator } from '../../ui/separator'
import { Spinner } from '../../ui/spinner'
import { newFieldUnits, type EquipmentLibrary, type NewFieldType } from './library-fields'
import type { EquipmentParameter, ParameterSource } from './parameters'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/** Where a column comes from, as the picker groups them. */
const sourceLabel = (source: ParameterSource, t: Translate): string => {
  switch (source) {
    case 'builtin':
      return t('equipmentList.sourceBuiltin', 'Built-in', { ns: 'editor' })
    case 'firm':
      return t('equipmentList.sourceFirm', 'Firm', { ns: 'editor' })
    default:
      return t('equipmentList.sourceProject', 'This project', { ns: 'editor' })
  }
}

interface Props {
  readonly library: EquipmentLibrary
  /** Parameter names the list already shows. */
  readonly shown: ReadonlySet<string>
  /** Null when this person may change the model; otherwise why not. */
  readonly editBlocked: string | null
  readonly onClose: () => void
  /** Show the column (in the Equipment list schedule and the paste grid); null when shown, else why not. */
  readonly onAdd: (parameter: EquipmentParameter) => string | null
}

/**
 * Equipment list › Add column (decision 3): show a column the library
 * already has (the baseline, the firm's, this project's), or make a new
 * column for this project. Firm columns are made in Settings › MutinyBIM
 * library by a library editor; they appear here with no code change.
 */
export function AddColumnDialog({ library, shown, editBlocked, onClose, onAdd }: Props) {
  const t = useEditorTranslate()
  const available = library.parameters.filter((p) => !shown.has(p.name))
  const [pick, setPick] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<NewFieldType>('text')
  const [unit, setUnit] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const show = (p: EquipmentParameter | undefined) => {
    if (!p) return
    const refused = onAdd(p)
    if (refused) setProblem(refused)
    else onClose()
  }

  const create = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const made = await library.addProjectField({ label, type, ...(type === 'number' ? { unit } : {}) })
      if (!made.ok) {
        setProblem(made.message)
        return
      }
      show(made.parameter)
    } finally {
      setBusy(false)
    }
  }

  const newBlocked = editBlocked ?? (library.project.allowed ? null : (library.project.reason ?? t('equipmentList.cantAddColumns', "You can't add columns to this project's library.", { ns: 'editor' })))
  const createWhy = newBlocked ?? (label.trim() === '' ? t('equipmentList.giveColumnNameFirst', 'Give the column a name first.', { ns: 'editor' }) : type === 'number' && unit === '' ? t('equipmentList.chooseUnitFirst', 'Choose the unit first.', { ns: 'editor' }) : null)
  const bySource = (['project', 'firm', 'builtin'] as const).map((s) => ({ source: s, items: available.filter((p) => p.source === s) })).filter((g) => g.items.length > 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="equipment-add-column-dialog">
        <DialogHeader>
          <DialogTitle>{t('equipmentList.addColumnTitle', 'Add a column to the equipment list', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('equipmentList.addColumnDescription', 'Columns are parameters: once added, the value shows in the list, the Inspector and tags, and a pasted sheet can fill it.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        {library.status === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Spinner data-icon="inline-start" />
            {t('equipmentList.loadingColumns', 'Loading the firm’s and this project’s columns…', { ns: 'editor' })}
          </p>
        )}
        {library.error && (
          <Alert variant="destructive" data-testid="equipment-columns-error">
            <AlertTitle>{t('equipmentList.someColumnsMissing', 'Some columns are missing', { ns: 'editor' })}</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              {library.error}
              <Button size="sm" variant="outline" onClick={library.retry}>
                {t('equipmentList.tryAgain', 'Try again', { ns: 'editor' })}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <FieldSet>
          <FieldLegend variant="label">{t('equipmentList.fromTheLibrary', 'From the library', { ns: 'editor' })}</FieldLegend>
          <FieldGroup className="gap-2">
            <Field>
              <FieldLabel htmlFor="bm-add-column-pick">{t('equipmentList.column', 'Column', { ns: 'editor' })}</FieldLabel>
              <Select value={pick || undefined} onValueChange={setPick} disabled={editBlocked !== null || available.length === 0}>
                <SelectTrigger id="bm-add-column-pick" data-testid="equipment-add-column-pick">
                  <SelectValue placeholder={available.length === 0 ? t('equipmentList.everyColumnShown', 'Every library column is already shown', { ns: 'editor' }) : t('equipmentList.chooseAColumn', 'Choose a column', { ns: 'editor' })} />
                </SelectTrigger>
                <SelectContent>
                  {bySource.map((g) => (
                    <SelectGroup key={g.source}>
                      <SelectLabel>{sourceLabel(g.source, t)}</SelectLabel>
                      {g.items.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.label}
                          {p.unit && p.unit !== '1' ? ` (${p.unit})` : ''}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t('equipmentList.firmColumnsHint', 'Firm columns are added by a library editor in Settings › MutinyBIM library.', { ns: 'editor' })}</FieldDescription>
            </Field>
            <Button size="sm" onClick={() => show(available.find((p) => p.name === pick))} disabled={editBlocked !== null || pick === ''} title={editBlocked ?? (pick === '' ? t('equipmentList.chooseColumnFirst', 'Choose a column first.', { ns: 'editor' }) : undefined)} data-testid="equipment-add-column-show">
              <Columns3 data-icon="inline-start" />
              {t('equipmentList.showThisColumn', 'Show this column', { ns: 'editor' })}
            </Button>
          </FieldGroup>
        </FieldSet>
        <Separator />
        <FieldSet>
          <FieldLegend variant="label">{t('equipmentList.newColumnForProject', 'New column for this project', { ns: 'editor' })}</FieldLegend>
          <FieldGroup className="gap-2">
            <Field>
              <FieldLabel htmlFor="bm-add-column-label">{t('equipmentList.name', 'Name', { ns: 'editor' })}</FieldLabel>
              <Input id="bm-add-column-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('equipmentList.placeholderName', 'Hood ID', { ns: 'editor' })} disabled={newBlocked !== null} data-testid="equipment-add-column-label" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field>
                <FieldLabel htmlFor="bm-add-column-type">{t('equipmentList.holds', 'Holds', { ns: 'editor' })}</FieldLabel>
                <Select value={type} onValueChange={(v) => setType(v === 'number' || v === 'yes_no' ? v : 'text')} disabled={newBlocked !== null}>
                  <SelectTrigger id="bm-add-column-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="text">{t('equipmentList.typeText', 'Text', { ns: 'editor' })}</SelectItem>
                      <SelectItem value="number">{t('equipmentList.typeNumber', 'A number', { ns: 'editor' })}</SelectItem>
                      <SelectItem value="yes_no">{t('equipmentList.typeYesNo', 'Yes or no', { ns: 'editor' })}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {type === 'number' && (
                <Field>
                  <FieldLabel htmlFor="bm-add-column-unit">{t('equipmentList.unitLabel', 'Unit', { ns: 'editor' })}</FieldLabel>
                  <Select value={unit || undefined} onValueChange={setUnit} disabled={newBlocked !== null}>
                    <SelectTrigger id="bm-add-column-unit">
                      <SelectValue placeholder={t('equipmentList.choose', 'Choose', { ns: 'editor' })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {newFieldUnits(t).map((u) => (
                          <SelectItem key={u.unit} value={u.unit}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>
            {newBlocked && (
              <FieldDescription data-testid="equipment-add-column-blocked">{newBlocked}</FieldDescription>
            )}
            <Button size="sm" variant="outline" onClick={() => void create()} disabled={createWhy !== null || busy} title={createWhy ?? undefined} data-testid="equipment-add-column-create">
              {busy ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {busy ? t('equipmentList.saving', 'Saving…', { ns: 'editor' }) : t('equipmentList.makeTheColumn', 'Make the column', { ns: 'editor' })}
            </Button>
          </FieldGroup>
        </FieldSet>
        {problem && (
          <Alert variant="destructive" data-testid="equipment-add-column-problem">
            <AlertTitle>{t('equipmentList.columnNotAdded', 'Column not added', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('equipmentList.close', 'Close', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
