'use client'

import { useMemo, useState, type ChangeEvent } from 'react'
import { CircleAlert, Gauge, ListRestart, Network } from 'lucide-react'
import { LOAD_CLASSES, modelLoadListText, modelLoadRows, parseEquipmentList, serviceCushionReading, serviceSize, type LoadClass, type ParsedEquipment } from '@permitzip/bim-pack-electrical'
import type { ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { Textarea } from '../../ui/textarea'
import type { NecRules } from './use-nec-rules'
import type { ServiceLayoutSeed } from './ServiceLayoutDialog'
import { CapacityTargetLine } from './CapacityTargetLine'
import type { CapacityTargets } from './use-capacity-targets'
import { useEditorTranslate, type Translate } from '../i18n/translate'

const SYSTEMS = {
  '208-3': { voltage: 208, phases: 3, service: '208Y/120' },
  '480-3': { voltage: 480, phases: 3, service: '480Y/277' },
  '240-1': { voltage: 240, phases: 1, service: '120/240' },
} as const

/** A system's name, in words — a `label(t)` accessor. */
function systemWord(key: '208-3' | '480-3' | '240-1', t: Translate): string {
  switch (key) {
    case '208-3':
      return t('electrical.system.208', '120/208 V 3-phase', { ns: 'editor' })
    case '480-3':
      return t('electrical.system.480', '277/480 V 3-phase', { ns: 'editor' })
    case '240-1':
      return t('electrical.system.240', '120/240 V single-phase', { ns: 'editor' })
  }
}
type SystemKey = keyof typeof SYSTEMS
const SYSTEM_KEYS: readonly SystemKey[] = ['208-3', '480-3', '240-1']
const isSystem = (v: string): v is SystemKey => SYSTEM_KEYS.some((k) => k === v)

/** A load class in words — a `label(t)` accessor. */
function classWord(cls: LoadClass, t: Translate): string {
  switch (cls) {
    case 'lighting':
      return t('electrical.loadClass.lighting', 'Lighting', { ns: 'editor' })
    case 'receptacle':
      return t('electrical.loadClass.receptacle', 'Receptacles', { ns: 'editor' })
    case 'kitchen':
      return t('electrical.loadClass.kitchen', 'Kitchen (220.56)', { ns: 'editor' })
    case 'motor':
      return t('electrical.loadClass.motor', 'Motor', { ns: 'editor' })
    case 'hvac':
      return t('electrical.loadClass.hvac', 'HVAC', { ns: 'editor' })
    case 'heating':
      return t('electrical.loadClass.heating', 'Heating', { ns: 'editor' })
    case 'cooling':
      return t('electrical.loadClass.cooling', 'Cooling', { ns: 'editor' })
    case 'other':
      return t('electrical.loadClass.other', 'Other (100%)', { ns: 'editor' })
  }
}

/**
 * Electrical › Service size: before any layout, paste the kitchen
 * consultant's equipment schedule and the mechanical list (from a
 * spreadsheet, a CSV, or text copied out of a PDF). Each row shows its load
 * in VA, how it was read, and a suggested NEC load class from its words;
 * change any class that's wrong. The service size and the Article 220 trail
 * update as you do. Nothing in the model changes until you press Start a
 * service layout. The agent's bim_service_from_equipment_list gives the same answer.
 *
 * Fill from the model writes the planned equipment (the Equipment list, rooftop
 * units) and the electrical estimates on spaces into the list as rows, so the
 * connected total here is the one the service's Load summary shows once they
 * are circuited (82 kW = 342 A at 240 V on 7303).
 */
export function ServiceSizeDialog({ nec, model, onClose, onStartLayout, capacityTargets, canEdit = false }: { readonly nec: NecRules; readonly model?: ModelState | null; readonly onClose: () => void; readonly onStartLayout?: (seed: ServiceLayoutSeed) => void; readonly capacityTargets?: CapacityTargets; readonly canEdit?: boolean }) {
  const t = useEditorTranslate()
  const [textIn, setTextIn] = useState('')
  const [system, setSystem] = useState<SystemKey>('208-3')
  const [spare, setSpare] = useState('0')
  const [classes, setClasses] = useState<ReadonlyMap<number, LoadClass>>(new Map())
  const [fileError, setFileError] = useState<string | null>(null)
  const [fillNote, setFillNote] = useState<string | null>(null)
  const sys = SYSTEMS[system]
  const fromModel = useMemo(() => (model ? modelLoadRows(model) : []), [model])
  const fill = () => {
    setTextIn(modelLoadListText(fromModel))
    setClasses(new Map())
    const planned = fromModel.filter((r) => r.from === 'planned item').length
    setFillNote(`Filled from the model: ${planned} planned item${planned === 1 ? '' : 's'} and ${fromModel.length - planned} estimate${fromModel.length - planned === 1 ? '' : 's'}. Edit any row; the model doesn't change.`)
  }
  const rows = useMemo<ParsedEquipment[]>(() => (nec.necEdition && textIn.trim() ? parseEquipmentList(nec.necEdition, textIn, { voltageV: sys.voltage, phases: sys.phases }) : []), [nec.necEdition, textIn, sys])
  const sparePct = Math.min(100, Math.max(0, Number(spare) || 0))
  const usable = rows.filter((r) => r.va !== null && r.va > 0)
  const result = useMemo(() => {
    if (!nec.necEdition || usable.length === 0) return null
    return serviceSize(nec.necEdition, { voltage_v: sys.voltage, phases: sys.phases, occupancy: 'other', spare_pct: sparePct, items: usable.map((r) => ({ label: [r.tag, r.description].filter(Boolean).join(' '), class: classes.get(r.line) ?? r.suggestedClass, va: r.va ?? 0, quantity: r.quantity })) })
  }, [nec.necEdition, usable, sys, sparePct, classes])
  const problems = rows.filter((r) => r.problem)

  const openFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    file
      .text()
      .then((t) => setTextIn(t))
      .catch((err: unknown) => {
        console.error('[ServiceSizeDialog] reading the file failed', { name: file.name, err })
        setFileError(`Couldn't read ${file.name}: ${err instanceof Error ? err.message : String(err)}`)
      })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl" data-testid="service-size-dialog">
        <DialogHeader>
          <DialogTitle>Service size from an equipment list</DialogTitle>
          <DialogDescription>{t('electrical.pasteTheKitchenAndMechanicalSchedulesFromASp', "Paste the kitchen and mechanical schedules (from a spreadsheet, a CSV, or text copied out of a PDF). Check each row's load class; the size follows NEC Article 220. Nothing in the model changes.", { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        {!nec.necEdition && (
          <Alert>
            <CircleAlert />
            <AlertTitle>{t('electrical.noNECEdition', 'No NEC edition', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{nec.label}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-3">
          <Field className="min-w-48 flex-1">
            <FieldLabel htmlFor="bm-service-system">{t('electrical.service', 'Service', { ns: 'editor' })}</FieldLabel>
            <Select value={system} onValueChange={(v) => isSystem(v) && setSystem(v)}>
              <SelectTrigger id="bm-service-system" data-testid="service-system">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SYSTEM_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {systemWord(k, t)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field className="w-36">
            <FieldLabel htmlFor="bm-service-spare">{t('electrical.spareCapacity', 'Spare capacity (%)', { ns: 'editor' })}</FieldLabel>
            <Input id="bm-service-spare" type="number" min={0} max={100} value={spare} onChange={(e) => setSpare(e.target.value)} data-testid="service-spare" />
          </Field>
          <Field className="min-w-56 flex-1">
            <FieldLabel htmlFor="bm-service-file">{t('electrical.orOpenACSVOrTextFile', 'Or open a CSV or text file', { ns: 'editor' })}</FieldLabel>
            <Input id="bm-service-file" type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" onChange={openFile} data-testid="service-file" />
            {fileError && (
              <FieldDescription className="text-danger-600" role="alert">
                {fileError}
              </FieldDescription>
            )}
          </Field>
        </div>
        {model !== undefined && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={fill} disabled={fromModel.length === 0} title={fromModel.length === 0 ? t('electrical.nothingToFillYetAddPlannedEquipmentEquipment', 'Nothing to fill yet: add planned equipment (Equipment list) or an estimate on a space first.', { ns: 'editor' }) : t('electrical.replaceTheListWithThePlannedEquipmentAndEsti', 'Replace the list with the planned equipment and estimates already in the model', { ns: 'editor' })} data-testid="service-fill-from-model">
              <ListRestart data-icon="inline-start" />
              Fill from the model{fromModel.length > 0 ? ` (${fromModel.length})` : ''}
            </Button>
            {fromModel.length === 0 ? (
              <FieldDescription>{t('electrical.nothingPlannedOrEstimatedInTheModelYetAddPla', 'Nothing planned or estimated in the model yet: add planned equipment (Equipment list) or an estimate on a space first.', { ns: 'editor' })}</FieldDescription>
            ) : (
              fillNote && <FieldDescription data-testid="service-fill-note">{fillNote}</FieldDescription>
            )}
          </div>
        )}
        <Field>
          <FieldLabel htmlFor="bm-service-text">{t('electrical.equipmentList', 'Equipment list', { ns: 'editor' })}</FieldLabel>
          <Textarea id="bm-service-text" rows={5} value={textIn} onChange={(e) => setTextIn(e.target.value)} placeholder={'K-10\tSandwich prep refrigerator\t1\t120\t1\t4.2 A\nK-14\tFryer, electric\t2\t208\t3\t17 kW'} data-testid="service-text" />
        </Field>
        {rows.length > 0 && (
          <div className="max-h-64 overflow-auto rounded-md border">
            <Table data-testid="service-rows">
              <TableCaption className="sr-only">Equipment read from the list</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('electrical.item', 'Item', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('electrical.qty', 'Qty', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('electrical.load', 'Load', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('electrical.class', 'Class', { ns: 'editor' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.line} data-testid="service-row">
                    <TableCell className="text-xs">
                      {r.tag && <span className="font-medium">{r.tag} </span>}
                      {r.description}
                      {r.problem && <span className="block text-danger-600">{r.problem}</span>}
                    </TableCell>
                    <TableCell className="text-xs">{r.quantity}</TableCell>
                    <TableCell className="text-xs">
                      {r.va === null ? '—' : `${r.va.toLocaleString('en-US')} VA`}
                      <span className="block text-muted-foreground">{r.vaBasis}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Select value={classes.get(r.line) ?? r.suggestedClass} onValueChange={(v) => { const c = LOAD_CLASSES.find((x) => x === v); if (c) setClasses(new Map([...classes, [r.line, c]])) }}>
                        <SelectTrigger size="sm" aria-label={`Load class of ${r.tag || r.description}`} data-testid={`service-class-${r.line}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {LOAD_CLASSES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {classWord(c, t)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <span className="block text-muted-foreground">{classes.has(r.line) ? t('electrical.youChoseIt', 'you chose it', { ns: 'editor' }) : r.classBasis}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {problems.length > 0 && <FieldDescription className="text-warning-700">{problems.length} row{problems.length === 1 ? '' : 's'} could not be read and are left out; fix them in the list.</FieldDescription>}
        {result && (
          <Alert data-testid="service-result">
            <Gauge />
            <AlertTitle>
              {t('electrical.service_186', 'Service:', { ns: 'editor' })} {result.detail.label} ({Math.round(result.detail.requiredA)} A needed)
            </AlertTitle>
            <AlertDescription>
              <p className="font-medium" data-testid="service-connected">
                Connected (every load at 100%): {(result.detail.connectedVa / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} kW = {Math.round(result.detail.connectedA)} A at {sys.voltage} V{sys.phases === 1 ? ' single-phase' : ' 3-phase'}
              </p>
              <CapacityTargetLine reading={serviceCushionReading({ demandA: result.detail.demand.sizingA, serviceA: result.detail.serviceA }, capacityTargets?.sources)} targets={capacityTargets} canEdit={canEdit} testId="service-cushion" />
              <ol className="list-decimal pl-4" data-testid="service-trail">
                {result.steps.map((s, i) => (
                  <li key={`${s.label}-${i}`}>
                    <span className="font-medium">{s.label}:</span> {s.detail}
                    {s.cite.length > 0 && <span className="text-muted-foreground"> ({s.cite.map((c) => c.text).join('; ')})</span>}
                  </li>
                ))}
              </ol>
              <p className="text-muted-foreground">{t('electrical.anEarlyEstimateConfirmWithTheUtilityAndWithT', 'An early estimate: confirm with the utility, and with the full calculation once the design has panels.', { ns: 'editor' })}</p>
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('electrical.close', 'Close', { ns: 'editor' })}
          </Button>
          {onStartLayout && result?.detail.serviceA && (
            <Button onClick={() => result.detail.serviceA && onStartLayout({ serviceA: result.detail.serviceA, system: sys.service })} data-testid="service-start-layout">
              <Network data-icon="inline-start" />
              {t('electrical.startA', 'Start a', { ns: 'editor' })} {result.detail.serviceA} A service layout
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
