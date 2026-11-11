'use client'

import { Droplets, Flame } from 'lucide-react'
import { Checkbox } from '../../ui/checkbox'
import { Label } from '../../ui/label'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '../../ui/item'
import { proposalTotals, type RowLoadProposal } from './plan-equipment'
import { useEditorTranslate, englishOnly, type Translate } from '../i18n/translate'

interface Props {
  readonly proposals: readonly RowLoadProposal[]
  /** Proposal keys the engineer unticked. */
  readonly declined: ReadonlySet<string>
  readonly onToggle: (key: string, accept: boolean) => void
  readonly disabledReason: string | null
}

function what(p: RowLoadProposal, t: Translate = englishOnly): string {
  const l = p.load
  // §7: the unit symbols never travel — MBH, CFH, WSFU, DFU are the engine's own.
  if (l.kind === 'gas') return t('equipmentList.loadGas', 'Gas {{mbh}} MBH ({{cfh}} CFH)', { ns: 'editor', mbh: l.mbh ?? 0, cfh: l.cfh ?? 0 })
  const parts = [l.wsfuTotal !== null ? `${l.wsfuTotal} WSFU` : null, l.dfu !== null ? `${l.dfu} DFU` : null].filter(Boolean)
  return parts.length > 0 ? t('equipmentList.loadWaterAndDrain', 'Water and drain: {{parts}}', { ns: 'editor', parts: parts.join(', ') }) : t('equipmentList.loadConnections', 'Water and drain connections', { ns: 'editor' })
}

/**
 * The plumbing and gas loads the pasted list would add (ROADMAP F4), each one
 * ticked by default and shown with where its numbers come from. Added with the
 * planned items as one change, so one Undo takes both back.
 */
export function ProposedLoadsPanel({ proposals, declined, onToggle, disabledReason }: Props) {
  const tr = useEditorTranslate()
  if (proposals.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="equipment-list-loads-none">
        {tr('equipmentList.noLoads', 'No plumbing or gas loads in this list: no row gives gas MBH, fixture units or water and waste sizes, or names a fixture such as a dishwasher, sink or gas fryer.', { ns: 'editor' })}
      </p>
    )
  }
  const accepted = new Set(proposals.filter((p) => !declined.has(p.key)).map((p) => p.key))
  const t = proposalTotals(proposals, accepted)
  return (
    <section className="flex flex-col gap-2" data-testid="equipment-list-loads" aria-label={tr('equipmentList.loadsTitle', 'Plumbing and gas loads', { ns: 'editor' })}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{tr('equipmentList.loadsTitle', 'Plumbing and gas loads', { ns: 'editor' })}</h3>
        <span className="text-xs text-muted-foreground" data-testid="equipment-list-loads-total">
          {accepted.size === 0
            ? tr('equipmentList.noneTicked', 'None ticked: the items are added without plumbing or gas loads', { ns: 'editor' })
            : t.count === 1
              ? tr('equipmentList.addsOneLoad', 'Adds 1 load: {{cfh}} CFH gas, {{wsfu}} WSFU, {{dfu}} DFU', { ns: 'editor', cfh: t.cfh, wsfu: t.wsfu, dfu: t.dfu })
              : tr('equipmentList.addsLoads', 'Adds {{count}} loads: {{cfh}} CFH gas, {{wsfu}} WSFU, {{dfu}} DFU', { ns: 'editor', count: t.count, cfh: t.cfh, wsfu: t.wsfu, dfu: t.dfu })}
        </span>
      </div>
      <ItemGroup className="max-h-56 overflow-auto rounded-md border">
        {proposals.map((p) => {
          const on = !declined.has(p.key)
          const id = `bm-equipment-load-${p.key.replace(/[^A-Za-z0-9_-]/g, '-')}`
          return (
            <Item key={p.key} size="sm" data-testid="equipment-list-load" data-kind={p.load.kind}>
              <ItemMedia variant="icon">{p.load.kind === 'gas' ? <Flame /> : <Droplets />}</ItemMedia>
              <ItemContent>
                <ItemTitle>
                  <Label htmlFor={id} className="font-medium">
                    {p.mark || tr('equipmentList.noMark', 'No mark', { ns: 'editor' })} {p.description ? `· ${p.description}` : ''} — {what(p, tr)}
                    {p.quantity > 1 ? tr('equipmentList.each', ' each, ×{{count}}', { ns: 'editor', count: p.quantity }) : ''}
                  </Label>
                </ItemTitle>
                <ItemDescription>{p.load.basis}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Checkbox id={id} checked={on} onCheckedChange={(v) => onToggle(p.key, v === true)} disabled={disabledReason !== null} title={disabledReason ?? undefined} aria-label={p.load.kind === 'gas' ? tr('equipmentList.addGasLoadFor', 'Add the gas load for {{what}}', { ns: 'editor', what: p.mark || tr('equipmentList.thisRow', 'this row', { ns: 'editor' }) }) : tr('equipmentList.addPlumbingLoadFor', 'Add the plumbing load for {{what}}', { ns: 'editor', what: p.mark || tr('equipmentList.thisRow', 'this row', { ns: 'editor' }) })} data-testid={`equipment-list-load-toggle-${p.load.kind}`} />
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>
    </section>
  )
}
