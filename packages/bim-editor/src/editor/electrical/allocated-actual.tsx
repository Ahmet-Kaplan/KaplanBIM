import type { AllocatedActual, QuantityKey } from '@permitzip/bim-kernel'
import { Badge } from '../../ui/badge'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

/**
 * Allocated against actual, everywhere a total shows (product decision, Oct 27,
 * decision 4): "estimate 2 kW · devices so far 0.8 kW", and which one the
 * total counts. Estimates count until the real devices add up to more.
 */

const kw = (va: number): string => `${(va / 1000).toLocaleString('en-US', { maximumFractionDigits: va >= 10000 ? 0 : 1 })} kW`

const FORMAT: Partial<Record<QuantityKey, (v: number) => string>> = {
  va: kw,
  mbh: (v) => `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} MBH`,
  cfm: (v) => `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} CFM`,
  dfu: (v) => `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })} DFU`,
}

export function formatQuantityShort(key: QuantityKey, value: number): string {
  return (FORMAT[key] ?? ((v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 })))(value)
}

/** The words, or null when nothing was estimated (then the total is just the devices, as before). */
export function allocatedActualWords(figures: AllocatedActual | null, key: QuantityKey = 'va', t: Translate = englishOnly): { readonly text: string; readonly counts: 'estimate' | 'devices' } | null {
  if (!figures) return null
  const allocated = figures.allocated[key]
  if (!(allocated > 0)) return null
  const actual = figures.actual[key]
  const counts = figures.governing[key] === 'actual' ? 'devices' : 'estimate'
  const text = t('electrical.allocatedActual', 'estimate {{estimate}} · devices so far {{actual}}', {
    ns: 'editor',
    estimate: formatQuantityShort(key, allocated),
    actual: formatQuantityShort(key, actual),
  })
  return { text, counts }
}

export function AllocatedActualLine({ figures, quantity = 'va', testId = 'allocated-actual' }: { readonly figures: AllocatedActual | null; readonly quantity?: QuantityKey; readonly testId?: string }) {
  const t = useEditorTranslate()
  const words = allocatedActualWords(figures, quantity, t)
  if (!words) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" data-testid={testId}>
      <span>{words.text}</span>
      <Badge variant="outline" className="text-[10px]" title={words.counts === 'estimate' ? t('electrical.theEstimateCountsUntilTheDevicesAddUpToMore', 'The estimate counts until the devices add up to more.', { ns: 'editor' }) : t('electrical.theDevicesAddUpToMoreThanTheEstimateSoTheyCo', 'The devices add up to more than the estimate, so they count.', { ns: 'editor' })}>
        {words.counts === 'estimate' ? t('electrical.theEstimateCounts', 'the estimate counts', { ns: 'editor' }) : t('electrical.theDevicesCount', 'the devices count', { ns: 'editor' })}
      </Badge>
    </span>
  )
}
