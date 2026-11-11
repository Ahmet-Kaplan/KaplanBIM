'use client'

import { useMemo, useState } from 'react'
import { CircleAlert, Pencil, Plus, Ruler, Save, SquareStack, Trash2 } from 'lucide-react'
import { PERMITZIP_DESIGN_CRITERIA, type NecEdition } from '@permitzip/bim-calc'
import { proposeFeederType, distributionEquipment, distributionOf, loadClassLabel, vaPerAmp, TEMPLATE_DEVICE_FILTERS, electricalCatalogEntrySchema, circuitTemplates, feederTypeText, feederTypes, type CircuitTemplateEntry, type ElectricalLoadEngine, type FeederTypeEntry, type TemplateDeviceFilter } from '@permitzip/bim-pack-electrical'
import { ELECTRICAL_LOAD_CLASSES, connectionTypeSummary, connectionTypes, type Command, type ConnectionTypeEntry, type ElectricalLoadClass, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import type { SubmitCommand } from '../views-sheets/types'
import { DraftingStandardTab } from './DraftingStandardTab'
import { useEditorTranslate, type Translate } from '../i18n/translate'

export type ElectricalTypesTab = 'connection' | 'feeder' | 'template' | 'drafting'

/** What a template's device filter is called — a `label(t)` accessor, not a table. */
function deviceWords(filter: TemplateDeviceFilter, t: Translate): string {
  switch (filter) {
    case 'receptacles':
      return t('electrical.deviceFilter.receptacles', 'Receptacles', { ns: 'editor' })
    case 'lighting':
      return t('electrical.deviceFilter.lighting', 'Lighting', { ns: 'editor' })
    case 'all':
      return t('electrical.deviceFilter.all', 'Everything powered', { ns: 'editor' })
  }
}

/** Text field state to a number, or null when empty / not a number. */
const numOrNull = (t: string): number | null => (t.trim() === '' || !Number.isFinite(Number(t)) ? null : Number(t))

function TextField({ id, label, value, onChange, placeholder, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className="text-xs">
        {label}
      </FieldLabel>
      <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <FieldDescription className="text-xs">{hint}</FieldDescription>}
    </Field>
  )
}

function Choice<T extends string>({ id, label, value, options, onChange }: { id: string; label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className="text-xs">
        {label}
      </FieldLabel>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

/** What saving a form would send, or why it can't: the kernel's own schema says what is wrong. */
function saveCommand(entry: unknown, replaces: string | null, t: Translate): Command | string {
  const parsed = electricalCatalogEntrySchema.safeParse(entry)
  if (!parsed.success) {
    const i = parsed.error.issues[0]
    return i ? `${String(i.path[i.path.length - 1] ?? 'value')}: ${i.message}` : t('electrical.somethingIsMissing', 'Something is missing.', { ns: 'editor' })
  }
  const name = parsed.data.type === 'connection_type' ? parsed.data.designator : parsed.data.type === 'feeder_type' ? parsed.data.mark : parsed.data.name
  return { type: 'save_catalog_entry', entry: parsed.data, ...(replaces && replaces.trim().toUpperCase() !== name.trim().toUpperCase() ? { replaces } : {}) }
}

interface CommonProps {
  readonly model: ModelState
  readonly canEdit: boolean
  readonly editBlocked: string | null
  readonly submit: SubmitCommand
}

function useSend(submit: SubmitCommand) {
  const [error, setError] = useState<string | null>(null)
  const send = (command: Command | string, label: string): boolean => {
    if (typeof command === 'string') {
      setError(command)
      return false
    }
    const refusal = submit(command, label)
    setError(refusal)
    return refusal === null
  }
  return { error, setError, send }
}

function DeleteButton({ what, onConfirm, disabled, why }: { what: string; onConfirm: () => void; disabled: boolean; why: string | null }) {
  const t = useEditorTranslate()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${what}`} title={disabled ? (why ?? undefined) : `Delete ${what}`} disabled={disabled} onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {what}?</AlertDialogTitle>
            <AlertDialogDescription>{t('electrical.itIsRefusedWhileAnythingStillNamesItYouCanUn', 'It is refused while anything still names it. You can undo this.', { ns: 'editor' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('electrical.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ------------------------------------------------------------------ connection types

const EMPTY_CT = { designator: '', description: '', connection: '', loadVa: '', voltage: '120', poles: '1', loadClass: 'other' as ElectricalLoadClass, continuous: false, motorHp: '', comments: '' }

function ConnectionTypesTab({ model, canEdit, editBlocked, submit, selectedDevices }: CommonProps & { readonly selectedDevices: readonly string[] }) {
  const t = useEditorTranslate()
  const records = useMemo(() => connectionTypes(model), [model])
  const [form, setForm] = useState(EMPTY_CT)
  const [editing, setEditing] = useState<string | null>(null)
  const { error, setError, send } = useSend(submit)
  const set = (patch: Partial<typeof EMPTY_CT>) => setForm({ ...form, ...patch })
  const entry = { type: 'connection_type', designator: form.designator, description: form.description, connection: form.connection, loadVa: numOrNull(form.loadVa) ?? 0, voltage: numOrNull(form.voltage) ?? 0, poles: Number(form.poles), loadClass: form.loadClass, continuous: form.continuous, ...(numOrNull(form.motorHp) ? { motorHp: numOrNull(form.motorHp) } : {}), comments: form.comments }
  const edit = (e: ConnectionTypeEntry) => {
    setEditing(e.designator)
    setError(null)
    setForm({ designator: e.designator, description: e.description, connection: e.connection, loadVa: String(e.loadVa), voltage: String(e.voltage), poles: String(e.poles), loadClass: e.loadClass, continuous: e.continuous, motorHp: e.motorHp ? String(e.motorHp) : '', comments: e.comments })
  }
  const saveBlocked = editBlocked ?? (form.designator.trim() === '' ? t('electrical.giveItADesignatorE05', 'Give it a designator (E.05).', { ns: 'editor' }) : null)
  return (
    <div className="flex flex-col gap-3">
      {records.length === 0 ? (
        <Empty className="border py-4">
          <EmptyHeader>
            <EmptyTitle>{t('electrical.noConnectionTypesYet', 'No connection types yet', { ns: 'editor' })}</EmptyTitle>
            <EmptyDescription>A connection type is a designator drawn beside devices (E.05) with its load, voltage, poles and class. Devices that name it take their load from it.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="max-h-56 overflow-auto rounded-md border">
          <Table data-testid="connection-types-table">
            <TableCaption className="sr-only">{t('electrical.connectionTypes', 'Connection types', { ns: 'editor' })}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Designator</TableHead>
                <TableHead>Serves</TableHead>
                <TableHead>{t('electrical.electrical', 'Electrical', { ns: 'editor' })}</TableHead>
                <TableHead>{t('electrical.class', 'Class', { ns: 'editor' })}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(({ entry: e }) => (
                <TableRow key={e.designator}>
                  <TableCell className="text-xs font-medium">{e.designator}</TableCell>
                  <TableCell className="text-xs">{e.description}</TableCell>
                  <TableCell className="text-xs">{connectionTypeSummary(e)}</TableCell>
                  <TableCell className="text-xs">{loadClassLabel(e.loadClass)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.designator}`} onClick={() => edit(e)} disabled={!canEdit} title={canEdit ? undefined : (editBlocked ?? undefined)}>
                      <Pencil />
                    </Button>
                    <DeleteButton what={`connection type ${e.designator}`} disabled={!canEdit} why={editBlocked} onConfirm={() => send({ type: 'delete_catalog_entry', entryType: 'connection_type', name: e.designator }, `delete connection type ${e.designator}`)} />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canEdit || selectedDevices.length === 0}
                      title={selectedDevices.length === 0 ? t('electrical.selectTheDevicesThatUseItFirst', 'Select the devices that use it first', { ns: 'editor' }) : (editBlocked ?? undefined)}
                      onClick={() => {
                        for (const id of selectedDevices) if (!send({ type: 'set_parameters', id, scope: 'instance', values: { connection_type: e.designator } }, `use ${e.designator}`)) return
                      }}
                    >
                      {t('electrical.useFor', 'Use for', { ns: 'editor' })} {selectedDevices.length} selected
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <FieldGroup className="grid grid-cols-4 gap-2">
        <TextField id="ct-designator" label={t('electrical.designator', 'Designator', { ns: 'editor' })} value={form.designator} placeholder="E.05" onChange={(v) => set({ designator: v })} />
        <TextField id="ct-description" label={t('electrical.serves', 'Serves', { ns: 'editor' })} value={form.description} placeholder={t('electrical.electricaltypesdialogWhy', 'Reach-in freezer', { ns: 'editor' })} onChange={(v) => set({ description: v })} />
        <TextField id="ct-connection" label="Connection" value={form.connection} placeholder={t('electrical.520RReceptacle', '5-20R receptacle', { ns: 'editor' })} onChange={(v) => set({ connection: v })} />
        <TextField id="ct-load" label={t('electrical.loadVA', 'Load (VA)', { ns: 'editor' })} value={form.loadVa} onChange={(v) => set({ loadVa: v })} />
        <TextField id="ct-voltage" label="Voltage (V)" value={form.voltage} onChange={(v) => set({ voltage: v })} />
        <Choice id="ct-poles" label="Poles" value={form.poles} options={[{ value: '1', label: t('electrical.electricaltypesdialog', '1 pole', { ns: 'editor' }) }, { value: '2', label: t('electrical.electricaltypesdialog_195', '2 poles', { ns: 'editor' }) }, { value: '3', label: t('electrical.electricaltypesdialog_195', '3-phase', { ns: 'editor' }) }]} onChange={(v) => set({ poles: v })} />
        <Choice id="ct-class" label={t('electrical.loadClassHeading', 'Load class', { ns: 'editor' })} value={form.loadClass} options={ELECTRICAL_LOAD_CLASSES.map((c) => ({ value: c, label: loadClassLabel(c) }))} onChange={(v) => set({ loadClass: v })} />
        <TextField id="ct-hp" label="Motor (hp)" value={form.motorHp} hint="For a motor with no VA: from the code's tables" onChange={(v) => set({ motorHp: v })} />
        <Field orientation="horizontal" className="col-span-2 items-center">
          <Checkbox id="ct-continuous" checked={form.continuous} onCheckedChange={(v) => set({ continuous: v === true })} aria-label={t('electrical.continuousLoad', 'Continuous load', { ns: 'editor' })} />
          <FieldLabel htmlFor="ct-continuous" className="text-xs font-normal">
            {t('electrical.continuous3HoursOrMore', 'Continuous (3 hours or more)', { ns: 'editor' })}
          </FieldLabel>
        </Field>
        <div className="col-span-2 flex justify-end gap-2 self-end">
          {editing && (
            <Button variant="ghost" size="sm" onClick={() => (setEditing(null), setForm(EMPTY_CT))}>
              {t('electrical.newInstead', 'New instead', { ns: 'editor' })}
            </Button>
          )}
          <Button size="sm" disabled={saveBlocked !== null} title={saveBlocked ?? undefined} data-testid="ct-save" onClick={() => send(saveCommand(entry, editing, t), t('electrical.undo.saveConnectionTypeNamed', 'save connection type {{name}}', { ns: 'editor', name: form.designator })) && (setEditing(null), setForm(EMPTY_CT))}>
            <Save data-icon="inline-start" />
            {editing ? `Save ${editing}` : t('electrical.addConnectionType', 'Add connection type', { ns: 'editor' })}
          </Button>
        </div>
      </FieldGroup>
      {error && (
        <FieldDescription className="text-danger-600" role="alert">
          {error}
        </FieldDescription>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ feeder types

const EMPTY_FT = { mark: '', ratingA: '', poles: '3', sets: '1', phaseSize: '', neutralSize: '', groundSize: '', material: 'cu' as 'cu' | 'al', insulation: 'THHN', conduitType: 'emt', conduitSize: '', description: '' }

function formFromFeeder(e: FeederTypeEntry): typeof EMPTY_FT {
  return { mark: e.mark, ratingA: String(e.ratingA), poles: String(e.poles), sets: String(e.conductors.sets), phaseSize: e.conductors.phaseSize, neutralSize: e.conductors.neutralSize ?? '', groundSize: e.conductors.groundSize ?? '', material: e.conductors.material, insulation: e.insulation, conduitType: e.conduit?.type ?? 'emt', conduitSize: e.conduit?.tradeSize ?? '', description: e.description }
}

function FeederTypesTab({ model, canEdit, editBlocked, submit, engine, edition }: CommonProps & { readonly engine: ElectricalLoadEngine; readonly edition: NecEdition | null }) {
  const t = useEditorTranslate()
  const records = useMemo(() => feederTypes(model), [model])
  const panels = useMemo(() => distributionEquipment(model.elements), [model])
  const [form, setForm] = useState(EMPTY_FT)
  const [basis, setBasis] = useState<FeederTypeEntry['basis']>(undefined)
  const [editing, setEditing] = useState<string | null>(null)
  const [sizeFor, setSizeFor] = useState('')
  const [lengthFt, setLengthFt] = useState('')
  const [sizing, setSizing] = useState<string | null>(null)
  const { error, setError, send } = useSend(submit)
  const set = (patch: Partial<typeof EMPTY_FT>) => setForm({ ...form, ...patch })
  const entry = {
    type: 'feeder_type',
    mark: form.mark,
    ratingA: numOrNull(form.ratingA) ?? 0,
    poles: Number(form.poles),
    conductors: { sets: numOrNull(form.sets) ?? 1, phaseSize: form.phaseSize, ...(form.neutralSize.trim() ? { neutralSize: form.neutralSize } : {}), ...(form.groundSize.trim() ? { groundSize: form.groundSize } : {}), material: form.material },
    insulation: form.insulation,
    conduit: form.conduitSize.trim() ? { type: form.conduitType, tradeSize: form.conduitSize } : null,
    conduitBelowGrade: null,
    description: form.description,
    ...(basis ? { basis } : {}),
  }
  const sizeBlocked = !edition ? t('electrical.chooseTheNECEditionFirstInThePanelViewOrReco', 'Choose the NEC edition first (in the panel view, or record it in the Code Study).', { ns: 'editor' }) : sizeFor === '' ? t('electrical.chooseThePanelTheFeederServes', 'Choose the panel the feeder serves.', { ns: 'editor' }) : null
  const sizeIt = () => {
    const part = model.elements[sizeFor]
    const info = part?.kind === 'part' ? distributionOf(model.elements, part) : null
    const report = engine.report(model, sizeFor)
    if (!edition || !info || !report) return
    const per = vaPerAmp(info.supply)
    const s = proposeFeederType(edition, PERMITZIP_DESIGN_CRITERIA, { system: info.supply, continuousA: report.demand.continuousVa / per, noncontinuousA: Math.max(0, report.demand.demandVa - report.demand.continuousVa) / per, ...(numOrNull(lengthFt) ? { lengthFt: numOrNull(lengthFt) as number } : {}) })
    if (!s.entry) return setSizing(s.refusal)
    setSizing(`For ${info.name}: ${feederTypeText(s.entry)}. ${s.entry.description}.`)
    setForm(formFromFeeder(s.entry))
    setBasis(s.entry.basis)
    setEditing(null)
  }
  const saveBlocked = editBlocked ?? (form.mark.trim() === '' ? 'Give it a mark (F225).' : form.phaseSize.trim() === '' ? 'Give the phase conductor size (4/0), or size it from a panel.' : null)
  return (
    <div className="flex flex-col gap-3">
      {records.length > 0 && (
        <div className="max-h-48 overflow-auto rounded-md border">
          <Table data-testid="feeder-types-table">
            <TableCaption className="sr-only">{t('electrical.feederTypes', 'Feeder types', { ns: 'editor' })}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Mark</TableHead>
                <TableHead>{t('electrical.breakerConductorsAndConduit', 'Breaker, conductors and conduit', { ns: 'editor' })}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(({ entry: e }) => (
                <TableRow key={e.mark}>
                  <TableCell className="text-xs font-medium">{e.mark}</TableCell>
                  <TableCell className="text-xs">{feederTypeText(e)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.mark}`} disabled={!canEdit} title={canEdit ? undefined : (editBlocked ?? undefined)} onClick={() => (setEditing(e.mark), setForm(formFromFeeder(e)), setBasis(e.basis), setError(null))}>
                      <Pencil />
                    </Button>
                    <DeleteButton what={`feeder type ${e.mark}`} disabled={!canEdit} why={editBlocked} onConfirm={() => send({ type: 'delete_catalog_entry', entryType: 'feeder_type', name: e.mark }, `delete feeder type ${e.mark}`)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex items-end gap-2 rounded-md border p-2">
        <Field className="w-48">
          <FieldLabel htmlFor="ft-size-for" className="text-xs">
            Size from a panel&apos;s load
          </FieldLabel>
          <Select value={sizeFor} onValueChange={setSizeFor}>
            <SelectTrigger id="ft-size-for" size="sm" data-testid="ft-size-for">
              <SelectValue placeholder={t('electrical.panelItFeeds', 'Panel it feeds', { ns: 'editor' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {panels.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <TextField id="ft-length" label={t('electrical.lengthFt', 'Length (ft)', { ns: 'editor' })} value={lengthFt} onChange={setLengthFt} />
        <Button size="sm" variant="outline" disabled={sizeBlocked !== null} title={sizeBlocked ?? undefined} onClick={sizeIt} data-testid="ft-size-it">
          <Ruler data-icon="inline-start" />
          {t('electrical.sizeIt', 'Size it', { ns: 'editor' })}
        </Button>
      </div>
      {sizing && <FieldDescription data-testid="ft-sizing">{sizing}</FieldDescription>}
      <FieldGroup className="grid grid-cols-4 gap-2">
        <TextField id="ft-mark" label={t('electrical.mark', 'Mark', { ns: 'editor' })} value={form.mark} placeholder="F225" onChange={(v) => set({ mark: v })} />
        <TextField id="ft-rating" label="Breaker (A)" value={form.ratingA} onChange={(v) => set({ ratingA: v })} />
        <Choice id="ft-poles" label="Poles" value={form.poles} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]} onChange={(v) => set({ poles: v })} />
        <TextField id="ft-sets" label={t('electrical.parallelSets', 'Parallel sets', { ns: 'editor' })} value={form.sets} onChange={(v) => set({ sets: v })} />
        <TextField id="ft-phase" label={t('electrical.phaseSize', 'Phase size', { ns: 'editor' })} value={form.phaseSize} placeholder="4/0" onChange={(v) => set({ phaseSize: v })} />
        <TextField id="ft-neutral" label={t('electrical.neutralSize', 'Neutral size', { ns: 'editor' })} value={form.neutralSize} placeholder="none" onChange={(v) => set({ neutralSize: v })} />
        <TextField id="ft-ground" label={t('electrical.groundSize', 'Ground size', { ns: 'editor' })} value={form.groundSize} placeholder="4" onChange={(v) => set({ groundSize: v })} />
        <Choice id="ft-material" label="Material" value={form.material} options={[{ value: 'cu', label: t('electrical.electricaltypesdialog_336', 'Copper', { ns: 'editor' }) }, { value: 'al', label: t('electrical.electricaltypesdialog_336', 'Aluminum', { ns: 'editor' }) }]} onChange={(v) => set({ material: v })} />
        <TextField id="ft-insulation" label="Insulation" value={form.insulation} onChange={(v) => set({ insulation: v })} />
        <Choice id="ft-conduit-type" label="Conduit" value={form.conduitType} options={[{ value: 'emt', label: 'EMT' }, { value: 'pvc40', label: t('electrical.electricaltypesdialog_338', 'PVC Sch 40', { ns: 'editor' }) }, { value: 'pvc80', label: t('electrical.electricaltypesdialog_338', 'PVC Sch 80', { ns: 'editor' }) }]} onChange={(v) => set({ conduitType: v })} />
        <TextField id="ft-conduit-size" label={t('electrical.tradeSizeIn', 'Trade size (in)', { ns: 'editor' })} value={form.conduitSize} placeholder="2-1/2" onChange={(v) => set({ conduitSize: v })} />
        <div className="flex justify-end gap-2 self-end">
          <Button size="sm" disabled={saveBlocked !== null} title={saveBlocked ?? undefined} data-testid="ft-save" onClick={() => send(saveCommand(entry, editing, t), t('electrical.undo.saveFeederTypeNamed', 'save feeder type {{name}}', { ns: 'editor', name: form.mark })) && (setEditing(null), setForm(EMPTY_FT), setBasis(undefined))}>
            <Save data-icon="inline-start" />
            {editing ? `Save ${editing}` : t('electrical.addFeederType', 'Add feeder type', { ns: 'editor' })}
          </Button>
        </div>
      </FieldGroup>
      {error && (
        <FieldDescription className="text-danger-600" role="alert">
          {error}
        </FieldDescription>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ room templates

interface RuleRow {
  room: string
  devices: TemplateDeviceFilter
  circuit: string
  description: string
}

const EMPTY_RULE: RuleRow = { room: '', devices: 'receptacles', circuit: '', description: '' }

function TemplatesTab({ model, canEdit, editBlocked, submit, onApply }: CommonProps & { readonly onApply: (name: string) => void }) {
  const t = useEditorTranslate()
  const records = useMemo(() => circuitTemplates(model), [model])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState<RuleRow[]>([{ ...EMPTY_RULE, room: t('electrical.bedroom', 'Bedroom', { ns: 'editor' }), circuit: '1' }, { ...EMPTY_RULE, room: 'Living', circuit: '3' }])
  const [editing, setEditing] = useState<string | null>(null)
  const { error, setError, send } = useSend(submit)
  const entry = {
    type: 'circuit_template',
    name,
    description,
    rules: rules.filter((r) => r.room.trim() !== '').map((r) => ({ room: r.room, devices: r.devices, ...(numOrNull(r.circuit) ? { circuit: numOrNull(r.circuit) } : {}), ...(r.description.trim() ? { description: r.description } : {}) })),
  }
  const load = (e: CircuitTemplateEntry) => {
    setEditing(e.name)
    setError(null)
    setName(e.name)
    setDescription(e.description)
    setRules(e.rules.map((r) => ({ room: r.room, devices: r.devices, circuit: r.circuit ? String(r.circuit) : '', description: r.description ?? '' })))
  }
  const setRule = (i: number, patch: Partial<RuleRow>) => setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const saveBlocked = editBlocked ?? (name.trim() === '' ? t('electrical.giveTheTemplateAName', 'Give the template a name.', { ns: 'editor' }) : entry.rules.length === 0 ? t('electrical.addAtLeastOneRoomRule', 'Add at least one room rule.', { ns: 'editor' }) : null)
  return (
    <div className="flex flex-col gap-3">
      <FieldDescription>{t('electrical.yourFirmAposSConventionTheFirstRuleThatMatch', "Your firm's convention: the first rule that matches a room's name wins, top to bottom. Applying it circuits the devices inside the rooms you choose, on the panel you name for each unit.", { ns: 'editor' })}</FieldDescription>
      {records.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="templates-list">
          {records.map(({ entry: e }) => (
            <div key={e.name} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
              <span className="font-medium">{e.name}</span>
              <span className="text-muted-foreground">({e.rules.length} rules)</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.name}`} disabled={!canEdit} title={canEdit ? undefined : (editBlocked ?? undefined)} onClick={() => load(e)}>
                <Pencil />
              </Button>
              <DeleteButton what={`room template ${e.name}`} disabled={!canEdit} why={editBlocked} onConfirm={() => send({ type: 'delete_catalog_entry', entryType: 'circuit_template', name: e.name }, `delete room template ${e.name}`)} />
              <Button variant="outline" size="sm" onClick={() => onApply(e.name)} disabled={!canEdit} title={canEdit ? undefined : (editBlocked ?? undefined)} data-testid="template-apply">
                <SquareStack data-icon="inline-start" />
                {t('electrical.applyToUnits', 'Apply to units', { ns: 'editor' })}
              </Button>
            </div>
          ))}
        </div>
      )}
      <FieldGroup className="grid grid-cols-2 gap-2">
        <TextField id="tpl-name" label={t('electrical.templateName', 'Template name', { ns: 'editor' })} value={name} placeholder={t('electrical.twoBedroomUnit', 'Two-bedroom unit', { ns: 'editor' })} onChange={setName} />
        <TextField id="tpl-description" label="Description" value={description} onChange={setDescription} />
      </FieldGroup>
      <div className="flex flex-col gap-1" data-testid="template-rules">
        {rules.map((r, i) => (
          <div key={i} className="grid grid-cols-[2fr_1.5fr_1fr_2fr_auto] items-end gap-2">
            <TextField id={`tpl-room-${i}`} label={i === 0 ? t('electrical.roomNameHas', 'Room name has', { ns: 'editor' }) : ''} value={r.room} placeholder="Bedroom" onChange={(v) => setRule(i, { room: v })} />
            <Choice id={`tpl-devices-${i}`} label={i === 0 ? 'Devices' : ''} value={r.devices} options={TEMPLATE_DEVICE_FILTERS.map((d) => ({ value: d, label: deviceWords(d, t) }))} onChange={(v) => setRule(i, { devices: v })} />
            <TextField id={`tpl-circuit-${i}`} label={i === 0 ? 'Circuit' : ''} value={r.circuit} placeholder="next" onChange={(v) => setRule(i, { circuit: v })} />
            <TextField id={`tpl-desc-${i}`} label={i === 0 ? 'Description' : ''} value={r.description} placeholder={t('electrical.electricaltypesdialogWhy_420', 'Bedroom receptacles', { ns: 'editor' })} onChange={(v) => setRule(i, { description: v })} />
            <Button variant="ghost" size="icon-sm" aria-label={`Remove rule ${i + 1}`} onClick={() => setRules(rules.filter((_, k) => k !== i))} disabled={rules.length === 1} title={rules.length === 1 ? t('electrical.aTemplateNeedsAtLeastOneRule', 'A template needs at least one rule', { ns: 'editor' }) : undefined}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => setRules([...rules, { ...EMPTY_RULE }])}>
            <Plus data-icon="inline-start" />
            {t('electrical.addARoomRule', 'Add a room rule', { ns: 'editor' })}
          </Button>
          <Button size="sm" disabled={saveBlocked !== null} title={saveBlocked ?? undefined} data-testid="tpl-save" onClick={() => send(saveCommand(entry, editing, t), t('electrical.undo.saveRoomTemplateNamed', 'save room template {{name}}', { ns: 'editor', name })) && setEditing(null)}>
            <Save data-icon="inline-start" />
            {editing ? `Save ${editing}` : t('electrical.saveTemplate', 'Save template', { ns: 'editor' })}
          </Button>
        </div>
      </div>
      {error && (
        <FieldDescription className="text-danger-600" role="alert">
          {error}
        </FieldDescription>
      )}
    </div>
  )
}

/**
 * Electrical › Electrical types: the project's connection types, feeder types
 * and room templates. Everything here is model data (it syncs and undoes
 * like any edit) and is what devices, feeders and the room-template action
 * refer to by name. Esc closes; nothing is saved until a Save button.
 */
export function ElectricalTypesDialog({
  model,
  engine,
  edition,
  canEdit,
  editBlocked,
  submit,
  initialTab,
  selectedDevices,
  onApplyTemplate,
  onClose,
}: CommonProps & {
  readonly engine: ElectricalLoadEngine
  readonly edition: NecEdition | null
  readonly initialTab: ElectricalTypesTab
  readonly selectedDevices: readonly string[]
  readonly onApplyTemplate: (name: string) => void
  readonly onClose: () => void
}) {
  const t = useEditorTranslate()
  const [tab, setTab] = useState<ElectricalTypesTab>(initialTab)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl" data-testid="electrical-types-dialog">
        <DialogHeader>
          <DialogTitle>{t('electrical.electricalTypes', 'Electrical types', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('electrical.recordsTheModelRefersToByNameConnectionTypes', 'Records the model refers to by name: connection types on devices, feeder types on feeders, room templates for circuiting units, and how plans label repeated typicals.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        {!canEdit && editBlocked && (
          <Alert>
            <CircleAlert />
            <AlertTitle>{t('electrical.readOnly', 'Read only', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{editBlocked}</AlertDescription>
          </Alert>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(v as ElectricalTypesTab)}>
          <TabsList>
            <TabsTrigger value="connection">Connection types</TabsTrigger>
            <TabsTrigger value="feeder">Feeder types</TabsTrigger>
            <TabsTrigger value="template">{t('electrical.roomTemplates', 'Room templates', { ns: 'editor' })}</TabsTrigger>
            <TabsTrigger value="drafting">{t('electrical.drafting', 'Drafting', { ns: 'editor' })}</TabsTrigger>
          </TabsList>
          <TabsContent value="connection">
            <ConnectionTypesTab model={model} canEdit={canEdit} editBlocked={editBlocked} submit={submit} selectedDevices={selectedDevices} />
          </TabsContent>
          <TabsContent value="feeder">
            <FeederTypesTab model={model} canEdit={canEdit} editBlocked={editBlocked} submit={submit} engine={engine} edition={edition} />
          </TabsContent>
          <TabsContent value="template">
            <TemplatesTab model={model} canEdit={canEdit} editBlocked={editBlocked} submit={submit} onApply={onApplyTemplate} />
          </TabsContent>
          <TabsContent value="drafting">
            <DraftingStandardTab model={model} canEdit={canEdit} editBlocked={editBlocked} submit={submit} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

