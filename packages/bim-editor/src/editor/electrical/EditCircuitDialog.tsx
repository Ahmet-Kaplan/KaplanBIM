'use client'

import { useState } from 'react'
import { CircleAlert, Ruler, Save, Trash2, X } from 'lucide-react'
import { PERMITZIP_DESIGN_CRITERIA, type NecEdition } from '@permitzip/bim-calc'
import { sizeFeederFromDemand, describeCircuit, distributionOf, feederTypeText, slotChoiceLabel, slotChoices, type ElectricalLoadEngine, planEditCircuit, linkLoad } from '@permitzip/bim-pack-electrical'
import { organizationOf, type ConductorSet, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import type { SubmitCommand } from '../views-sheets/types'
import { useEditorTranslate } from '../i18n/translate'

/** Conductor sizes as drawings write them, smallest first. */
export const WIRE_SIZES = ['14', '12', '10', '8', '6', '4', '3', '2', '1', '1/0', '2/0', '3/0', '4/0', '250', '300', '350', '400', '500'] as const
const DEFAULT_WIRE = 'default'

/**
 * Edit circuit: its slots (moved on the same panel), breaker, wire and
 * description, and what is on it (take a device off, or delete the circuit,
 * which asks first). Saved as one change; undo brings it back.
 */
/** What a feeder's Size it needs: the project's NEC edition (null: none recorded) and the engine its loads are read with. */
export interface FeederSizingContext {
  readonly edition: NecEdition | null
  readonly engine: ElectricalLoadEngine
}

export function EditCircuitDialog({ model, linkId, submit, onClose, sizing }: { readonly model: ModelState; readonly linkId: string; readonly submit: SubmitCommand; readonly onClose: () => void; readonly sizing?: FeederSizingContext }) {
  const t = useEditorTranslate()
  const els = model.elements
  const link = els[linkId]
  const circuit = link?.kind === 'service_link' ? describeCircuit(els, link) : null
  const conductors = link?.kind === 'service_link' ? link.electrical?.conductors : undefined
  const [description, setDescription] = useState(circuit?.description ?? '')
  const [breaker, setBreaker] = useState(circuit?.ratingA ? String(circuit.ratingA) : '')
  const [slotsKey, setSlotsKey] = useState(circuit?.positions.join(',') ?? '')
  const [wire, setWire] = useState<string>(conductors?.phaseSize ?? DEFAULT_WIRE)
  const [material, setMaterial] = useState<'cu' | 'al'>(conductors?.material ?? 'cu')
  const [lengthFt, setLengthFt] = useState(link?.kind === 'service_link' && link.electrical?.lengthFt ? String(link.electrical.lengthFt) : '')
  const [sized, setSized] = useState<string | null>(null)
  const [sizedSet, setSizedSet] = useState<ConductorSet | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  if (!circuit || link?.kind !== 'service_link') {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('electrical.thatCircuitIsGone', 'That circuit is gone', { ns: 'editor' })}</DialogTitle>
            <DialogDescription>{t('electrical.someoneDeletedItOrUndoTookItBackCloseThisAnd', 'Someone deleted it, or undo took it back. Close this and pick another.', { ns: 'editor' })}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }
  const sourceId = link.source.elementId
  const load = linkLoad(model, linkId)
  const memberVa = new Map(load?.members.map((m) => [m.elementId, m.va]) ?? [])
  const choices = circuit.positions.length > 0 ? slotChoices(els, sourceId, circuit.poles, linkId) : []
  const org = organizationOf(model)
  const designing = org.phaseIndex.get(org.activePhaseId) ?? org.phases.length - 1
  const earlier = designing > 0 ? org.phases[designing - 1] : undefined
  const setPhase = (existing: boolean) => {
    const phaseId = existing ? earlier?.id : org.activePhaseId
    if (!phaseId) return
    const refusal = submit({ type: 'set_element_phases', ids: [linkId], phaseCreated: phaseId }, existing ? t('electrical.markNameExisting', 'mark {{name}} existing', { ns: 'editor', name: circuit.name }) : t('electrical.markNameNewWork', 'mark {{name}} new work', { ns: 'editor', name: circuit.name }))
    setSubmitError(refusal)
  }
  const breakerA = breaker.trim() === '' ? null : Number(breaker)
  const breakerBad = breakerA !== null && (!Number.isFinite(breakerA) || breakerA <= 0)
  const useSized = sizedSet !== null && sizedSet.phaseSize === wire && sizedSet.material === material
  const nextConductors: ConductorSet | null = wire === DEFAULT_WIRE ? null : useSized ? sizedSet : { sets: conductors?.sets ?? 1, phaseSize: wire, ...(conductors?.groundSize ? { groundSize: conductors.groundSize } : {}), ...(conductors?.neutralSize ? { neutralSize: conductors.neutralSize } : {}), material }
  const wireChanged = useSized ? JSON.stringify(sizedSet) !== JSON.stringify(conductors ?? null) : (conductors?.phaseSize ?? DEFAULT_WIRE) !== wire || (wire !== DEFAULT_WIRE && (conductors?.material ?? 'cu') !== material)
  const lengthNum = lengthFt.trim() === '' ? null : Number(lengthFt)
  const lengthBad = lengthNum !== null && (!Number.isFinite(lengthNum) || lengthNum <= 0)
  const fedId = circuit.role === 'feeder' ? circuit.feeds?.elementId : undefined
  const fedPart = fedId ? els[fedId] : undefined
  const fedInfo = fedPart?.kind === 'part' ? distributionOf(els, fedPart) : null
  const sizeBlocked = !sizing || !sizing.edition ? t('electrical.setTheNECEditionInTheCodeStudyToSizeFeeders', 'Set the NEC edition in the Code Study to size feeders.', { ns: 'editor' }) : !fedInfo ? t('electrical.thisFeederServesNothingToSizeItFor', 'This feeder serves nothing to size it for.', { ns: 'editor' }) : lengthBad ? t('electrical.theLengthIsFeetANumberAbove0', 'The length is feet, a number above 0.', { ns: 'editor' }) : null
  const sizeIt = () => {
    if (!sizing || !fedInfo || !fedId) return
    const report = sizing.engine.report(model, fedId)
    const s = sizeFeederFromDemand(sizing.edition, PERMITZIP_DESIGN_CRITERIA, { system: fedInfo.supply, demandVa: report?.demand.demandVa ?? 0, continuousVa: report?.demand.continuousVa ?? 0, ...(lengthNum !== null && !lengthBad ? { lengthFt: lengthNum } : {}) })
    if (!s.entry) {
      setSized(s.refusal)
      return
    }
    setBreaker(String(s.entry.ratingA))
    setWire(s.entry.conductors.phaseSize)
    setMaterial(s.entry.conductors.material)
    setSizedSet(s.entry.conductors)
    setSized(
      t('electrical.sizedForNameSCalculatedLoad', "Sized for {{name}}'s calculated load: {{type}}. {{description}}. Save to use it.", {
        ns: 'editor',
        name: fedInfo.name,
        type: feederTypeText(s.entry),
        description: s.entry.description,
      }),
    )
  }
  const plan = planEditCircuit(model, linkId, {
    description,
    ...(choices.length > 0 && slotsKey ? { positions: slotsKey.split(',').map(Number) } : {}),
    ...(!breakerBad && breakerA !== (circuit.ratingA ?? null) ? { ratingA: breakerA } : {}),
    ...(wireChanged ? { conductors: nextConductors } : {}),
    ...(circuit.role === 'feeder' && !lengthBad ? { lengthFt: lengthNum } : {}),
  })
  const why = breakerBad ? t('electrical.theBreakerIsAmpsANumberAbove0', 'The breaker is amps, a number above 0.', { ns: 'editor' }) : lengthBad ? t('electrical.theLengthIsFeetANumberAbove0', 'The length is feet, a number above 0.', { ns: 'editor' }) : !plan.ok && plan.reason !== t('electrical.nothingChanged', 'Nothing changed.', { ns: 'editor' }) ? plan.reason : null

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!plan.ok || why) return
    for (const command of plan.commands) {
      const refusal = submit(command, plan.label)
      if (refusal) {
        setSubmitError(refusal)
        return
      }
    }
    onClose()
  }

  const takeOff = (elementId: string, name: string) => {
    const refusal = submit({ type: 'remove_link_members', linkId, elementIds: [elementId] }, t('electrical.takeNameOffCircuit', 'take {{name}} off {{circuit}}', { ns: 'editor', name, circuit: circuit.name }))
    if (refusal) setSubmitError(refusal)
  }

  const remove = () => {
    const refusal = submit({ type: 'delete_elements', ids: [linkId], policy: 'disconnect' }, t('electrical.deleteCircuitNamed', 'delete circuit {{name}}', { ns: 'editor', name: circuit.name }))
    setConfirmDelete(false)
    if (refusal) setSubmitError(refusal)
    else onClose()
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg" data-testid="edit-circuit-dialog">
          <form onSubmit={save} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t('electrical.circuit', 'Circuit', { ns: 'editor' })} {circuit.name}</DialogTitle>
              <DialogDescription>
                {circuit.role === 'feeder'
                  ? t('electrical.feedsName', 'Feeds {{name}}.', { ns: 'editor', name: circuit.feeds?.name ?? t('electrical.nothingASpare', 'nothing (a spare)', { ns: 'editor' }) })
                  : t('electrical.countOnItVaConnected', '{{count}} on it, {{va}} VA connected.', { ns: 'editor', count: circuit.members.length, va: Math.round(load?.inventory.va ?? 0) })}{' '}
                {t('electrical.changesSaveTogetherYouCanUndoThem', 'Changes save together; you can undo them.', { ns: 'editor' })}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="grid grid-cols-2 gap-3">
              <Field className="col-span-2">
                <FieldLabel htmlFor="bm-edit-circuit-description">{t('electrical.description', 'Description', { ns: 'editor' })}</FieldLabel>
                <Input id="bm-edit-circuit-description" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Field className="col-span-2">
                <FieldLabel>{t('electrical.onThisRenovation', 'On this renovation', { ns: 'editor' })}</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={circuit.existing ? 'existing' : 'new'}
                  onValueChange={(v) => (v === 'existing' || v === 'new') && setPhase(v === 'existing')}
                  disabled={!earlier}
                  aria-label={t('electrical.newWorkOrExistingCircuit', 'New work or existing circuit', { ns: 'editor' })}
                  data-testid="edit-circuit-phase"
                >
                  <ToggleGroupItem value="new">{t('electrical.newWork', 'New work', { ns: 'editor' })}</ToggleGroupItem>
                  <ToggleGroupItem value="existing">{t('electrical.existing', 'Existing', { ns: 'editor' })}</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {!earlier
                    ? t('electrical.youAreDrawingThePhaseSoNothingIsEarlier', 'You are drawing the {{phase}} phase, so nothing is earlier; switch the active phase to the one you are designing to mark existing circuits.', {
                        ns: 'editor',
                        phase: org.phases[designing]?.entry.name ?? t('electrical.first', 'first', { ns: 'editor' }),
                      })
                    : circuit.existing
                      ? t('electrical.existingPhaseKeepsItsPanelAndCircuitNumber', 'Existing ({{phase}}): keeps its panel and circuit number, and Rebalance leaves it alone.', { ns: 'editor', phase: circuit.existing.phase })
                      : t('electrical.existingCircuitsKeepTheirPanelAndCircuitNumb', 'Existing circuits keep their panel and circuit number, and Rebalance leaves them alone.', { ns: 'editor' })}
                </FieldDescription>
              </Field>
              {choices.length > 0 && (
                <Field>
                  <FieldLabel htmlFor="bm-edit-circuit-slots">{t('electrical.slots', 'Slots', { ns: 'editor' })}</FieldLabel>
                  <Select value={slotsKey} onValueChange={setSlotsKey} disabled={circuit.existing !== undefined}>
                    <SelectTrigger id="bm-edit-circuit-slots" data-testid="edit-circuit-slots">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {choices.map((c) => (
                          <SelectItem key={c.join(',')} value={c.join(',')}>
                            {slotChoiceLabel(els, sourceId, c)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {circuit.existing && <FieldDescription>{t('electrical.anExistingCircuitKeepsItsNumberMarkItNewWork', 'An existing circuit keeps its number; mark it New work to move it.', { ns: 'editor' })}</FieldDescription>}
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="bm-edit-circuit-breaker">{t('electrical.breakerA', 'Breaker (A)', { ns: 'editor' })}</FieldLabel>
                <Input id="bm-edit-circuit-breaker" inputMode="numeric" value={breaker} onChange={(e) => setBreaker(e.target.value)} data-testid="edit-circuit-breaker" />
              </Field>
              <Field>
                <FieldLabel htmlFor="bm-edit-circuit-wire">{t('electrical.wire', 'Wire', { ns: 'editor' })}</FieldLabel>
                <Select value={wire} onValueChange={setWire}>
                  <SelectTrigger id="bm-edit-circuit-wire">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={DEFAULT_WIRE}>{t('electrical.defaultForTheBreaker', 'Default for the breaker', { ns: 'editor' })}</SelectItem>
                      {WIRE_SIZES.map((w) => (
                        <SelectItem key={w} value={w}>
                          #{w}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{t('electrical.upsizeForVoltageDropHereItPrintsAsTheRealSiz', 'Upsize for voltage drop here; it prints as the real size.', { ns: 'editor' })}</FieldDescription>
              </Field>
              {circuit.role === 'feeder' && (
                <Field className="col-span-2">
                  <FieldLabel htmlFor="bm-edit-circuit-length">{t('electrical.lengthFt', 'Length (ft)', { ns: 'editor' })}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input id="bm-edit-circuit-length" inputMode="decimal" className="w-28" value={lengthFt} onChange={(e) => setLengthFt(e.target.value)} aria-invalid={lengthBad} data-testid="edit-circuit-length" />
                    <Button type="button" variant="outline" size="sm" onClick={sizeIt} disabled={sizeBlocked !== null} title={sizeBlocked ?? undefined} data-testid="edit-circuit-size-it">
                      <Ruler data-icon="inline-start" />
                      {t('electrical.sizeIt', 'Size it', { ns: 'editor' })}
                    </Button>
                  </div>
                  <FieldDescription data-testid="edit-circuit-sizing">{sized ?? sizeBlocked ?? t('electrical.sizesTheBreakerAndConductorsFromWhatItFe', 'Sizes the breaker and conductors from what it feeds (NEC demand, continuous loads at 125%); the length also sets voltage drop and fault current.', { ns: 'editor' })}</FieldDescription>
                </Field>
              )}
              {wire !== DEFAULT_WIRE && (
                <Field>
                  <FieldLabel>{t('electrical.conductor', 'Conductor', { ns: 'editor' })}</FieldLabel>
                  <ToggleGroup type="single" variant="outline" value={material} onValueChange={(v) => (v === 'cu' || v === 'al') && setMaterial(v)} aria-label={t('electrical.conductorMaterial', 'Conductor material', { ns: 'editor' })}>
                    <ToggleGroupItem value="cu">{t('electrical.copper', 'Copper', { ns: 'editor' })}</ToggleGroupItem>
                    <ToggleGroupItem value="al">{t('electrical.aluminum', 'Aluminum', { ns: 'editor' })}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              )}
            </FieldGroup>
            {circuit.role === 'branch' && (
              <ItemGroup className="max-h-48 gap-1 overflow-y-auto" aria-label={t('electrical.onThisCircuit', 'On this circuit', { ns: 'editor' })}>
                {circuit.members.length === 0 && <p className="text-sm text-muted-foreground">{t('electrical.nothingOnItASpareSelectDevicesAndPressAddToC', 'Nothing on it: a spare. Select devices and press Add to circuit to use it.', { ns: 'editor' })}</p>}
                {circuit.members.map((m) => (
                  <Item key={m.elementId} size="sm" variant="outline">
                    <ItemContent>
                      <ItemTitle className="text-xs">{m.name}</ItemTitle>
                      <ItemDescription className="text-xs">{memberVa.get(m.elementId) ? `${Math.round(memberVa.get(m.elementId) ?? 0)} VA` : t('electrical.noLoadSet', 'no load set', { ns: 'editor' })}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button type="button" variant="ghost" size="sm" onClick={() => takeOff(m.elementId, m.name)} aria-label={t('electrical.takeNameOffCircuitAria', 'Take {{name}} off {{circuit}}', { ns: 'editor', name: m.name, circuit: circuit.name })}>
                        <X data-icon="inline-start" />
                        {t('electrical.takeOff_245', 'Take off', { ns: 'editor' })}
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
            {why && (
              <Alert variant="destructive" data-testid="edit-circuit-refusal">
                <CircleAlert />
                <AlertTitle>{t('electrical.canTSaveThis', 'Can’t save this', { ns: 'editor' })}</AlertTitle>
                <AlertDescription>{why}</AlertDescription>
              </Alert>
            )}
            {plan.ok && <p className="text-sm text-muted-foreground">{t('electrical.savesAs', 'Saves as', { ns: 'editor' })} {plan.summary}</p>}
            {submitError && (
              <FieldDescription className="text-danger-600" role="alert">
                {submitError}
              </FieldDescription>
            )}
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} data-testid="edit-circuit-delete">
                <Trash2 data-icon="inline-start" />
                {t('electrical.deleteCircuit_269', 'Delete circuit…', { ns: 'editor' })}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  {t('electrical.cancel', 'Cancel', { ns: 'editor' })}
                </Button>
                <Button type="submit" disabled={!plan.ok || why !== null} data-testid="edit-circuit-save">
                  <Save data-icon="inline-start" />
                  {plan.ok ? t('electrical.save', 'Save', { ns: 'editor' }) : t('electrical.noChanges', 'No changes', { ns: 'editor' })}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('electrical.deleteCircuit_288', 'Delete circuit', { ns: 'editor' })} {circuit.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {circuit.role === 'feeder'
                ? t('electrical.nameIsLeftWithNoFeeder', '{{name}} is left with no feeder.', { ns: 'editor', name: circuit.feeds?.name ?? t('electrical.thePanel', 'The panel', { ns: 'editor' }) })
                : circuit.members.length === 1
                  ? t('electrical.oneDeviceGoesBackToNoCircuit', '1 device goes back to no circuit, and the slots are freed.', { ns: 'editor' })
                  : t('electrical.nDevicesGoBackToNoCircuit', '{{count}} devices go back to no circuit, and the slots are freed.', { ns: 'editor', count: circuit.members.length })}{' '}
              {t('electrical.undoBringsItBack', 'Undo brings it back.', { ns: 'editor' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('electrical.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>{t('electrical.deleteCircuit', 'Delete circuit', { ns: 'editor' })}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
