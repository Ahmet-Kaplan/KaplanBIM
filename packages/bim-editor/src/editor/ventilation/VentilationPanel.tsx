'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import { Fan, Maximize2, X } from 'lucide-react'
import type { ElementId, ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Skeleton } from '../../ui/skeleton'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { Separator } from '../../ui/separator'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { PressurizationSection } from '../balance/PressurizationSection'
import { resolveGoverningStandard, VENTILATION_STANDARDS, ventilationEngine, type VentilationScope, type VentilationStandardId } from './pack'
import { ventilationView, type VentilationRow, type VentilationView } from './ventilation-rows'
import { useEditorTranslate, type Translate } from '../i18n/translate'

export interface VentilationPanelProps {
  /** Null while the model is loading. */
  readonly model: ModelState | null
  readonly error?: string | null
  readonly onRetry?: () => void
  /** The plan the person is on; "This level" lists its spaces. */
  readonly levelId: ElementId | null
  readonly levelName: string | null
  /** The project's adopted mechanical code from its Code Study, when known; it is marked governing. */
  readonly adoption?: { readonly codeName: string; readonly edition: string; readonly status: 'confirmed' | 'unconfirmed' } | null
  /** Two-letter state, used when the project has no adopted code recorded. */
  readonly state?: string | null
  /** Selects an element in the model: a space from its row, an exhaust fan or unit from the Pressurization section. */
  readonly onSelectSpace?: (spaceId: ElementId) => void
  /** Opens the Spaces panel (the empty state's next step). */
  readonly onOpenSpaces?: () => void
  readonly onClose: () => void
}

type ScopeChoice = 'level' | 'model'

/**
 * Building Model › Ventilation (ROADMAP M1): outdoor air and exhaust for every
 * space, IMC and ASHRAE 62.1 side by side with the adopted code marked
 * governing, and each zone's total against the unit that serves it. Read
 * only: the numbers come from each space's use, people and area.
 */
export function VentilationPanel(props: VentilationPanelProps) {
  const t = useEditorTranslate()
  const { model, error, onRetry, levelId, levelName, adoption, state, onSelectSpace, onOpenSpaces, onClose } = props
  const [scopeChoice, setScopeChoice] = useState<ScopeChoice>(levelId ? 'level' : 'model')
  const [asked, setAsked] = useState<VentilationStandardId | null>(null)
  const [selected, setSelected] = useState<ElementId | null>(null)
  const [fullOpen, setFullOpen] = useState(false)

  const adopted = useMemo(() => resolveGoverningStandard({ ...(adoption ? { projectAdoption: adoption } : {}), ...(state ? { state } : {}) }), [adoption, state])
  const governing = useMemo(() => (asked && asked !== adopted.standard ? resolveGoverningStandard({ asked }) : adopted), [asked, adopted])
  const scope = useMemo((): VentilationScope | null => (scopeChoice === 'level' ? (levelId ? { kind: 'level', levelId } : null) : { kind: 'model' }), [scopeChoice, levelId])

  const computed = useMemo((): { view: VentilationView } | { failure: string } | null => {
    if (!model || !scope) return null
    try {
      return { view: ventilationView(ventilationEngine().withGoverning(governing).table(model.elements, scope), t) }
    } catch (err) {
      console.error('[VentilationPanel] the ventilation table failed', err)
      return { failure: err instanceof Error ? err.message : String(err) }
    }
  }, [model, governing, scope, t])

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && !fullOpen) {
      e.stopPropagation()
      onClose()
    }
  }

  const view = computed && 'view' in computed ? computed.view : null
  const detail = view?.rows.find((r) => r.spaceId === selected) ?? null

  const header = (
    <header className="flex items-center gap-2">
      <Fan className="size-4 text-muted-foreground" aria-hidden />
      <h2 className="text-sm font-semibold">
        {view && !view.empty
          ? t('ventilation.panelWithCount', 'Ventilation: {{count}} spaces', { ns: 'editor', count: view.rows.length })
          : t('ventilation.title', 'Ventilation', { ns: 'editor' })}
      </h2>
      <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={t('ventilation.closePanel', 'Close Ventilation', { ns: 'editor' })} onClick={onClose}>
        <X />
      </Button>
    </header>
  )

  if (error) {
    return (
      <section className="flex flex-col gap-3" aria-label={t('ventilation.title', 'Ventilation', { ns: 'editor' })} onKeyDown={onKeyDown}>
        {header}
        <Alert variant="destructive">
          <AlertTitle>{t('ventilation.modelDidntLoad', 'The model didn’t load', { ns: 'editor' })}</AlertTitle>
          <AlertDescription>
            {error}
            {onRetry && (
              <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
                {t('ventilation.tryAgain', 'Try again', { ns: 'editor' })}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </section>
    )
  }

  if (!model) {
    return (
      <section className="flex flex-col gap-3" aria-label={t('ventilation.title', 'Ventilation', { ns: 'editor' })} aria-busy="true">
        {header}
        <p className="text-xs text-muted-foreground">{t('ventilation.loadingModel', 'Loading the model…', { ns: 'editor' })}</p>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-24 w-full" />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3" aria-label={t('ventilation.title', 'Ventilation', { ns: 'editor' })} onKeyDown={onKeyDown}>
      {header}

      <div className="flex flex-col gap-2">
        <Select value={scopeChoice} onValueChange={(v) => setScopeChoice(v === 'level' ? 'level' : 'model')}>
          <SelectTrigger size="sm" aria-label={t('ventilation.whichSpaces', 'Which spaces', { ns: 'editor' })}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="level" disabled={!levelId}>
              {levelId
                ? levelName
                  ? t('ventilation.thisLevelNamed', 'This level ({{name}})', { ns: 'editor', name: levelName })
                  : t('ventilation.thisLevel', 'This level', { ns: 'editor' })
                : t('ventilation.thisLevelNeedsPlan', 'This level: open a floor plan first', { ns: 'editor' })}
            </SelectItem>
            <SelectItem value="model">{t('ventilation.wholeModel', 'Whole model', { ns: 'editor' })}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('ventilation.governing', 'Governing', { ns: 'editor' })}</span>
          <ToggleGroup type="single" size="sm" variant="outline" value={governing.standard} onValueChange={(v) => v && setAsked(v === 'ashrae_62_1' ? 'ashrae_62_1' : 'imc')} aria-label={t('ventilation.governingStandard', 'Governing standard', { ns: 'editor' })}>
            <ToggleGroupItem value="imc">IMC</ToggleGroupItem>
            <ToggleGroupItem value="ashrae_62_1">{t('ventilation.ashrae621', 'ASHRAE 62.1', { ns: 'editor' })}</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setFullOpen(true)} disabled={!view || view.rows.length === 0} title={!view || view.rows.length === 0 ? t('ventilation.noSpacesToShow', 'There are no spaces to show yet.', { ns: 'editor' }) : t('ventilation.everyColumn', 'Every column, both standards', { ns: 'editor' })}>
            <Maximize2 />
            {t('ventilation.fullTable', 'Full table', { ns: 'editor' })}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="ventilation-governing">
          {governing.text}
          {governing.from === 'asked' && adopted.standard !== governing.standard
            ? t('ventilation.adoptedCodeIs', ' The adopted code is {{code}}; this switch is for this view only.', { ns: 'editor', code: VENTILATION_STANDARDS[adopted.standard].label })
            : ''}
        </p>
      </div>

      {scope === null && <p className="text-xs text-muted-foreground">{t('ventilation.openPlanToList', 'Open a floor plan to list the spaces on its level, or choose Whole model.', { ns: 'editor' })}</p>}

      {computed && 'failure' in computed && (
        <Alert variant="destructive">
          <AlertTitle>{t('ventilation.tableFailed', 'The ventilation table couldn’t be worked out', { ns: 'editor' })}</AlertTitle>
          <AlertDescription>
            {computed.failure}
            {t('ventilation.tableFailedWhy', '. Try another level, or reload the page; if it keeps happening, tell the team which model this is.', { ns: 'editor' })}
          </AlertDescription>
        </Alert>
      )}

      {view?.empty && (
        <Empty className="border p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Fan />
            </EmptyMedia>
            <EmptyTitle>{t('ventilation.noOutdoorAir', 'No outdoor air to show', { ns: 'editor' })}</EmptyTitle>
            <EmptyDescription>{view.empty}</EmptyDescription>
          </EmptyHeader>
          {onOpenSpaces && (
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={onOpenSpaces}>
                {t('ventilation.openSpaces', 'Open Spaces', { ns: 'editor' })}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      {view && !view.empty && (
        <>
          <Table>
            <TableCaption>
              {t('ventilation.totalOutdoorAirLabel', 'Total outdoor air:', { ns: 'editor' })} <span data-testid="ventilation-total">{view.total}</span>
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ventilation.space', 'Space', { ns: 'editor' })}</TableHead>
                <TableHead className="text-right">{t('ventilation.people', 'People', { ns: 'editor' })}</TableHead>
                <TableHead className="text-right">{t('ventilation.voz', 'Voz', { ns: 'editor' })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.rows.map((r) => (
                <TableRow key={r.spaceId} data-state={selected === r.spaceId ? 'selected' : undefined} className="cursor-pointer" onClick={() => setSelected(r.spaceId === selected ? null : r.spaceId)} data-testid={`ventilation-row-${r.spaceId}`}>
                  <TableCell className="max-w-32">
                    <Button variant="link" size="xs" className="h-auto max-w-full justify-start truncate p-0 text-foreground" aria-expanded={selected === r.spaceId} title={`${r.label}: ${r.use}`}>
                      {r.label}
                    </Button>
                    <span className="block truncate text-xs text-muted-foreground">{r.use}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.people}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.problem && r.voz === '—' ? <Badge variant="outline">{t('ventilation.cantCalculate', 'can’t calculate', { ns: 'editor' })}</Badge> : r.voz}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {detail && <SpaceDetail row={detail} onSelectSpace={onSelectSpace} t={t} />}

          {view.zones.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold">{t('ventilation.zones', 'Zones', { ns: 'editor' })}</h3>
              {view.zones.map((z) => (
                <div key={z.zoneId} className="rounded-md border p-2 text-xs" data-testid={`ventilation-zone-${z.zoneId}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{z.name}</span>
                    <span className="ml-auto tabular-nums">{z.voz}</span>
                  </div>
                  {z.problem && <p className="text-destructive">{z.problem}</p>}
                  <p className="text-muted-foreground">
                    {z.unit
                      ? t('ventilation.unitOutdoorAir', '{{unit}} outdoor air: {{value}}', { ns: 'editor', unit: z.unit, value: z.unitOa })
                      : t('ventilation.noServingUnit', 'No serving unit', { ns: 'editor' })}
                    {z.verdict === 'meets' && <Badge variant="secondary" className="ml-1">{t('ventilation.enough', 'enough', { ns: 'editor' })}</Badge>}
                    {z.verdict === 'short' && <Badge variant="destructive" className="ml-1">{t('ventilation.short', 'short', { ns: 'editor' })}</Badge>}
                  </p>
                  <p className="text-muted-foreground">{z.note}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Separator />
      <PressurizationSection model={model} scope={scope} {...(onSelectSpace ? { onSelectPart: onSelectSpace } : {})} />

      <Dialog open={fullOpen} onOpenChange={setFullOpen}>
        <DialogContent className="max-h-[85vh] max-w-6xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{t('ventilation.tableCommand', 'Ventilation table', { ns: 'editor' })}</DialogTitle>
            <DialogDescription>{governing.text}</DialogDescription>
          </DialogHeader>
          {view && <FullTable view={view} t={t} />}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function SpaceDetail({ row, onSelectSpace, t }: { readonly row: VentilationRow; readonly onSelectSpace?: (id: ElementId) => void; readonly t: Translate }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-2 text-xs" data-testid="ventilation-detail">
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.label}</span>
        {onSelectSpace && (
          <Button variant="link" size="xs" className="ml-auto" onClick={() => onSelectSpace(row.spaceId)}>
            {t('ventilation.showOnPlan', 'Show on plan', { ns: 'editor' })}
          </Button>
        )}
      </div>
      {row.problem && <p className={row.voz === '—' ? 'text-destructive' : 'text-muted-foreground'}>{row.problem}</p>}
      {row.arithmetic && <p className="tabular-nums">{row.arithmetic}</p>}
      <dl className="grid grid-cols-2 gap-x-2 tabular-nums">
        <dt className="text-muted-foreground">{t('ventilation.area', 'Area', { ns: 'editor' })}</dt>
        <dd>{row.area}</dd>
        <dt className="text-muted-foreground">{t('ventilation.people', 'People', { ns: 'editor' })}</dt>
        <dd>
          {row.people} {row.peopleFrom}
        </dd>
        <dt className="text-muted-foreground">{t('ventilation.rpRa', 'Rp / Ra', { ns: 'editor' })}</dt>
        <dd>
          {row.rp} / {row.ra}
        </dd>
        <dt className="text-muted-foreground">{t('ventilation.vbzEz', 'Vbz / Ez', { ns: 'editor' })}</dt>
        <dd>
          {row.vbz} / {row.ez}
        </dd>
        <dt className="text-muted-foreground">{t('ventilation.exhaust', 'Exhaust', { ns: 'editor' })}</dt>
        <dd>{row.exhaust}</dd>
        {row.byStandard.map((s) => (
          <FragmentPair key={s.id} label={`${s.label}${s.governing ? t('ventilation.governingParen', ' (governing)', { ns: 'editor' }) : ''}`} value={s.voz} />
        ))}
      </dl>
      {row.exhaustNote && <p className="text-muted-foreground">{t('ventilation.exhaustColon', 'Exhaust: {{note}}', { ns: 'editor', note: row.exhaustNote })}</p>}
      {row.cites.length > 0 && <p className="text-muted-foreground">{row.cites.join(' · ')}</p>}
    </div>
  )
}

function FragmentPair({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

function FullTable({ view, t }: { readonly view: VentilationView; readonly t: Translate }) {
  const standards = view.rows[0]?.byStandard ?? []
  return (
    <Table>
      <TableCaption>
        {t('ventilation.fullTableCaption', 'Total outdoor air {{total}}. Rates from the space-use library (IMC 2021 Table 403.3.1.1, ASHRAE 62.1-2019 Table 6-1), not yet checked against a code library record.', { ns: 'editor', total: view.total })}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('ventilation.space', 'Space', { ns: 'editor' })}</TableHead>
          <TableHead>{t('ventilation.use', 'Use', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('ventilation.people', 'People', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('ventilation.area', 'Area', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('ventilation.rp', 'Rp', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('ventilation.ra', 'Ra', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('ventilation.vbz', 'Vbz', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('ventilation.ez', 'Ez', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('ventilation.voz', 'Voz', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('ventilation.exhaust', 'Exhaust', { ns: 'editor' })}</TableHead>
          {standards.map((s) => (
            <TableHead key={s.id} className="text-right">
              {s.label}
              {s.governing ? t('ventilation.governingParen', ' (governing)', { ns: 'editor' }) : ''}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {view.rows.map((r) => (
          <TableRow key={r.spaceId}>
            <TableCell>{r.label}</TableCell>
            <TableCell>{r.use}</TableCell>
            <TableCell className="text-right tabular-nums">{r.people}</TableCell>
            <TableCell className="text-right tabular-nums">{r.area}</TableCell>
            <TableCell className="text-right tabular-nums">{r.rp}</TableCell>
            <TableCell className="text-right tabular-nums">{r.ra}</TableCell>
            <TableCell className="text-right tabular-nums">{r.vbz}</TableCell>
            <TableCell className="text-right tabular-nums">{r.ez}</TableCell>
            <TableCell className="text-right tabular-nums">{r.problem && r.voz === '—' ? r.problem : r.voz}</TableCell>
            <TableCell className="text-right tabular-nums">{r.exhaust}</TableCell>
            {r.byStandard.map((s) => (
              <TableCell key={s.id} className="text-right tabular-nums">
                {s.voz}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
