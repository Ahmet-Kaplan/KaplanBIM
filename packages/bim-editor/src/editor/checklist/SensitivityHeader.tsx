'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Crosshair, Network, TriangleAlert } from 'lucide-react'
import { GRAPH_ANSWER_LIMIT, sensitivityOf, sensitivityRanking, type ModelState, type Requirement, type Sensitivity, type SensitivityItem, type SensitivityRanking } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Skeleton } from '../../ui/skeleton'
import { Spinner } from '../../ui/spinner'
import { useEditorTranslate } from '../i18n/translate'

/**
 * Checklist header › What drives the most: the inputs (a room's occupancy,
 * a zone, a design choice, a ceiling) that the most requirements hang on,
 * from the requirements graph's reverse index. Collapsed it says the top one
 * in a sentence; open it lists five, and clicking a row lists the
 * requirements that input drives, with Show in model (one control per row).
 */

export interface SensitivityHeaderProps {
  readonly model: ModelState
  /** The requirements the Checklist derived for this model (the ranking counts what the graph derived). */
  readonly requirements: readonly Requirement[]
  readonly onSelect: (ids: readonly string[]) => void
}

type Load = { readonly state: 'loading' } | { readonly state: 'error'; readonly message: string } | { readonly state: 'ready'; readonly ranking: SensitivityRanking }

const errorWords = (err: unknown) => (err instanceof Error ? err.message : String(err))

function Detail({ model, item, onSelect }: { model: ModelState; item: SensitivityItem; onSelect: (ids: readonly string[]) => void }) {
  const t = useEditorTranslate()
  const [all, setAll] = useState(false)
  const answer = useMemo((): { readonly ok: true; readonly value: Sensitivity } | { readonly ok: false; readonly message: string } => {
    try {
      return { ok: true, value: sensitivityOf(model, item.node.id) }
    } catch (err) {
      console.error('[Checklist] reading what one input drives failed', { input: item.node.id, err })
      return { ok: false, message: errorWords(err) }
    }
  }, [model, item.node.id])
  if (!answer.ok) {
    return (
      <p className="text-xs text-danger-600" data-testid="sensitivity-detail-error">
        {t('checklist.sensitivity.cannotList', 'Couldn’t list what {{what}} drives: {{reason}}', { ns: 'editor', what: item.label, reason: answer.message })}
      </p>
    )
  }
  const lines = all ? answer.value.lines : answer.value.lines.slice(0, GRAPH_ANSWER_LIMIT)
  const more = answer.value.lines.length - lines.length
  const anchors = [...new Set(answer.value.requirements.map((r) => r.anchor.id).filter((id): id is string => id !== null))]
  return (
    <div className="flex flex-col gap-1.5 pl-6" data-testid="sensitivity-detail">
      <ul className="flex flex-col gap-1 text-xs" aria-label={t('checklist.sensitivity.listAria', 'Requirements {{what}} drives', { ns: 'editor', what: item.label })}>
        {lines.map((l) => (
          <li key={l.requirement.id} className="flex items-center gap-2" data-testid="sensitivity-line">
            <span className="min-w-0 flex-1">{l.words}</span>
            <Badge variant={l.open ? 'secondary' : 'outline'} className="shrink-0">
              {l.open ? t('checklist.sensitivity.open', 'Open', { ns: 'editor' }) : t('checklist.sensitivity.metOrDecided', 'Met or decided', { ns: 'editor' })}
            </Badge>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {more > 0 && (
          <Button size="sm" variant="link" className="px-0" onClick={() => setAll(true)} data-testid="sensitivity-detail-more">
            {t('checklist.andMore', 'and {{count}} more', { ns: 'editor', count: more })}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onSelect([item.node.id, ...anchors])} data-testid="sensitivity-show">
          <Crosshair data-icon="inline-start" />
          {t('checklist.sensitivity.showInModel', 'Show in model', { ns: 'editor' })}
        </Button>
      </div>
    </div>
  )
}

export function SensitivityHeader({ model, requirements, onSelect }: SensitivityHeaderProps) {
  const t = useEditorTranslate()
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    void requirements
    void attempt
    // After paint: the first ranking on a fresh graph counts every derived anchor once (about 0.1 s at 250k elements); later revisions re-count only what changed.
    const handle = setTimeout(() => {
      try {
        setLoad({ state: 'ready', ranking: sensitivityRanking(model) })
      } catch (err) {
        console.error('[Checklist] working out what drives the most requirements failed', err)
        setLoad({ state: 'error', message: errorWords(err) })
      }
    }, 0)
    return () => clearTimeout(handle)
  }, [model, requirements, attempt])

  const ranking = load.state === 'ready' ? load.ranking : null
  const pickedItem = ranking?.items.find((i) => i.node.id === picked) ?? null
  const teaser =
    load.state === 'loading'
      ? t('checklist.sensitivity.working', 'Working out what drives the most requirements…', { ns: 'editor' })
      : load.state === 'error'
        ? t('checklist.sensitivity.failedOne', 'Couldn’t work out what drives the most requirements.', { ns: 'editor' })
        : (ranking?.items[0]?.words ?? t('checklist.sensitivity.nothingOne', 'Nothing drives a requirement yet.', { ns: 'editor' }))

  return (
    <section
      className="flex min-w-0 flex-col gap-2 rounded-md border border-border p-2"
      data-testid="sensitivity-header"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        if (picked !== null) setPicked(null)
        else if (open) setOpen(false)
        else return
        e.stopPropagation()
      }}
    >
      <Button variant="ghost" size="sm" className="h-auto justify-start gap-2 px-1 py-1 text-left" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="sensitivity-toggle">
        {open ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
        <span className="flex min-w-0 flex-col items-start">
          <span className="text-sm font-medium">{t('checklist.sensitivity.title', 'What drives the most', { ns: 'editor' })}</span>
          {!open && (
            <span className="truncate text-xs font-normal text-muted-foreground" data-testid="sensitivity-teaser">
              {teaser}
            </span>
          )}
        </span>
        {load.state === 'loading' && <Spinner className="ml-auto" />}
      </Button>

      {open && load.state === 'loading' && (
        <div className="flex flex-col gap-2" data-testid="sensitivity-loading" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      )}

      {open && load.state === 'error' && (
        <Alert variant="destructive" data-testid="sensitivity-error">
          <TriangleAlert />
          <AlertTitle>{t('checklist.sensitivity.failed', 'Couldn’t work out what drives the most requirements', { ns: 'editor' })}</AlertTitle>
          <AlertDescription>
            {load.message}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setAttempt((n) => n + 1)} data-testid="sensitivity-retry">
              {t('checklist.retry', 'Retry', { ns: 'editor' })}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {open && ranking && ranking.items.length === 0 && (
        <Empty className="border" data-testid="sensitivity-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Network />
            </EmptyMedia>
            <EmptyTitle>{t('checklist.sensitivity.nothing', 'Nothing drives a requirement yet', { ns: 'editor' })}</EmptyTitle>
            <EmptyDescription>{ranking.empty}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {open && ranking && ranking.items.length > 0 && (
        <>
          <ItemGroup className="gap-1.5" aria-label={t('checklist.sensitivity.groupAria', 'What drives the most requirements', { ns: 'editor' })}>
            {ranking.items.map((item) => {
              const shown = picked === item.node.id
              return (
                <Item key={item.node.id} variant="outline" size="sm" className="flex-col items-stretch gap-1 p-1" data-testid="sensitivity-row" data-input={item.node.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left"
                    aria-expanded={shown}
                    aria-label={
                      shown
                        ? t('checklist.sensitivity.rowAriaShown', '{{what}}: drives {{count}} {{noun}}. Hide them', {
                            ns: 'editor',
                            what: item.label,
                            count: item.drives,
                            noun: item.drives === 1 ? t('checklist.sensitivity.requirement', 'requirement', { ns: 'editor' }) : t('checklist.sensitivity.requirements', 'requirements', { ns: 'editor' }),
                          })
                        : t('checklist.sensitivity.rowAriaHidden', '{{what}}: drives {{count}} {{noun}}. See them', {
                            ns: 'editor',
                            what: item.label,
                            count: item.drives,
                            noun: item.drives === 1 ? t('checklist.sensitivity.requirement', 'requirement', { ns: 'editor' }) : t('checklist.sensitivity.requirements', 'requirements', { ns: 'editor' }),
                          })
                    }
                    onClick={() => setPicked(shown ? null : item.node.id)}
                    data-testid="sensitivity-row-toggle"
                  >
                    {shown ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
                    <ItemContent className="min-w-0 gap-0.5">
                      <ItemTitle className="text-sm">{item.label}</ItemTitle>
                      <ItemDescription className="text-xs">
                        {item.drives === 1
                          ? t('checklist.sensitivity.drivesOne', 'Drives {{count}} requirement', { ns: 'editor', count: item.drives.toLocaleString('en-US') })
                          : t('checklist.sensitivity.drivesMany', 'Drives {{count}} requirements', { ns: 'editor', count: item.drives.toLocaleString('en-US') })}
                        {item.open > 0
                          ? t('checklist.sensitivity.stillOpen', ', {{count}} still open', { ns: 'editor', count: item.open.toLocaleString('en-US') })
                          : t('checklist.sensitivity.noneOpen', ', none open', { ns: 'editor' })}
                      </ItemDescription>
                    </ItemContent>
                  </Button>
                  {shown && pickedItem && <Detail model={model} item={pickedItem} onSelect={onSelect} />}
                </Item>
              )
            })}
          </ItemGroup>
          {ranking.more > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="sensitivity-more">
              {ranking.more === 1
                ? t('checklist.sensitivity.moreOne', 'and {{count}} more input drives at least one requirement', { ns: 'editor', count: ranking.more.toLocaleString('en-US') })
                : t('checklist.sensitivity.moreMany', 'and {{count}} more inputs drive at least one requirement', { ns: 'editor', count: ranking.more.toLocaleString('en-US') })}
            </p>
          )}
        </>
      )}
    </section>
  )
}
