'use client'

import { useMemo, useState, type ChangeEvent } from 'react'
import { Cable, CircleAlert, ClipboardList, Columns3, ListPlus, Plus, TableProperties, Trash2 } from 'lucide-react'
import type { NecEdition } from '@permitzip/bim-calc'
import type { ModelState } from '@permitzip/bim-kernel'
import { withEquipmentColumn } from '@permitzip/bim-library'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { Textarea } from '../../ui/textarea'
import type { SubmitCommand } from '../views-sheets/types'
import { newId } from '../views-sheets/types'
import { CircuitPlannedDialog, type CircuitRules } from '../planned/CircuitPlannedDialog'
import { checkDraft, draftFieldLabel, DRAFT_FIELDS, pastedColumns, plannedEquipmentBatch, proposedLoads, readDraft, unitMarks, withPastedExtras, type DraftField, type EquipmentDraftRow, type PastedColumn } from './plan-equipment'
import { ProposedLoadsPanel } from './ProposedLoadsPanel'
import { AddColumnDialog } from './AddColumnDialog'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { useEquipmentLibraryFrom, type EquipmentLibrary } from './library-fields'
import type { EquipmentParameter } from './parameters'
import { findBuiltinListView } from '../schedules/builtin-lists'
import { useWindowedRows, windowSlice } from '../use-windowed-rows'
import { useEditorTranslate, type Translate } from '../i18n/translate'

export type EquipmentListTrade = 'electrical' | 'mechanical' | 'plumbing'

/** What the paste box is for, per trade: the sheet this person most likely has in hand. */
const tradeWords = (trade: EquipmentListTrade, t: Translate): string => {
  switch (trade) {
    case 'electrical':
      return t('equipmentList.tradeElectrical', 'Paste the kitchen vendor’s or mechanical schedule: each row becomes planned equipment with its load, ready to circuit before anyone draws it.', { ns: 'editor' })
    case 'mechanical':
      return t('equipmentList.tradeMechanical', 'Paste the rooftop unit and equipment schedule: each row becomes planned equipment with its electrical and gas values.', { ns: 'editor' })
    default:
      return t('equipmentList.tradePlumbing', 'Paste the fixture or kitchen schedule: each row becomes a planned fixture or item with its water, waste and gas connections.', { ns: 'editor' })
  }
}

const EXAMPLE = 'Mark\tDescription\tQty\tVolts\tPhase\tkW\tGas MBH\tCW\tHW\tW\nK-14\tFryer, gas\t2\t120\t1\t0.5\t80\t\t\t\nK-18\tDishwasher, door type\t1\t208\t3\t15\t\t1/2\t3/4\t2'

/** Narrow inputs for numbers, wide for words. */
const WIDTH: Readonly<Record<DraftField, string>> = {
  mark: 'w-20',
  description: 'w-52',
  quantity: 'w-14',
  voltage: 'w-16',
  phase: 'w-12',
  load: 'w-28',
  gasMbh: 'w-16',
  coldWater: 'w-16',
  hotWater: 'w-16',
  waste: 'w-16',
  connection: 'w-32',
}

interface Props {
  readonly model: ModelState | null
  /** The project's NEC edition; null reads kW, VA and amps but not horsepower. */
  readonly necEdition: NecEdition | null
  readonly trade: EquipmentListTrade
  /** Null when this person may add to the model; otherwise why not, in words. */
  readonly editBlocked: string | null
  readonly submit: SubmitCommand
  readonly onClose: () => void
  /** After the list lands: the planned parts' ids (the surface opens Not placed yet on them). */
  readonly onAdded: (partIds: readonly string[]) => void
  /** Open the model's Equipment list schedule (made the first time). */
  readonly onOpenSchedule?: () => void
  /** The project's code rules, so Put them on circuits sizes breakers by the NEC edition; absent: default breakers. */
  readonly circuitRules?: CircuitRules | null
  /** The project whose library adds firm and project columns; absent: the built-in columns only. */
  readonly projectId?: string | null
  /** The columns' library, when the host already holds one (tests, a shared hook). Absent: read for `projectId`. */
  readonly library?: EquipmentLibrary
  /** Columns the installed add-ons work out from each row (Heat gain), after Reads as. */
  readonly computedColumns?: readonly ComputedEquipmentColumn[]
}

const NOT_USED = '__not_used__'

/** A read-only column an add-on works out from a pasted row (its mark and description); null leaves the cell empty. */
export interface ComputedEquipmentColumn {
  readonly id: string
  readonly label: string
  readonly cell: (row: { readonly mark: string; readonly description: string }) => { readonly text: string; readonly title: string } | null
}

/**
 * Building Model › Electrical (or Mechanical, Plumbing) › Equipment list:
 * paste a schedule (text copied from a PDF table, a spreadsheet, or a CSV),
 * correct the rows in the preview grid, then Add as planned equipment. Each
 * row says in plain words what is wrong with it; Add stays off until none is.
 */
/** Estimated height of one pasted equipment row (one line of inputs), px. */
const EQUIPMENT_ROW_PX = 40

export function EquipmentListDialog({ model, necEdition, trade, editBlocked, submit, onClose, onAdded, onOpenSchedule, circuitRules, projectId, library: given, computedColumns = [] }: Props) {
  const t = useEditorTranslate()
  const readLibrary = useEquipmentLibraryFrom(useEditorHost().data.firmLibrary, given ? null : projectId)
  const library = given ?? readLibrary
  const parameters = library.parameters
  const [pasted, setPasted] = useState('')
  const [rows, setRows] = useState<EquipmentDraftRow[]>([])
  /** Pasted headings beyond the eleven, and columns added by hand (index -1), with the parameter each fills. */
  const [columns, setColumns] = useState<PastedColumn[]>([])
  const [addingColumn, setAddingColumn] = useState(false)
  const windowRows = useWindowedRows(rows.length, EQUIPMENT_ROW_PX)
  const [fileError, setFileError] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [added, setAdded] = useState(0)
  const [addedLoads, setAddedLoads] = useState(0)
  const [addedIds, setAddedIds] = useState<readonly string[]>([])
  const [circuiting, setCircuiting] = useState(false)
  /** The items just added that carry an electrical load (circuit them before anyone draws them). */
  const withLoad = useMemo(() => addedIds.filter((id) => {
    const el = model?.elements[id]
    return el?.kind === 'part' && typeof el.values.load_va === 'number' && el.values.load_va > 0 && Object.keys(el.served ?? {}).length === 0
  }), [addedIds, model])

  const checks = useMemo(() => checkDraft(necEdition, model, rows, parameters, t), [necEdition, model, rows, parameters, t])
  const extraColumns = columns.flatMap((c) => {
    const p = c.parameter === null ? undefined : parameters.find((x) => x.name === c.parameter)
    return p ? [{ column: c, parameter: p }] : []
  })
  const problemRows = checks.filter((c) => c.problems.length > 0).length
  const items = checks.reduce((n, c) => n + c.quantity, 0)
  /** Plumbing and gas loads the rows propose; each is added unless the engineer unticks it. */
  const proposals = useMemo(() => proposedLoads(rows, checks), [rows, checks])
  const [declined, setDeclined] = useState<ReadonlySet<string>>(new Set())
  const accepted = proposals.filter((p) => !declined.has(p.key))
  const loadCount = accepted.reduce((n, p) => n + p.quantity, 0)
  const toggleLoad = (key: string, accept: boolean) =>
    setDeclined((d) => {
      const next = new Set(d)
      if (accept) next.delete(key)
      else next.add(key)
      return next
    })

  const read = (text: string) => {
    setPasted(text)
    setRefusal(null)
    const found = pastedColumns(necEdition, text, parameters)
    const byHand = columns.filter((c) => c.index < 0)
    setColumns([...found, ...byHand])
    setRows(withPastedExtras(readDraft(necEdition, text), text, found))
  }

  /**
   * A pasted heading's parameter changed: the pasted rows are read again
   * under the new mapping (a column set to Not used goes back into the
   * description); rows added by hand stay.
   */
  const remap = (index: number, parameter: string | null) => {
    const next = columns.map((c) => (c.index === index ? { ...c, parameter } : c))
    setColumns(next)
    setRows((rs) => [...withPastedExtras(readDraft(necEdition, pasted), pasted, next), ...rs.filter((r) => !r.key.startsWith('line-'))])
  }

  const editExtra = (key: string, name: string, value: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, extras: { ...r.extras, [name]: value } } : r)))

  /** Add column: the paste grid gains it, and the model's Equipment list schedule shows it. */
  const addColumn = (p: EquipmentParameter): string | null => {
    if (!columns.some((c) => c.parameter === p.name)) setColumns((cs) => [...cs, { index: -1 - cs.length, heading: p.label, parameter: p.name, alsoRead: false }])
    const viewId = findBuiltinListView(model, 'equipment_list')
    const view = viewId ? model?.elements[viewId] : undefined
    const def = view?.kind === 'view' ? view.props?.scheduleV2 : undefined
    if (!viewId || !def) return null
    const next = withEquipmentColumn(def, { name: p.name, label: p.label, key: p.key, ...(p.group === undefined ? {} : { group: p.group }) })
    if (!next) return null
    return submit({ type: 'set_view_properties', viewId, props: { scheduleV2: next } }, t('equipmentList.undoAddColumn', 'add the {{column}} column to the Equipment list', { ns: 'editor', column: p.label }))
  }
  const shownNames = new Set<string>([...DRAFT_FIELDS, 'description', 'voltage', 'phases', 'load_va', 'load_class', 'circuit', 'input_mbh', 'cw_size', 'hw_size', 'waste_size', 'connection', ...columns.flatMap((c) => (c.parameter ? [c.parameter] : []))])
  const addColumnBlocked = editBlocked ?? (!model ? t('equipmentList.modelStillLoading', 'The model is still loading.', { ns: 'editor' }) : null)

  const openFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    file
      .text()
      .then(read)
      .catch((err: unknown) => {
        console.error('[EquipmentListDialog] reading the file failed', { name: file.name, err })
        setFileError(t('equipmentList.couldntReadFile', "Couldn't read {{file}}: {{error}}", { ns: 'editor', file: file.name, error: err instanceof Error ? err.message : String(err) }))
      })
  }

  const edit = (key: string, field: DraftField, value: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key))
  const addRow = () => setRows((rs) => [...rs, { key: `new-${Date.now()}-${rs.length}`, mark: '', description: '', quantity: '1', voltage: '', phase: '', load: '', gasMbh: '', coldWater: '', hotWater: '', waste: '', connection: '' }])

  const why =
    editBlocked ??
    (!model
      ? t('equipmentList.modelStillLoading', 'The model is still loading.', { ns: 'editor' })
      : rows.length === 0
        ? t('equipmentList.pasteFirst', 'Paste a list first.', { ns: 'editor' })
        : problemRows > 0
          ? problemRows === 1
            ? t('equipmentList.fixOneRow', 'Fix the row marked in red first.', { ns: 'editor' })
            : t('equipmentList.fixRows', 'Fix the {{count}} rows marked in red first.', { ns: 'editor', count: problemRows })
          : null)

  const add = () => {
    if (why || !model) return
    const batch = plannedEquipmentBatch(model, rows, checks, newId, accepted, parameters, t)
    if ('refused' in batch) {
      setRefusal(batch.refused)
      return
    }
    const loads = loadCount === 0 ? '' : loadCount === 1 ? t('equipmentList.undoLoadsOne', ' and 1 plumbing and gas load', { ns: 'editor' }) : t('equipmentList.undoLoads', ' and {{count}} plumbing and gas loads', { ns: 'editor', count: loadCount })
    const label = batch.count === 1 ? t('equipmentList.undoAddPlannedOne', 'add 1 planned item{{loads}}', { ns: 'editor', loads }) : t('equipmentList.undoAddPlanned', 'add {{count}} planned items{{loads}}', { ns: 'editor', count: batch.count, loads })
    const refused = submit(batch.command, label)
    if (refused) {
      setRefusal(refused)
      return
    }
    setAdded(batch.count)
    setAddedLoads(loadCount)
    setAddedIds(batch.partIds)
    onAdded(batch.partIds)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl" data-testid="equipment-list-dialog">
        <DialogHeader>
          <DialogTitle>{t('equipmentList.title', 'Equipment list', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('equipmentList.description', '{{trade}} You can correct any cell. Nothing changes in the model until you add them, and you can undo it.', { ns: 'editor', trade: tradeWords(trade, t) })}</DialogDescription>
        </DialogHeader>
        {editBlocked && (
          <Alert data-testid="equipment-list-denied">
            <CircleAlert />
            <AlertTitle>{t('equipmentList.readOnlyTitle', 'You can read this list but not add it', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{editBlocked}</AlertDescription>
          </Alert>
        )}
        {added > 0 ? (
          <Alert data-testid="equipment-list-added">
            <ListPlus />
            <AlertTitle>
              {[
                added === 1 ? t('equipmentList.addedOne', 'Added 1 planned item', { ns: 'editor' }) : t('equipmentList.added', 'Added {{count}} planned items', { ns: 'editor', count: added }),
                addedLoads === 0 ? '' : addedLoads === 1 ? t('equipmentList.loadsSuffixOne', ' and 1 plumbing and gas load', { ns: 'editor' }) : t('equipmentList.loadsSuffix', ' and {{count}} plumbing and gas loads', { ns: 'editor', count: addedLoads }),
              ].join('')}
            </AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              {t('equipmentList.addedHint', 'They are in Not placed yet and in the Equipment list schedule. Circuit them now, or place them on a plan when you know where they go.', { ns: 'editor' })}
              {withLoad.length > 0 && (
                <Button size="sm" onClick={() => setCircuiting(true)} disabled={editBlocked !== null} title={editBlocked ?? undefined} data-testid="equipment-list-circuit">
                  <Cable data-icon="inline-start" />
                  {withLoad.length === 1 ? t('equipmentList.putItOnCircuits', 'Put it on circuits', { ns: 'editor' }) : t('equipmentList.putThemOnCircuits', 'Put the {{count}} with a load on circuits', { ns: 'editor', count: withLoad.length })}
                </Button>
              )}
              {onOpenSchedule && (
                <Button size="sm" variant="outline" onClick={onOpenSchedule} data-testid="equipment-list-open-schedule">
                  <TableProperties data-icon="inline-start" />
                  {t('equipmentList.openSchedule', 'Open the Equipment list schedule', { ns: 'editor' })}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Field className="min-w-72 flex-[2]">
                <FieldLabel htmlFor="bm-equipment-paste">{t('equipmentList.pasteTheSchedule', 'Paste the schedule', { ns: 'editor' })}</FieldLabel>
                <Textarea id="bm-equipment-paste" rows={4} value={pasted} onChange={(e) => read(e.target.value)} placeholder={EXAMPLE} data-testid="equipment-list-paste" />
                <FieldDescription>{t('equipmentList.pasteHint', 'Copy the table out of the PDF or spreadsheet, header row included, and paste it here.', { ns: 'editor' })}</FieldDescription>
              </Field>
              <Field className="min-w-56 flex-1">
                <FieldLabel htmlFor="bm-equipment-file">{t('equipmentList.openFile', 'Or open a CSV or text file', { ns: 'editor' })}</FieldLabel>
                <Input id="bm-equipment-file" type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" onChange={openFile} data-testid="equipment-list-file" />
                {fileError && (
                  <FieldDescription className="text-danger-600" role="alert">
                    {fileError}
                  </FieldDescription>
                )}
              </Field>
              <Button variant="outline" onClick={() => setAddingColumn(true)} disabled={addColumnBlocked !== null} title={addColumnBlocked ?? t('equipmentList.addColumnHint', 'Show another parameter as a column: MCA, Hood ID, or a new one for this project', { ns: 'editor' })} data-testid="equipment-list-add-column">
                <Columns3 data-icon="inline-start" />
                {t('equipmentList.addColumn', 'Add column', { ns: 'editor' })}
              </Button>
            </div>
            {addColumnBlocked && (
              <p className="text-xs text-muted-foreground" data-testid="equipment-list-add-column-why">
                {t('equipmentList.addColumnOff', 'Add column is off: {{why}}', { ns: 'editor', why: addColumnBlocked })}
              </p>
            )}
            {library.error && (
              <Alert data-testid="equipment-list-columns-error">
                <CircleAlert />
                <AlertTitle>{t('equipmentList.builtinColumnsOnly', 'Only the built-in columns are offered', { ns: 'editor' })}</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2">
                  {library.error}
                  <Button size="sm" variant="outline" onClick={library.retry}>
                    {t('equipmentList.tryAgain', 'Try again', { ns: 'editor' })}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {columns.some((c) => c.index >= 0) && (
              <FieldSet data-testid="equipment-list-mapping">
                <FieldLegend variant="label">{t('equipmentList.moreColumns', 'More columns in this sheet', { ns: 'editor' })}</FieldLegend>
                <FieldDescription>{t('equipmentList.moreColumnsHint', 'Choose the parameter each one fills, or Not used. Matching names are chosen for you.', { ns: 'editor' })}</FieldDescription>
                <FieldGroup className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {columns
                    .filter((c) => c.index >= 0)
                    .map((c) => (
                      <Field key={c.index}>
                        <FieldLabel htmlFor={`bm-equipment-map-${c.index}`}>{c.heading}</FieldLabel>
                        <Select value={c.parameter ?? NOT_USED} onValueChange={(v) => remap(c.index, v === NOT_USED ? null : v)}>
                          <SelectTrigger id={`bm-equipment-map-${c.index}`} size="sm" data-testid={`equipment-map-${c.index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value={NOT_USED}>{t('equipmentList.notUsed', 'Not used', { ns: 'editor' })}</SelectItem>
                              {parameters.map((p) => (
                                <SelectItem key={p.name} value={p.name}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    ))}
                </FieldGroup>
              </FieldSet>
            )}
            {rows.length === 0 ? (
              <Empty className="border" data-testid="equipment-list-empty">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClipboardList />
                  </EmptyMedia>
                  <EmptyTitle>{pasted.trim() ? t('equipmentList.noRowsRead', 'No rows could be read from that', { ns: 'editor' }) : t('equipmentList.noRowsYet', 'No rows yet', { ns: 'editor' })}</EmptyTitle>
                  <EmptyDescription>
                    {pasted.trim() ? t('equipmentList.noRowsReadHint', 'Each row needs a description or a load. Check that the header row came with it, or add rows by hand.', { ns: 'editor' }) : t('equipmentList.noRowsHint', 'Paste a schedule above, or add rows by hand.', { ns: 'editor' })}
                  </EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" size="sm" onClick={addRow} data-testid="equipment-list-add-row-empty">
                  <Plus data-icon="inline-start" />
                  {t('equipmentList.addARow', 'Add a row', { ns: 'editor' })}
                </Button>
              </Empty>
            ) : (
              <div ref={windowRows.scrollRef} className="max-h-[48vh] overflow-auto rounded-md border">
                <Table data-testid="equipment-list-rows">
                  <TableCaption className="sr-only">{t('equipmentList.rowsCaption', 'Rows read from the equipment list, editable', { ns: 'editor' })}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      {DRAFT_FIELDS.map((f) => (
                        <TableHead key={f} className="text-xs">
                          {draftFieldLabel(f, t)}
                        </TableHead>
                      ))}
                      {extraColumns.map(({ parameter: p }) => (
                        <TableHead key={p.name} className="text-xs" data-testid={`equipment-extra-head-${p.name}`}>
                          {p.label}
                          {p.unit && p.unit !== '1' ? ` (${p.unit})` : ''}
                        </TableHead>
                      ))}
                      <TableHead className="text-xs">{t('equipmentList.readsAs', 'Reads as', { ns: 'editor' })}</TableHead>
                      {computedColumns.map((col) => (
                        <TableHead key={col.id} className="text-xs" data-testid={`equipment-computed-head-${col.id}`}>
                          {col.label}
                        </TableHead>
                      ))}
                      <TableHead>
                        <span className="sr-only">{t('equipmentList.remove', 'Remove', { ns: 'editor' })}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {windowRows.padTop > 0 && <TableRow aria-hidden="true" className="border-0 hover:bg-transparent" style={{ height: windowRows.padTop }} />}
                    {windowSlice(rows, windowRows).map(({ item: r, index: i }) => {
                      const c = checks[i]
                      const bad = (c?.problems.length ?? 0) > 0
                      return (
                        <TableRow key={r.key} ref={windowRows.measure} data-index={i} data-testid="equipment-list-row" data-problem={bad ? 'true' : undefined} className={bad ? 'bg-danger-50' : undefined}>
                          {DRAFT_FIELDS.map((f) => (
                            <TableCell key={f} className="p-1 align-top">
                              <Input className={`h-7 text-xs ${WIDTH[f]}`} value={r[f]} onChange={(e) => edit(r.key, f, e.target.value)} aria-label={t('equipmentList.fieldAria', '{{field}}, row {{row}}', { ns: 'editor', field: draftFieldLabel(f, t), row: i + 1 })} data-testid={`equipment-cell-${f}-${i}`} />
                            </TableCell>
                          ))}
                          {extraColumns.map(({ parameter: p }) => (
                            <TableCell key={p.name} className="p-1 align-top">
                              <Input className="h-7 w-24 text-xs" value={r.extras?.[p.name] ?? ''} onChange={(e) => editExtra(r.key, p.name, e.target.value)} aria-label={t('equipmentList.fieldAria', '{{field}}, row {{row}}', { ns: 'editor', field: p.label, row: i + 1 })} data-testid={`equipment-extra-${p.name}-${i}`} />
                            </TableCell>
                          ))}
                          <TableCell className="min-w-48 p-1 align-top text-xs">
                            {c && !bad && (
                              <span className="text-muted-foreground">
                                {[
                                  c.va !== null ? `${(c.va / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })} kVA${c.vaBasis ? ` (${c.vaBasis})` : ''}` : null,
                                  c.mbh !== null ? t('equipmentList.mbhGas', '{{mbh}} MBH gas', { ns: 'editor', mbh: c.mbh }) : null,
                                  c.quantity > 1 ? t('equipmentList.asMarks', 'as {{marks}}', { ns: 'editor', marks: unitMarks(r.mark.trim(), c.quantity).join(', ') }) : null,
                                ].filter(Boolean).join(' · ') || t('equipmentList.waterAndWasteOnly', 'Water and waste only', { ns: 'editor' })}
                              </span>
                            )}
                            {c?.problems.map((p) => (
                              <span key={p} className="block text-danger-600" data-testid={`equipment-row-problem-${i}`}>
                                {p}
                              </span>
                            ))}
                          </TableCell>
                          {computedColumns.map((col) => {
                            const cell = col.cell({ mark: r.mark, description: r.description })
                            return (
                              <TableCell key={col.id} className="min-w-28 p-1 align-top text-xs tabular-nums" title={cell?.title} data-testid={`equipment-computed-${col.id}-${i}`}>
                                {cell ? cell.text : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                            )
                          })}
                          <TableCell className="p-1 align-top">
                            <Button variant="ghost" size="icon" aria-label={r.mark ? t('equipmentList.removeRowMarked', 'Remove row {{row}} ({{mark}})', { ns: 'editor', row: i + 1, mark: r.mark }) : t('equipmentList.removeRow', 'Remove row {{row}}', { ns: 'editor', row: i + 1 })} onClick={() => remove(r.key)} data-testid={`equipment-remove-${i}`}>
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {windowRows.padBottom > 0 && <TableRow aria-hidden="true" className="border-0 hover:bg-transparent" style={{ height: windowRows.padBottom }} />}
                  </TableBody>
                </Table>
              </div>
            )}
            {rows.length > 0 && problemRows === 0 && <ProposedLoadsPanel proposals={proposals} declined={declined} onToggle={toggleLoad} disabledReason={editBlocked} />}
            {rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Button variant="outline" size="sm" onClick={addRow} data-testid="equipment-list-add-row">
                  <Plus data-icon="inline-start" />
                  {t('equipmentList.addARow', 'Add a row', { ns: 'editor' })}
                </Button>
                <span className={problemRows > 0 ? 'text-danger-600' : 'text-muted-foreground'} data-testid="equipment-list-summary">
                  {rows.length === 1 ? t('equipmentList.summaryOneRow', '1 row', { ns: 'editor' }) : t('equipmentList.summaryRows', '{{count}} rows', { ns: 'editor', count: rows.length })}
                  {', '}
                  {items === 1 ? t('equipmentList.summaryOneItem', '1 item', { ns: 'editor' }) : t('equipmentList.summaryItems', '{{count}} items', { ns: 'editor', count: items })}
                  {problemRows > 0 ? t('equipmentList.summaryToFix', '; {{count}} to fix', { ns: 'editor', count: problemRows }) : t('equipmentList.summaryReady', '; ready to add', { ns: 'editor' })}
                </span>
              </div>
            )}
            {refusal && (
              <Alert variant="destructive" data-testid="equipment-list-refusal">
                <CircleAlert />
                <AlertTitle>{t('equipmentList.nothingAdded', 'Nothing was added', { ns: 'editor' })}</AlertTitle>
                <AlertDescription>{refusal}</AlertDescription>
              </Alert>
            )}
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="equipment-list-close">
            {added > 0 ? t('equipmentList.done', 'Done', { ns: 'editor' }) : t('equipmentList.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          {added === 0 && (
            <Button onClick={add} disabled={why !== null} title={why ?? undefined} data-testid="equipment-list-add">
              <ListPlus data-icon="inline-start" />
              {items === 0
                ? t('equipmentList.addAsPlanned', 'Add as planned equipment', { ns: 'editor' })
                : loadCount === 0
                  ? t('equipmentList.addItemsAsPlanned', 'Add {{items}} as planned equipment', { ns: 'editor', items })
                  : loadCount === 1
                    ? t('equipmentList.addItemsAsPlannedOneLoad', 'Add {{items}} as planned equipment with 1 load', { ns: 'editor', items })
                    : t('equipmentList.addItemsAsPlannedLoads', 'Add {{items}} as planned equipment with {{loads}} loads', { ns: 'editor', items, loads: loadCount })}
            </Button>
          )}
        </DialogFooter>
        {why && added === 0 && rows.length > 0 && (
          <p className="text-right text-xs text-muted-foreground" data-testid="equipment-list-why">
            {why}
          </p>
        )}
      </DialogContent>
      {addingColumn && <AddColumnDialog library={library} shown={shownNames} editBlocked={addColumnBlocked} onClose={() => setAddingColumn(false)} onAdd={addColumn} />}
      {circuiting && model && <CircuitPlannedDialog model={model} partIds={withLoad} rules={circuitRules ?? null} submit={submit} onClose={() => setCircuiting(false)} />}
    </Dialog>
  )
}