'use client'

import { Cable, CircleDot, Unplug, Waypoints } from 'lucide-react'
import { faultCurrentAt, faultCurrentSummary, electricalConnections, hasPositions, panelSchedule } from '@permitzip/bim-pack-electrical'
import { type ModelState } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Separator } from '../../ui/separator'
import type { SubmitCommand } from '../views-sheets/types'
import { ConnectionTypePicker } from './ConnectionTypePicker'
import { DedicatedSpaceForm } from './DedicatedSpaceForm'
import { useEditorTranslate } from '../i18n/translate'
import type { ElectricalTarget } from './selection'

/**
 * The Electrical section of the properties panel: what a device is on (with
 * one click to put it on a circuit or change it), the circuits a panel has and
 * what feeds it, and for a box selection how many are circuited.
 */
export function ElectricalProperties({
  model,
  target,
  addBlocked,
  onAdd,
  onEdit,
  onPanelView,
  onFeed,
  submit,
  editBlocked,
  onManageTypes,
}: {
  readonly model: ModelState
  readonly target: ElectricalTarget
  readonly addBlocked: string | null
  readonly onAdd: () => void
  readonly onEdit: (linkId: string) => void
  readonly onPanelView: (panelId: string) => void
  readonly onFeed: () => void
  readonly submit: SubmitCommand
  readonly editBlocked: string | null
  readonly onManageTypes: () => void
}) {
  const t = useEditorTranslate()
  const els = model.elements
  const body = (() => {
    if (target.panels.length === 1 && target.loads.length === 0) {
      const panelId = target.panels[0] ?? ''
      const s = panelSchedule(els, panelId)
      if (!s) return null
      const fault = faultCurrentAt(els, panelId)
      const panelPart = els[panelId]
      return (
        <>
          <ItemGroup className="gap-1">
            <Item size="sm">
              <ItemContent>
                <ItemDescription className="text-xs">{t('electrical.system', 'System', { ns: 'editor' })}</ItemDescription>
                <ItemTitle className="text-xs font-normal">{s.system}</ItemTitle>
              </ItemContent>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemDescription className="text-xs">{t('electrical.supplyFrom', 'Supply from', { ns: 'editor' })}</ItemDescription>
                <ItemTitle className="text-xs font-normal" data-testid="electrical-props-supply">
                  {s.fedBy ? `${s.fedBy.sourceName} (${s.fedBy.name})` : t('empty.notFedYet', 'Not fed yet', { ns: 'editor' })}
                </ItemTitle>
              </ItemContent>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemDescription className="text-xs">{hasPositions(s.kind) ? t('electrical.circuits', 'Circuits', { ns: 'editor' }) : t('electrical.feeds_67', 'Feeds', { ns: 'editor' })}</ItemDescription>
                <ItemTitle className="text-xs font-normal" data-testid="electrical-props-circuits">
                  {s.circuits.length === 0 ? t('empty.noneYet', 'None yet', { ns: 'editor' }) : s.circuits.slice(0, 8).map((c) => (c.role === 'feeder' ? `${c.name} (feeder)` : `${c.name} ${c.description}`.trim())).join(' · ')}
                  {s.circuits.length > 8 ? ` · and ${s.circuits.length - 8} more` : ''}
                </ItemTitle>
              </ItemContent>
            </Item>
            {fault && (
              <Item size="sm">
                <ItemContent>
                  <ItemDescription className="text-xs">{t('electrical.faultCurrent', 'Fault current', { ns: 'editor' })}</ItemDescription>
                  <ItemTitle className={`text-xs font-normal${fault.passes === false ? ' text-danger-600' : ''}`} data-testid="electrical-props-fault">
                    {faultCurrentSummary(fault)}
                  </ItemTitle>
                </ItemContent>
              </Item>
            )}
          </ItemGroup>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onPanelView(panelId)} data-testid="electrical-props-panel-view">
              <CircleDot data-icon="inline-start" />
              {t('electrical.openPanelSchedule', 'Open panel schedule', { ns: 'editor' })}
            </Button>
            <Button variant="outline" size="sm" onClick={onFeed} data-testid="electrical-props-feed">
              <Unplug data-icon="inline-start" />
              {s.fedBy ? t('electrical.changeFeeder', 'Change feeder', { ns: 'editor' }) : `Feed ${s.name}`}
            </Button>
          </div>
          {panelPart?.kind === 'part' && <DedicatedSpaceForm key={panelId} model={model} part={panelPart} canEdit={editBlocked === null} editBlocked={editBlocked} submit={submit} />}
        </>
      )
    }
    if (target.loads.length === 1 && target.panels.length === 0) {
      const id = target.loads[0] ?? ''
      const conn = electricalConnections(els, id)[0]
      const circuit = conn?.circuit ?? null
      return (
        <>
          <ItemGroup className="gap-1">
            <Item size="sm">
              <ItemContent>
                <ItemDescription className="text-xs">{t('electrical.circuit', 'Circuit', { ns: 'editor' })}</ItemDescription>
                <ItemTitle className="text-xs font-normal" data-testid="electrical-props-circuit">
                  {circuit ? `${circuit.name} (panel ${circuit.sourceName})` : t('empty.notOnCircuit', 'Not on a circuit', { ns: 'editor' })}
                </ItemTitle>
              </ItemContent>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemDescription className="text-xs">{t('electrical.needs', 'Needs', { ns: 'editor' })}</ItemDescription>
                <ItemTitle className="text-xs font-normal">
                  {conn?.voltage ? `${conn.voltage} V, ${conn.poles ?? 1} pole${(conn.poles ?? 1) === 1 ? '' : 's'}` : t('empty.noVoltageSet', 'No voltage set: set it above before circuiting', { ns: 'editor' })}
                  {conn?.loadVa ? `, ${Math.round(conn.loadVa)} VA` : ''}
                </ItemTitle>
              </ItemContent>
            </Item>
          </ItemGroup>
          <ConnectionTypePicker model={model} ids={[id]} submit={submit} editBlocked={editBlocked} onManage={onManageTypes} />
          <div className="flex flex-wrap gap-2">
            <Button variant={circuit ? 'outline' : 'default'} size="sm" onClick={onAdd} disabled={addBlocked !== null} title={addBlocked ?? undefined} data-testid="electrical-props-add">
              <Cable data-icon="inline-start" />
              {circuit ? t('electrical.changeCircuit', 'Change circuit', { ns: 'editor' }) : t('electrical.addToCircuit', 'Add to circuit', { ns: 'editor' })}
            </Button>
            {circuit && (
              <>
                <Button variant="outline" size="sm" onClick={() => onEdit(circuit.linkId)}>
                  <Waypoints data-icon="inline-start" />
                  {t('electrical.editCircuit', 'Edit circuit', { ns: 'editor' })}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onPanelView(circuit.sourceId)}>
                  <CircleDot data-icon="inline-start" />
                  {circuit.sourceName}
                </Button>
              </>
            )}
          </div>
          {addBlocked && <p className="text-xs text-muted-foreground">{addBlocked}</p>}
        </>
      )
    }
    if (target.loads.length === 0) return null
    const circuited = target.loads.filter((id) => electricalConnections(els, id).some((c) => c.circuit)).length
    return (
      <>
        <p className="text-xs" data-testid="electrical-props-group">
          {target.loads.length} device{target.loads.length === 1 ? '' : 's'} that take power: {circuited === 0 ? t('electrical.noneOnACircuitYet', 'none on a circuit yet', { ns: 'editor' }) : `${circuited} on a circuit`}.{target.panels.length > 0 ? ` ${target.panels.length} panel${target.panels.length === 1 ? '' : 's'} in the selection stay as they are.` : ''}
        </p>
        <ConnectionTypePicker model={model} ids={target.loads} submit={submit} editBlocked={editBlocked} onManage={onManageTypes} />
        <Button size="sm" onClick={onAdd} disabled={addBlocked !== null} title={addBlocked ?? undefined} data-testid="electrical-props-add">
          <Cable data-icon="inline-start" />
          {circuited === target.loads.length ? t('electrical.changeCircuit', 'Change circuit', { ns: 'editor' }) : t('electrical.addToCircuit', 'Add to circuit', { ns: 'editor' })}
        </Button>
        {addBlocked && <p className="text-xs text-muted-foreground">{addBlocked}</p>}
      </>
    )
  })()
  if (!body) return null
  return (
    <section className="flex flex-col gap-2" aria-label={t('electrical.electrical', 'Electrical', { ns: 'editor' })} data-testid="electrical-properties">
      <Separator />
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('electrical.electrical', 'Electrical', { ns: 'editor' })}</span>
      {body}
    </section>
  )
}
