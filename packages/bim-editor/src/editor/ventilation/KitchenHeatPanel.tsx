'use client'

import { useMemo, type KeyboardEvent } from 'react'
import { CircleAlert, Flame, X } from 'lucide-react'
import { elementsOfKind, type ElementId, type ModelState } from '@permitzip/bim-kernel'
import { heatGainLocator, spaceHeatGainNeed, type KitchenHeatSources, type SpaceHeatGainNeed } from '@permitzip/bim-pack-mechanical'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Skeleton } from '../../ui/skeleton'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { useKitchenHeatTablesFrom } from './kitchen-heat-client'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

export interface KitchenHeatPanelProps {
  readonly model: ModelState | null
  readonly error: string | null
  /** The plan the person is on; null lists the whole model. */
  readonly levelId: ElementId | null
  readonly levelName: string | null
  readonly projectId?: string | null
  readonly onSelectSpace: (spaceId: ElementId) => void
  readonly onOpenSpaces: () => void
  readonly onClose: () => void
}

interface Row {
  readonly spaceId: ElementId
  readonly label: string
  readonly need: SpaceHeatGainNeed
}

/** Every space on the level (or in the model) with kitchen equipment in it, and the heat each gains. */
export function kitchenHeatSpaceRows(model: ModelState, levelId: ElementId | null, tables: Pick<KitchenHeatSources, 'firm' | 'project'>, t: Translate = englishOnly): Row[] {
  const locator = heatGainLocator(model.elements)
  const out: Row[] = []
  for (const space of elementsOfKind(model.elements, 'space')) {
    if (levelId && space.levelId !== levelId) continue
    const need = spaceHeatGainNeed(model.elements, space.id, { firm: tables.firm, project: tables.project }, locator)
    if (need) out.push({ spaceId: space.id, label: [space.number, space.name].filter((p) => p.trim().length > 0).join(' ') || t('ventilation.unnamedSpace', 'Unnamed space', { ns: 'editor' }), need })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'en-US', { numeric: true }))
}

/**
 * Building Model › Mechanical › Analyze › Kitchen heat…: each space with kitchen
 * equipment and the heat it gains from the firm's (or the project's) table,
 * or where to add the table. Read only; Select puts the space in Properties,
 * where its Loads show the same line. Esc closes.
 */
export function KitchenHeatPanel({ model, error, levelId, levelName, projectId, onSelectSpace, onOpenSpaces, onClose }: KitchenHeatPanelProps) {
  const t = useEditorTranslate()
  const tables = useKitchenHeatTablesFrom(useEditorHost().data.firmLibrary, projectId)
  const rows = useMemo(() => (model && tables.status === 'ready' ? kitchenHeatSpaceRows(model, levelId, tables, t) : null), [model, levelId, tables, t])
  const noTable = rows !== null && rows.length > 0 && rows.every((r) => r.need.state === 'needs_table')
  const where = levelId ? (levelName ?? t('ventilation.thisLevel', 'this level', { ns: 'editor' })) : t('ventilation.theModel', 'the model', { ns: 'editor' })

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }

  return (
    <section className="flex flex-col gap-3 p-3" aria-label={t('ventilation.kitchenHeat', 'Kitchen heat', { ns: 'editor' })} onKeyDown={onKeyDown} data-testid="kitchen-heat-panel">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Flame aria-hidden="true" />
          {t('ventilation.kitchenHeatOn', 'Kitchen heat on {{where}}', { ns: 'editor', where })}
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label={t('ventilation.closeKitchenHeat', 'Close kitchen heat', { ns: 'editor' })} title={t('ventilation.closeEsc', 'Close (Esc)', { ns: 'editor' })} onClick={onClose}>
          <X />
        </Button>
      </header>

      {error || tables.status === 'error' ? (
        <Alert data-testid="kitchen-heat-panel-error">
          <CircleAlert />
          <AlertTitle>{t('ventilation.kitchenHeatFailed', 'Kitchen heat can’t be shown', { ns: 'editor' })}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {error ?? tables.error}
            {tables.status === 'error' ? (
              <Button size="sm" variant="outline" onClick={tables.retry}>
                {t('ventilation.tryAgain', 'Try again', { ns: 'editor' })}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : rows === null ? (
        <div className="flex flex-col gap-2" data-testid="kitchen-heat-panel-loading" aria-label={t('ventilation.readingModelAndHeat', 'Reading the model and the kitchen heat table', { ns: 'editor' })}>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ) : rows.length === 0 ? (
        <Empty className="border py-4" data-testid="kitchen-heat-panel-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Flame />
            </EmptyMedia>
            <EmptyTitle>{t('ventilation.noKitchenEquipmentOn', 'No kitchen equipment in a space on {{where}}', { ns: 'editor', where })}</EmptyTitle>
            <EmptyDescription>
              {t(
                'ventilation.noKitchenEquipmentWhy',
                'Place a part whose type names its kitchen appliance (Fryer, Range) inside a drawn space, and its heat shows here and in the space’s Loads.',
                { ns: 'editor' },
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" variant="outline" onClick={onOpenSpaces}>
              {t('ventilation.openSpaces', 'Open Spaces', { ns: 'editor' })}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {noTable ? (
            <Alert data-testid="kitchen-heat-panel-needs-table">
              <CircleAlert />
              <AlertTitle>{t('ventilation.noHeatTableYet', 'No kitchen heat table yet', { ns: 'editor' })}</AlertTitle>
              <AlertDescription>
                {t(
                  'ventilation.noHeatTableWhy',
                  'Add a kitchen heat table in the firm library › Lookup tables. The add-on ships no numbers, so nothing is added until a table with a citation is there.',
                  { ns: 'editor' },
                )}
              </AlertDescription>
            </Alert>
          ) : null}
          <Table data-testid="kitchen-heat-panel-rows">
            <TableCaption className="sr-only">{t('ventilation.heatEachSpace', 'Heat each space gains from its kitchen equipment', { ns: 'editor' })}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ventilation.space', 'Space', { ns: 'editor' })}</TableHead>
                <TableHead>{t('ventilation.heatGain', 'Heat gain', { ns: 'editor' })}</TableHead>
                <TableHead>
                  <span className="sr-only">{t('ventilation.select', 'Select', { ns: 'editor' })}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.spaceId} data-testid="kitchen-heat-panel-row" data-space={r.spaceId} data-state={r.need.state}>
                  <TableCell className="text-xs">{r.label}</TableCell>
                  <TableCell className="text-xs" title={[r.need.detail, ...r.need.missing].filter(Boolean).join('\n') || undefined}>
                    {r.need.state === 'heat' ? r.need.line : t('ventilation.needsATable', 'Needs a table', { ns: 'editor' })}
                    {r.need.missing.length > 0 ? (
                      <span className="block text-warning-700">
                        {r.need.missing.length === 1
                          ? t('ventilation.oneApplianceNoRow', '1 appliance has no row', { ns: 'editor' })
                          : t('ventilation.appliancesNoRow', '{{count}} appliances have no row', { ns: 'editor', count: r.need.missing.length })}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => onSelectSpace(r.spaceId)} aria-label={t('ventilation.selectWhat', 'Select {{name}}', { ns: 'editor', name: r.label })}>
                      {t('ventilation.select', 'Select', { ns: 'editor' })}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </section>
  )
}
