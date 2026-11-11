'use client'

import { useMemo } from 'react'
import { CircleAlert } from 'lucide-react'
import { hunterChart } from '@permitzip/bim-pack-plumbing'
import type { ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty'
import { FieldDescription } from '../../ui/field'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { useEditorTranslate } from '../i18n/translate'
import { HunterCurveChart } from './HunterCurveChart'

/** Plumbing › Sizing › Hunter curve: the demand curves and where each domestic water system falls on its curve, live from the model. */
export function HunterCurveDialog({ open, onOpenChange, model }: { open: boolean; onOpenChange: (open: boolean) => void; model: ModelState }) {
  const t = useEditorTranslate()
  const chart = useMemo(() => hunterChart(model), [model])
  const curveLabel = new Map(chart.curves.map((c) => [c.id, c.label]))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="hunter-curve-dialog">
        <DialogHeader>
          <DialogTitle>{chart.title}</DialogTitle>
          <DialogDescription>
            {t(
              'plumbing.hunterCurveDialogWhy',
              'Estimated water demand from fixture units on each curve, and each water system’s design point: the fixture units at its source and the gpm its curve reads there.',
              { ns: 'editor' },
            )}
          </DialogDescription>
        </DialogHeader>
        <HunterCurveChart chart={chart} />
        {chart.points.length === 0 ? (
          <Empty className="border py-3">
            <EmptyHeader>
              <EmptyTitle>{t('plumbing.noDesignPointsYet', 'No design points yet', { ns: 'editor' })}</EmptyTitle>
              <EmptyDescription>
                {t('plumbing.noDesignPointsYetWhy', 'Route domestic water pipe to fixtures or load points with water supply fixture units, and each system’s point appears on its curve.', { ns: 'editor' })}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table data-testid="hunter-curve-points">
            <TableCaption className="sr-only">{t('plumbing.designPoints', 'Design points', { ns: 'editor' })}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('plumbing.system', 'System', { ns: 'editor' })}</TableHead>
                <TableHead>{t('plumbing.curve', 'Curve', { ns: 'editor' })}</TableHead>
                <TableHead className="text-right">{t('plumbing.totalWsfu', 'Total WSFU', { ns: 'editor' })}</TableHead>
                <TableHead className="text-right">{t('plumbing.totalGpm', 'Total gpm', { ns: 'editor' })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chart.points.map((p) => (
                <TableRow key={p.systemId}>
                  <TableCell>{p.systemName}</TableCell>
                  <TableCell>{curveLabel.get(p.curveId) ?? p.curveId}</TableCell>
                  <TableCell className="text-right">{p.wsfu}</TableCell>
                  <TableCell className="text-right">{p.gpm}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {chart.missing.map((m) => (
          <Alert key={m.systemName}>
            <CircleAlert />
            <AlertTitle>{t('plumbing.hasNoDemandCurve', '{{system}} has no demand curve', { ns: 'editor', system: m.systemName })}</AlertTitle>
            <AlertDescription>{m.reason}</AlertDescription>
          </Alert>
        ))}
        <FieldDescription className="text-xs">
          {t('plumbing.hunterSourceLine', '{{source}}. Choose the curve in Plumbing › Analyze › Demand curve, or per system in Plumbing › Systems.', { ns: 'editor', source: chart.source })}
        </FieldDescription>
      </DialogContent>
    </Dialog>
  )
}
