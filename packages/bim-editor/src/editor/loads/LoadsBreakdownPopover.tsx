'use client'

import { useMemo, useState } from 'react'
import { ListTree, MousePointerClick } from 'lucide-react'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '../../ui/popover'
import { ScrollArea } from '../../ui/scroll-area'
import { Separator } from '../../ui/separator'
import type { ElementId } from '@permitzip/bim-kernel'
import { useEditorTranslate } from '../i18n/translate'
import type { LoadsBreakdown } from './loads-breakdown'

/** Rows shown per list; the rest are in the Loads list. */
const ROWS_SHOWN = 40

interface Props {
  /** The chip's words ("Water and drainage: 0 of 35 piped · Gas: 0 of 5 piped"). */
  readonly chip: string
  /** Read only while the popover is open (the engine is incremental; this is a read, not a recount). */
  readonly breakdown: () => LoadsBreakdown
  /** Select these in the model; the refusal in words, or null. */
  readonly onSelect: (ids: readonly ElementId[], label: string) => void
  readonly onOpenList: () => void
  /** Why the Loads list can't be opened (it has to be made and editing is off), or null. */
  readonly openListBlocked: string | null
}

/**
 * The header's Loads chip and the breakdown it opens: per trade how far its
 * loads have got, the estimate beside the devices placed so far per space and
 * zone, what the project counts, and the loads that need someone. Each row
 * selects in the model; the footer opens the Loads list. Esc closes.
 */
export function LoadsBreakdownPopover({ chip, breakdown, onSelect, onOpenList, openListBlocked }: Props) {
  const t = useEditorTranslate()
  const [open, setOpen] = useState(false)
  // `breakdown` changes identity with each model render; reading it only while open keeps the header cheap.
  const data = useMemo(() => (open ? breakdown() : null), [open, breakdown])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="hidden h-6 rounded-full px-2.5 text-xs lg:inline-flex" title={t('loads.chipTitle', 'Loads by trade and status, estimates beside the devices so far, and loads that need attention', { ns: 'editor' })} data-testid="building-model-loads-progress">
          {chip}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[26rem] p-0" data-testid="loads-breakdown">
        <PopoverHeader className="px-3 pt-3">
          <PopoverTitle>{t('loads.title', 'Loads', { ns: 'editor' })}</PopoverTitle>
          <PopoverDescription>
            {data
              ? `${data.total === 1 ? t('loads.oneInThisModel', '{{count}} load in this model', { ns: 'editor', count: data.total }) : t('loads.manyInThisModel', '{{count}} loads in this model', { ns: 'editor', count: data.total })}${data.counted ? `. ${data.counted}` : ''}`
              : t('loads.reading', 'Reading the loads…', { ns: 'editor' })}
          </PopoverDescription>
        </PopoverHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-3 p-3">
            {data && data.total === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t('loads.emptyTitle', 'No loads yet', { ns: 'editor' })}</EmptyTitle>
                  <EmptyDescription>{t('loads.emptyWhy', 'Add loads from the Loads list, a space’s loads, or by placing fixtures and devices.', { ns: 'editor' })}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {data && data.trades.length > 0 ? (
              <section className="flex flex-col gap-1.5" aria-label={t('loads.byTrade', 'By trade', { ns: 'editor' })} data-testid="loads-breakdown-trades">
                <h3 className="text-xs font-medium text-muted-foreground">{t('loads.byTrade', 'By trade', { ns: 'editor' })}</h3>
                <ItemGroup>
                  {data.trades.map((t) => (
                    <Item key={t.trade} size="sm" variant="outline" data-testid="loads-breakdown-trade" data-trade={t.trade}>
                      <ItemContent>
                        <ItemTitle className="text-xs">
                          {t.label}: {t.done}
                        </ItemTitle>
                        {t.stages ? <ItemDescription className="text-xs">{t.stages}</ItemDescription> : null}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {t.statuses.map((s) => (
                            <Badge key={s.status} variant={s.status === 'mismatch' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {s.label}: {s.count}
                            </Badge>
                          ))}
                        </div>
                      </ItemContent>
                    </Item>
                  ))}
                </ItemGroup>
              </section>
            ) : null}
            {data && data.attention.length > 0 ? (
              <section className="flex flex-col gap-1.5" aria-label={t('loads.needsAttention', 'Needs attention', { ns: 'editor' })} data-testid="loads-breakdown-attention">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {t('loads.needsAttentionCount', 'Needs attention ({{count}})', { ns: 'editor', count: data.attention.length })}
                </h3>
                <ItemGroup>
                  {data.attention.slice(0, ROWS_SHOWN).map((r) => (
                    <Item key={r.id} size="sm" variant="outline" data-testid="loads-breakdown-attention-row" data-reason={r.reason} data-load={r.id}>
                      <ItemContent>
                        <ItemTitle className="text-xs">
                          {r.label}
                          <Badge variant={r.reason === 'mismatch' ? 'destructive' : 'outline'} className="text-[10px]">
                            {r.reason === 'mismatch' ? t('loads.disagreesWithSource', 'Disagrees with its source', { ns: 'editor' }) : t('loads.status.open', 'No source yet', { ns: 'editor' })}
                          </Badge>
                        </ItemTitle>
                        <ItemDescription className="text-xs">{r.why}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button size="xs" variant="ghost" onClick={() => onSelect(r.selectIds, r.label)} aria-label={t('loads.selectWhat', 'Select {{name}}', { ns: 'editor', name: r.label })}>
                          <MousePointerClick data-icon="inline-start" />
                          {t('loads.select', 'Select', { ns: 'editor' })}
                        </Button>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
                {data.attention.length > ROWS_SHOWN ? (
                  <p className="text-xs text-muted-foreground">
                    {t('loads.moreInList', '{{count}} more in the Loads list.', { ns: 'editor', count: data.attention.length - ROWS_SHOWN })}
                  </p>
                ) : null}
              </section>
            ) : null}
            {data && data.estimates.length > 0 ? (
              <section className="flex flex-col gap-1.5" aria-label={t('loads.estimateVsDevices', 'Estimate vs devices so far', { ns: 'editor' })} data-testid="loads-breakdown-estimates">
                <h3 className="text-xs font-medium text-muted-foreground">{t('loads.estimateVsDevices', 'Estimate vs devices so far', { ns: 'editor' })}</h3>
                <ItemGroup>
                  {data.estimates.slice(0, ROWS_SHOWN).map((r) => (
                    <Item key={r.id} size="sm" variant="outline" data-testid="loads-breakdown-estimate-row" data-scope={r.id}>
                      <ItemContent>
                        <ItemTitle className="text-xs">
                          {r.kind === 'zone' ? t('loads.zone', 'Zone', { ns: 'editor' }) : t('loads.space', 'Space', { ns: 'editor' })} {r.name}
                        </ItemTitle>
                        <ItemDescription className="text-xs">{r.text}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            onSelect([r.id], t('loads.scopeAndName', '{{kind}} {{name}}', { ns: 'editor', kind: r.kind === 'zone' ? t('loads.zoneLower', 'zone', { ns: 'editor' }) : t('loads.spaceLower', 'space', { ns: 'editor' }), name: r.name }))
                          }
                          aria-label={t('loads.selectKindAndName', 'Select {{kind}} {{name}}', {
                            ns: 'editor',
                            kind: r.kind === 'zone' ? t('loads.zone', 'Zone', { ns: 'editor' }) : t('loads.space', 'Space', { ns: 'editor' }),
                            name: r.name,
                          })}
                        >
                          <MousePointerClick data-icon="inline-start" />
                          {t('loads.select', 'Select', { ns: 'editor' })}
                        </Button>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
                {data.estimates.length > ROWS_SHOWN ? (
                  <p className="text-xs text-muted-foreground">
                    {t('loads.moreSeeSpaces', '{{count}} more: see Spaces, or a Space loads schedule.', { ns: 'editor', count: data.estimates.length - ROWS_SHOWN })}
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        </ScrollArea>
        <Separator />
        <div className="flex items-center justify-between gap-2 p-2">
          <span className="text-xs text-muted-foreground">
            {openListBlocked ? t('loads.listBlocked', 'Loads list: {{why}}', { ns: 'editor', why: openListBlocked }) : t('loads.listEveryRow', 'Every load row, with its values and status', { ns: 'editor' })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={openListBlocked !== null}
            title={openListBlocked ?? undefined}
            data-testid="loads-breakdown-open-list"
            onClick={() => {
              setOpen(false)
              onOpenList()
            }}
          >
            <ListTree data-icon="inline-start" />
            {t('loads.openList', 'Open the Loads list', { ns: 'editor' })}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
