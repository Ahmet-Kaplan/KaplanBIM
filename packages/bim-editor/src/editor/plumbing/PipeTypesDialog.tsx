'use client'

import { useMemo, useState } from 'react'
import { CircleAlert, Copy, Save, Trash2 } from 'lucide-react'
import {
  fittingFamilies,
  PIPE_MATERIALS,
  pipeProducts,
  SYSTEM_KINDS,
  pipeFamilyOf,
  serviceLabel,
  type Command,
  type FittingSlot,
  type ModelState,
  type PipeMaterial,
  type SystemKind,
} from '@permitzip/bim-kernel'
import { pipeTypeFittings, pipeTypeMismatch, pipeTypeSchema, pipeTypeSummary, type PipeTypeEntry, projectPipeTypes } from '@permitzip/bim-pack-plumbing'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'
import type { SubmitCommand } from '../views-sheets/types'
import { materialWord } from './plumbing-words'

interface Props {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly model: ModelState
  readonly editBlocked: string | null
  readonly submit: SubmitCommand
}

/** Every piped system the service registry in force sizes (water, drainage, gas, vent), grease and indirect waste included; read when asked, after the host installs its add-ons. */
function pipedKinds(): readonly SystemKind[] {
  return SYSTEM_KINDS.filter((k) => pipeFamilyOf(k) !== null)
}

interface Form {
  readonly name: string
  readonly description: string
  readonly material: PipeMaterial
  readonly spec: string
  readonly minIn: string
  readonly maxIn: string
  readonly systemKinds: readonly SystemKind[]
  readonly fittings: Partial<Record<FittingSlot, string>>
  readonly note: string
}

function formOf(t: PipeTypeEntry): Form {
  return { name: t.name, description: t.description, material: t.material, spec: t.spec ?? '', minIn: t.minIn === undefined ? '' : String(t.minIn), maxIn: t.maxIn === undefined ? '' : String(t.maxIn), systemKinds: t.systemKinds, fittings: t.fittings, note: t.note }
}

/** The record a form saves, or why it can't (the kernel's schema says what's wrong). `t` is the caller's translator: a test passes none and reads the English. */
export function pipeTypeFromForm(f: Form, t: Translate = englishOnly): PipeTypeEntry | string {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
  const parsed = pipeTypeSchema.safeParse({
    type: 'pipe_type',
    name: f.name,
    description: f.description,
    material: f.material,
    ...(f.spec ? { spec: f.spec } : {}),
    ...(num(f.minIn) !== undefined ? { minIn: num(f.minIn) } : {}),
    ...(num(f.maxIn) !== undefined ? { maxIn: num(f.maxIn) } : {}),
    systemKinds: f.systemKinds,
    fittings: f.fittings,
    note: f.note,
  })
  if (parsed.success) return parsed.data
  const i = parsed.error.issues[0]
  return i ? `${String(i.path[i.path.length - 1] ?? 'value')}: ${i.message}` : t('plumbing.somethingIsMissing', 'Something is missing.', { ns: 'editor' })
}

/** Plumbing › Pipe types: the firm's types and this project's, each with the fittings its material takes. */
export function PipeTypesDialog({ open, onOpenChange, model, editBlocked, submit }: Props) {
  const t = useEditorTranslate()
  const records = useMemo(() => projectPipeTypes(model), [model])
  const [selected, setSelected] = useState<string | null>(records[0]?.entry.name ?? null)
  const record = records.find((r) => r.entry.name === selected) ?? null
  const [form, setForm] = useState<Form | null>(record ? formOf(record.entry) : null)
  const [replaces, setReplaces] = useState<string | null>(record?.entry.name ?? null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const pick = (name: string) => {
    const r = records.find((x) => x.entry.name === name)
    if (!r) return
    setSelected(name)
    setForm(formOf(r.entry))
    setReplaces(r.saved ? r.entry.name : null)
    setError(null)
  }
  const send = (command: Command, label: string) => {
    const refusal = submit(command, label)
    setError(refusal)
    return refusal === null
  }
  const entry = form ? pipeTypeFromForm(form, t) : null
  const saveBlocked = editBlocked ?? (form && form.name.trim() === '' ? t('plumbing.giveItAName', 'Give it a name (DW-PEX).', { ns: 'editor' }) : typeof entry === 'string' ? entry : null)
  const fittingKind: SystemKind | null = typeof entry === 'string' || !entry ? null : (entry.systemKinds[0] ?? pipedKinds().find((k) => pipeTypeMismatch(entry, k) === null) ?? null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" data-testid="pipe-types-dialog">
        <DialogHeader>
          <DialogTitle>{t('plumbing.pipeTypes', 'Pipe types', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('plumbing.pipeTypesDialogWhy', 'What each pipe is made of, the sizes it comes in, and the fittings it takes. Fittings follow the material unless you pick one.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive" data-testid="pipe-types-error">
            <CircleAlert />
            <AlertTitle>{t('plumbing.notSaved', 'Not saved', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Table data-testid="pipe-types-table">
            <TableCaption className="sr-only">{t('plumbing.pipeTypes', 'Pipe types', { ns: 'editor' })}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('plumbing.type', 'Type', { ns: 'editor' })}</TableHead>
                <TableHead>{t('plumbing.material', 'Material', { ns: 'editor' })}</TableHead>
                <TableHead>{t('plumbing.from', 'From', { ns: 'editor' })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.entry.name} data-state={r.entry.name === selected ? 'selected' : undefined} className="cursor-pointer" onClick={() => pick(r.entry.name)} data-testid={`pipe-type-${r.entry.name}`}>
                  <TableCell className="font-medium">{r.entry.name}</TableCell>
                  <TableCell>{materialWord(r.entry.material, t)}</TableCell>
                  <TableCell>
                    {r.saved ? <Badge variant="secondary">{t('plumbing.thisProject', 'This project', { ns: 'editor' })}</Badge> : <Badge variant="outline">{t('plumbing.firm', 'Firm', { ns: 'editor' })}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {form && (
            <div className="flex flex-col gap-3">
              <FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="pipe-type-name">{t('plumbing.name', 'Name', { ns: 'editor' })}</FieldLabel>
                    <Input id="pipe-type-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pipe-type-name" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pipe-type-material">{t('plumbing.material', 'Material', { ns: 'editor' })}</FieldLabel>
                    <Select value={form.material} onValueChange={(v) => (PIPE_MATERIALS as readonly string[]).includes(v) && setForm({ ...form, material: v as PipeMaterial, spec: '', fittings: {} })}>
                      <SelectTrigger id="pipe-type-material" size="sm" data-testid="pipe-type-material">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPE_MATERIALS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {materialWord(m, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="pipe-type-description">{t('plumbing.description', 'Description', { ns: 'editor' })}</FieldLabel>
                  <Input id="pipe-type-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field>
                    <FieldLabel htmlFor="pipe-type-spec">{t('plumbing.productStandard', 'Product standard', { ns: 'editor' })}</FieldLabel>
                    <Select value={form.spec || 'usual'} onValueChange={(v) => setForm({ ...form, spec: v === 'usual' ? '' : v })}>
                      <SelectTrigger id="pipe-type-spec" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usual">{t('plumbing.theMaterialsUsual', 'The material’s usual', { ns: 'editor' })}</SelectItem>
                        {pipeProducts().filter((s) => s.materialId === form.material).map((s) => (
                          <SelectItem key={s.id} value={s.spec}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pipe-type-min">{t('plumbing.smallestIn', 'Smallest (in)', { ns: 'editor' })}</FieldLabel>
                    <Input id="pipe-type-min" inputMode="decimal" value={form.minIn} onChange={(e) => setForm({ ...form, minIn: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pipe-type-max">{t('plumbing.largestIn', 'Largest (in)', { ns: 'editor' })}</FieldLabel>
                    <Input id="pipe-type-max" inputMode="decimal" value={form.maxIn} onChange={(e) => setForm({ ...form, maxIn: e.target.value })} />
                  </Field>
                </div>
                <FieldSet>
                  <FieldLegend variant="label">{t('plumbing.carries', 'Carries', { ns: 'editor' })}</FieldLegend>
                  <FieldDescription>{t('plumbing.noneTicked', 'None ticked: any system the material suits.', { ns: 'editor' })}</FieldDescription>
                  <div className="grid grid-cols-2 gap-1">
                    {pipedKinds().map((k) => (
                      <Field key={k} orientation="horizontal">
                        <Checkbox id={`pipe-type-kind-${k}`} checked={form.systemKinds.includes(k)} onCheckedChange={(on) => setForm({ ...form, systemKinds: on === true ? [...form.systemKinds, k] : form.systemKinds.filter((x) => x !== k) })} />
                        <FieldLabel htmlFor={`pipe-type-kind-${k}`} className="font-normal">
                          {serviceLabel(k)}
                        </FieldLabel>
                      </Field>
                    ))}
                  </div>
                </FieldSet>
              </FieldGroup>
              {typeof entry !== 'string' && entry && fittingKind && <FittingsTable entry={entry} kind={fittingKind} onPick={(slot, family) => setForm({ ...form, fittings: family ? { ...form.fittings, [slot]: family } : Object.fromEntries(Object.entries(form.fittings).filter(([s]) => s !== slot)) })} />}
              {typeof entry !== 'string' && entry && <p className="text-xs text-muted-foreground">{pipeTypeSummary(entry)}</p>}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {record?.saved && (
                  <Button variant="ghost" disabled={editBlocked !== null} title={editBlocked ?? undefined} onClick={() => setConfirmDelete(true)} data-testid="pipe-type-delete">
                    <Trash2 />
                    {record.overridesBuiltin ? t('plumbing.backToTheFirmType', 'Back to the firm type', { ns: 'editor' }) : t('plumbing.deleteWord', 'Delete', { ns: 'editor' })}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={editBlocked !== null}
                  title={editBlocked ?? t('plumbing.aNewTypeStartingFromThisOne', 'A new type starting from this one', { ns: 'editor' })}
                  onClick={() => {
                    setForm({ ...form, name: t('plumbing.nameCopy', '{{name}} copy', { ns: 'editor', name: form.name }) })
                    setReplaces(null)
                  }}
                >
                  <Copy />
                  {t('plumbing.copy', 'Copy', { ns: 'editor' })}
                </Button>
                <Button
                  disabled={saveBlocked !== null}
                  title={saveBlocked ?? undefined}
                  onClick={() => {
                    if (typeof entry === 'string' || !entry) return
                    if (send({ type: 'save_catalog_entry', entry, ...(replaces && replaces.toUpperCase() !== entry.name.toUpperCase() ? { replaces } : {}) }, t('plumbing.savePipeTypeUndo', 'save pipe type {{name}}', { ns: 'editor', name: entry.name }))) {
                      setSelected(entry.name)
                      setReplaces(entry.name)
                    }
                  }}
                  data-testid="pipe-type-save"
                >
                  <Save />
                  {record?.saved ? t('plumbing.save', 'Save', { ns: 'editor' }) : t('plumbing.saveForThisProject', 'Save for this project', { ns: 'editor' })}
                </Button>
              </div>
              {saveBlocked && editBlocked === null && <p className="text-right text-xs text-muted-foreground">{saveBlocked}</p>}
            </div>
          )}
        </div>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {record?.overridesBuiltin
                  ? t('plumbing.goBackToTheFirmsType', "Go back to the firm's {{name}}?", { ns: 'editor', name: record.entry.name })
                  : t('plumbing.deleteThisTypeQ', 'Delete {{name}}?', { ns: 'editor', name: record?.entry.name ?? t('plumbing.thisType', 'this type', { ns: 'editor' }) })}
              </AlertDialogTitle>
              <AlertDialogDescription>{t('plumbing.thisProjectsChangesGo', 'This project’s changes to it go. You can undo this.', { ns: 'editor' })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('plumbing.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!record) return
                  if (send({ type: 'delete_catalog_entry', entryType: 'pipe_type', name: record.entry.name }, t('plumbing.deletePipeTypeUndo', 'delete pipe type {{name}}', { ns: 'editor', name: record.entry.name }))) setReplaces(null)
                }}
              >
                {record?.overridesBuiltin ? t('plumbing.goBack', 'Go back', { ns: 'editor' }) : t('plumbing.deleteWord', 'Delete', { ns: 'editor' })}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}

function FittingsTable({ entry, kind, onPick }: { entry: PipeTypeEntry; kind: SystemKind; onPick: (slot: FittingSlot, family: string | null) => void }) {
  const t = useEditorTranslate()
  const rows = pipeTypeFittings(entry, kind)
  const byMaterial = pipeTypeFittings({ ...entry, fittings: {} }, kind)
  const service = pipeFamilyOf(kind)
  const candidates = fittingFamilies().filter((f) => f.pipe && f.pipe.materials.includes(entry.material) && service !== null && f.pipe.services.includes(service))
  return (
    <Table data-testid="pipe-type-fittings">
      <TableCaption className="text-left text-xs">
        {t('plumbing.fittingsOn', 'Fittings on {{service}} in {{material}}', { ns: 'editor', service: serviceLabel(kind).toLocaleLowerCase(), material: materialWord(entry.material, t) })}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('plumbing.where', 'Where', { ns: 'editor' })}</TableHead>
          <TableHead>{t('plumbing.fitting', 'Fitting', { ns: 'editor' })}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.slot}>
            <TableCell className="text-xs">{r.label}</TableCell>
            <TableCell>
              <Select value={r.picked ? r.familyId : 'material'} onValueChange={(v) => onPick(r.slot, v === 'material' ? null : v)}>
                <SelectTrigger size="sm" aria-label={t('plumbing.fittingFor', 'Fitting for {{slot}}', { ns: 'editor', slot: r.label })} data-testid={`pipe-type-fitting-${r.slot}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">{`${byMaterial.find((x) => x.slot === r.slot)?.familyName ?? r.familyName} ${t('plumbing.followsTheMaterial', '(follows the material)', { ns: 'editor' })}`}</SelectItem>
                  {candidates.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
