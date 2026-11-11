'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers, RotateCw } from 'lucide-react'
import { levelHeightLabel, planLevelSync, type Command, type LevelSyncRow, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Spinner } from '../../ui/spinner'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import type { LinkedModelStoreys } from '../../contracts/building-model/linked-levels-contract'
import { newElementId } from '../placement'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { fetchLinkedLevelsFrom } from './levels-api'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

type Load = { readonly state: 'loading' } | { readonly state: 'failed'; readonly message: string } | { readonly state: 'ready'; readonly models: readonly LinkedModelStoreys[] }

/** The storeys as the sync command takes them, with a fresh id for each level it might add. */
export function syncStoreysOf(model: LinkedModelStoreys): Extract<Command, { type: 'sync_levels' }>['storeys'] {
  return model.storeys.map((s) => ({ storeyId: s.storeyId, name: s.name, elevationMm: s.elevationMm, levelId: newElementId('lvl') }))
}

export function actionText(row: LevelSyncRow, t: Translate = englishOnly): string {
  switch (row.action) {
    case 'add':
      return row.name === row.storeyName
        ? t('levels.newLevel', 'New level', { ns: 'editor' })
        : t('levels.newLevelNamed', 'New level {{name}}', { ns: 'editor', name: row.name })
    case 'match': {
      const yours = t('levels.yourLevel', 'Your {{name}}', { ns: 'editor', name: row.name })
      return row.before && Math.abs(row.before.elevationMm - row.elevationMm) >= 0.5
        ? t('levels.yourLevelMovedFrom', 'Your {{name}}, moved from {{height}}', { ns: 'editor', name: row.name, height: levelHeightLabel(row.before.elevationMm) })
        : yours
    }
    case 'update': {
      const before = row.before
      if (!before) return t('levels.updated', 'Updated', { ns: 'editor' })
      const parts = [
        before.name !== row.name ? t('levels.renamedFrom', 'renamed from {{name}}', { ns: 'editor', name: before.name }) : null,
        Math.abs(before.elevationMm - row.elevationMm) >= 0.5 ? t('levels.movedFrom', 'moved from {{height}}', { ns: 'editor', height: levelHeightLabel(before.elevationMm) }) : null,
      ].filter((p): p is string => p !== null)
      return parts.length > 0
        ? t('levels.nameAndChanges', '{{name}}, {{changes}}', { ns: 'editor', name: row.name, changes: parts.join(', ') })
        : t('levels.tiedToRenamedStorey', '{{name}}, tied to the renamed storey', { ns: 'editor', name: row.name })
    }
    case 'unchanged':
      return t('levels.upToDate', 'Up to date', { ns: 'editor' })
  }
}

/** The primary button's words: exactly what one click does. */
export function applyLabel(rows: readonly LevelSyncRow[], t: Translate = englishOnly): string {
  const added = rows.filter((r) => r.action === 'add').length
  const changed = rows.filter((r) => r.action === 'update' || r.action === 'match').length
  if (added === 0 && changed === 0) return t('levels.upToDate', 'Up to date', { ns: 'editor' })
  if (added > 0 && changed === 0)
    return added === 1
      ? t('levels.createOneLevel', 'Create {{count}} level', { ns: 'editor', count: added })
      : t('levels.createManyLevels', 'Create {{count}} levels', { ns: 'editor', count: added })
  if (added === 0)
    return changed === 1
      ? t('levels.updateOneLevel', 'Update {{count}} level', { ns: 'editor', count: changed })
      : t('levels.updateManyLevels', 'Update {{count}} levels', { ns: 'editor', count: changed })
  return t('levels.createAndUpdate', 'Create {{added}}, update {{changed}}', { ns: 'editor', added, changed })
}

/**
 * Model › Architect's levels: the linked model's storeys,
 * placed where the model sits, with what one click will do to each. Nothing
 * changes until the button; the whole sync is one change you can undo.
 * Running it again after the architect moves a floor updates that level.
 */
export function ArchitectLevelsDialog({
  projectId,
  model,
  canEdit,
  blockedReason,
  submit,
  onClose,
}: {
  readonly projectId: string
  readonly model: ModelState
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: (command: Command, label: string) => string | null
  readonly onClose: () => void
}) {
  const t = useEditorTranslate()
  const levels = useEditorHost().data.levels
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [chosen, setChosen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    fetchLinkedLevelsFrom(levels, projectId, abort.signal, t)
      .then((res) => {
        setLoad({ state: 'ready', models: res.models })
        setChosen((c) => c ?? res.models.find((m) => m.storeys.length > 0)?.referenceId ?? null)
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return
        console.error("[ArchitectLevelsDialog] reading the architect's storeys failed", err)
        setLoad({ state: 'failed', message: err instanceof Error ? err.message : t('levels.storeysUnread', 'The linked models\' storeys couldn\'t be read.', { ns: 'editor' }) })
      })
    return () => abort.abort()
  }, [levels, projectId, attempt, t])

  const models = load.state === 'ready' ? load.models : []
  const source = models.find((m) => m.referenceId === chosen) ?? null
  const storeys = useMemo(() => (source ? syncStoreysOf(source) : []), [source])
  const plan = useMemo(() => (source && storeys.length > 0 ? planLevelSync(model, source.referenceId, storeys) : null), [model, source, storeys])

  const apply = useCallback(() => {
    if (!source || !plan) return
    const refusal = submit({ type: 'sync_levels', referenceId: source.referenceId, storeys }, t('levels.undo.levelsFrom', 'levels from {{model}}', { ns: 'editor', model: source.label }))
    if (refusal) setError(refusal)
    else onClose()
  }, [source, plan, storeys, submit, onClose])

  const disabledReason = !canEdit
    ? blockedReason
    : plan && !plan.changes
      ? t('levels.alreadyMatch', 'The levels already match {{model}}. Run this again after the architect changes their levels.', {
          ns: 'editor',
          model: source?.label ?? t('levels.theLinkedModel', 'the linked model', { ns: 'editor' }),
        })
      : null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl" data-testid="architect-levels-dialog">
        <DialogHeader>
          <DialogTitle>{t('levels.useArchitectLevels', "Use the architect's levels", { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {t('levels.eachStoreyBecomesLevel', 'Each storey in the linked model becomes a level at the height it sits in this model. It is one change; you can undo it.', { ns: 'editor' })}
          </DialogDescription>
        </DialogHeader>
        {load.state === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Spinner />
            {t('levels.readingStoreys', 'Reading the linked model\'s storeys…', { ns: 'editor' })}
          </div>
        )}
        {load.state === 'failed' && (
          <Alert variant="destructive">
            <AlertTitle>{t('levels.storeysCouldntRead', 'The storeys couldn\'t be read', { ns: 'editor' })}</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              {load.message}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLoad({ state: 'loading' })
                  setAttempt((n) => n + 1)
                }}
              >
                <RotateCw data-icon="inline-start" />
                {t('levels.tryAgain', 'Try again', { ns: 'editor' })}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {load.state === 'ready' && models.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers />
              </EmptyMedia>
              <EmptyTitle>{t('levels.noLinkedModel', 'No linked model to take levels from', { ns: 'editor' })}</EmptyTitle>
              <EmptyDescription>{t('levels.linkModelFirst', "Link the architect's model in the Linked models panel, then come back here. Or close this and add a level by hand.", { ns: 'editor' })}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {models.length > 1 && (
          <Field>
            <FieldLabel htmlFor="bm-levels-source">{t('levels.from', 'From', { ns: 'editor' })}</FieldLabel>
            <Select value={chosen ?? undefined} onValueChange={setChosen}>
              <SelectTrigger id="bm-levels-source">
                <SelectValue placeholder={t('levels.pickLinkedModel', 'Pick a linked model', { ns: 'editor' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {models.map((m) => (
                    <SelectItem key={m.referenceId} value={m.referenceId}>
                      {t('levels.modelWithStoreys', '{{model}} ({{count}} storeys)', { ns: 'editor', model: m.label, count: m.storeys.length })}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
        {source?.problem && (
          <Alert>
            <AlertTitle>{source.label}</AlertTitle>
            <AlertDescription>{source.problem}</AlertDescription>
          </Alert>
        )}
        {plan && (
          <Table data-testid="architect-levels-preview">
            <TableCaption className="sr-only">
            {t('levels.eachStoreyIn', 'Each storey in {{model}}, its height in this model and what happens to it', { ns: 'editor', model: source?.label ?? '' })}
          </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('levels.storey', 'Storey', { ns: 'editor' })}</TableHead>
                <TableHead className="text-right">{t('levels.floor', 'Floor', { ns: 'editor' })}</TableHead>
                <TableHead>{t('levels.whatHappens', 'What happens', { ns: 'editor' })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...plan.rows].reverse().map((row) => (
                <TableRow key={row.storeyId} data-testid="architect-level-row" data-action={row.action}>
                  <TableCell className="font-medium">{row.storeyName}</TableCell>
                  <TableCell className="text-right tabular-nums">{levelHeightLabel(row.elevationMm)}</TableCell>
                  <TableCell className={row.action === 'unchanged' ? 'text-muted-foreground' : undefined}>{actionText(row, t)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {plan && plan.orphaned.length > 0 && (
          <FieldDescription>
            No longer in {source?.label}: {plan.orphaned.map((o) => o.name).join(', ')}. They stay; delete them yourself if you don&apos;t need them.
          </FieldDescription>
        )}
        {(error ?? disabledReason) && (
          <FieldDescription className={error ? 'text-danger-600' : undefined} role={error ? 'alert' : undefined}>
            {error ?? disabledReason}
          </FieldDescription>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('levels.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button type="button" onClick={apply} disabled={!plan || disabledReason !== null} data-testid="architect-levels-apply">
            <Layers data-icon="inline-start" />
            {plan ? applyLabel(plan.rows, t) : t('levels.createLevels', 'Create levels', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
