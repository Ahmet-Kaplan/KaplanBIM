'use client'

import { useMemo, useState } from 'react'
import { CircleAlert, Scale } from 'lucide-react'
import { type ModelState } from '@permitzip/bim-kernel'
import { distributionEquipment, hasPositions, planRebalance } from '@permitzip/bim-pack-electrical'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import type { SubmitCommand } from '../views-sheets/types'
import { useEditorTranslate } from '../i18n/translate'

const va = (v: number) => `${Math.round(v).toLocaleString('en-US')} VA`

/**
 * Electrical › Balance phases: the slot moves that even out a panel's phases,
 * shown before anything changes (the same moves every time for the same
 * panel). Tick "Keep" on a circuit to leave it where it is; the moves are
 * worked out again without it. Apply saves every move as one undoable edit;
 * Esc or Cancel closes with nothing changed.
 */
export function RebalanceDialog({ model, initialPanelId, submit, onClose, onDone }: { readonly model: ModelState; readonly initialPanelId: string | null; readonly submit: SubmitCommand; readonly onClose: () => void; readonly onDone: (panelId: string) => void }) {
  const t = useEditorTranslate()
  const els = model.elements
  const panels = useMemo(() => distributionEquipment(els).filter((d) => hasPositions(d.kind)), [els])
  const [panelId, setPanelId] = useState<string>(() => (initialPanelId && panels.some((p) => p.id === initialPanelId) ? initialPanelId : (panels[0]?.id ?? '')))
  const [keep, setKeep] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const plan = useMemo(() => (panelId ? planRebalance(els, panelId, { keep: [...keep] }) : null), [els, panelId, keep])
  const why = !panelId ? t('electrical.chooseThePanelToBalance', 'Choose the panel to balance.', { ns: 'editor' }) : !plan ? t('electrical.thatPanelHasNoSlotsToBalance', 'That panel has no slots to balance.', { ns: 'editor' }) : plan.command ? null : plan.message
  const kept = useMemo(() => [...keep], [keep])

  const apply = () => {
    if (!plan?.command) return
    const refusal = submit(plan.command, `rebalance ${plan.panelName}`)
    if (refusal) return setError(refusal)
    onDone(panelId)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl" data-testid="rebalance-dialog">
        <DialogHeader>
          <DialogTitle>{t('electrical.balanceAPanelAposSPhases', 'Balance a panel&apos;s phases', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('electrical.movesCircuitsBetweenSlotsSoABAndCCarryMoreEv', 'Moves circuits between slots so A, B and C carry more even load. What is on each circuit doesn&apos;t change, and three-pole breakers and existing circuits (on a renovation) stay put. You can undo this.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="bm-rebalance-panel">{t('electrical.panel', 'Panel', { ns: 'editor' })}</FieldLabel>
          <Select
            value={panelId}
            onValueChange={(v) => {
              setPanelId(v)
              setKeep(new Set())
              setError(null)
            }}
          >
            <SelectTrigger id="bm-rebalance-panel" data-testid="rebalance-panel-select">
              <SelectValue placeholder="Choose the panel" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {panels.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.system}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {plan && (
          <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="rebalance-phases">
            <span className="text-muted-foreground">{t('electrical.now', 'Now', { ns: 'editor' })}</span>
            {plan.before.map((p) => (
              <Badge key={`b-${p.phase}`} variant="outline">
                {p.phase} {va(p.va)}
              </Badge>
            ))}
            <span className="text-muted-foreground">{t('electrical.after', 'After', { ns: 'editor' })}</span>
            {plan.after.map((p) => (
              <Badge key={`a-${p.phase}`} variant="secondary">
                {p.phase} {va(p.va)}
              </Badge>
            ))}
          </div>
        )}
        {plan && plan.moves.length + kept.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table data-testid="rebalance-moves">
              <TableCaption className="sr-only">{t('electrical.proposedSlotMoves', 'Proposed slot moves', { ns: 'editor' })}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('electrical.circuit', 'Circuit', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('electrical.movesTo', 'Moves to', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('electrical.load', 'Load', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('electrical.keep', 'Keep', { ns: 'editor' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.moves.map((m) => (
                  <TableRow key={m.linkId} data-testid="rebalance-move">
                    <TableCell className="text-xs">
                      {m.from} <span className="text-muted-foreground">{m.description}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.to} ({m.fromPhases.join('')} → {m.toPhases.join('')})
                    </TableCell>
                    <TableCell className="text-xs">{va(m.va)}</TableCell>
                    <TableCell>
                      <Checkbox aria-label={`Keep ${m.from} where it is`} checked={false} onCheckedChange={() => setKeep(new Set([...keep, m.linkId]))} />
                    </TableCell>
                  </TableRow>
                ))}
                {kept.map((id) => {
                  const l = els[id]
                  return (
                    <TableRow key={id} className="text-muted-foreground">
                      <TableCell className="text-xs" colSpan={3}>
                        {l?.kind === 'service_link' ? `${l.description || id}` : id}: kept where it is
                      </TableCell>
                      <TableCell>
                        <Checkbox aria-label="Let it move again" checked onCheckedChange={() => setKeep(new Set(kept.filter((k) => k !== id)))} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {why ? (
          <Alert data-testid="rebalance-why">
            <CircleAlert />
            <AlertTitle>{t('electrical.nothingToApply', 'Nothing to apply', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{why}</AlertDescription>
          </Alert>
        ) : (
          <FieldDescription data-testid="rebalance-summary">{plan?.message}</FieldDescription>
        )}
        {error && (
          <FieldDescription className="text-danger-600" role="alert">
            {error}
          </FieldDescription>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('electrical.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button onClick={apply} disabled={why !== null} title={why ?? undefined} data-testid="rebalance-apply">
            <Scale data-icon="inline-start" />
            {t('electrical.apply', 'Apply', { ns: 'editor' })} {plan?.moves.length ?? 0} move{plan?.moves.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
