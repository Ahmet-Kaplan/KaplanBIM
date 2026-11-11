'use client'

import { RotateCwIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Spinner } from '../../ui/spinner'
import type { QuantityDeltaState } from './useQuantityDelta'
import { useEditorTranslate } from '../i18n/translate'

/** "What it does to quantities": loading, error with Retry, "no quantity change", or the rows. Never a price. */
export function QuantityDeltaList({ state, onRetry }: { readonly state: QuantityDeltaState; readonly onRetry: () => void }) {
  const t = useEditorTranslate()
  if (state.status === 'off') return null
  if (state.status === 'loading') {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner aria-hidden /> {t('changeOrders.workingOutQuantities', 'Working out what this changes in quantities…', { ns: 'editor' })}
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('changeOrders.quantityChangeFailed', 'The quantity change didn’t load', { ns: 'editor' })}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {state.message}
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCwIcon aria-hidden /> {t('changeOrders.retry', 'Retry', { ns: 'editor' })}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  const { deltas, changedIds } = state.read
  if (deltas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {changedIds.length === 0
          ? t('changeOrders.nothingChanged', 'Nothing changed in this range.', { ns: 'editor' })
          : changedIds.length === 1
            ? t('changeOrders.oneElementChanged', '{{count}} element changed, with no change in quantities.', { ns: 'editor', count: changedIds.length })
            : t('changeOrders.manyElementsChanged', '{{count}} elements changed, with no change in quantities.', { ns: 'editor', count: changedIds.length })}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">
        {changedIds.length === 1
          ? t('changeOrders.whatChangesOne', 'What this changes in quantities ({{count}} element changed):', { ns: 'editor', count: changedIds.length })
          : t('changeOrders.whatChangesMany', 'What this changes in quantities ({{count}} elements changed):', { ns: 'editor', count: changedIds.length })}
      </p>
      <ul aria-label={t('changeOrders.quantityChange', 'Quantity change', { ns: 'editor' })} className="flex flex-col gap-0.5 text-sm">
        {deltas.map((d) => (
          <li key={`${d.group}|${d.measure}`}>{d.label}</li>
        ))}
      </ul>
    </div>
  )
}
