'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Spinner } from '../../ui/spinner'
import { useEditorTranslate } from '../i18n/translate'
import { atLeastWords } from './fire-areas'
import { areaFt2 } from './propose-rooms'
import type { FireAreaControls } from './use-fire-areas'

/**
 * "Fire areas from rated walls": the closed areas the rated walls make on
 * this level, outlined on the plan. Accept adds one as a fire-area zone (one
 * undo step), Accept all adds every one left in one step, Dismiss leaves one
 * out. Close or Esc leaves with nothing more written.
 */
export function FireAreasReview({ fire, editReason, levelName }: { readonly fire: FireAreaControls; readonly editReason: string | null; readonly levelName: string | null }) {
  const t = useEditorTranslate()
  const [refused, setRefused] = useState<string | null>(null)
  const s = fire.state
  if (s.kind === 'idle') return null
  const kind = fire.kinds.find((k) => k.id === fire.pick?.kindId) ?? null
  const levels = kind?.levels ?? []
  const here = levelName ?? t('spaces.thisLevel', 'this level', { ns: 'editor' })

  const picker =
    kind && fire.pick ? (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{t('spaces.wallsRated', 'Walls rated', { ns: 'editor' })}</span>
        {fire.kinds.length > 1 ? (
          <Select value={kind.id} onValueChange={(kindId) => fire.setPick({ kindId, atLeast: fire.kinds.find((k) => k.id === kindId)?.levels?.[0] ?? 1 })}>
            <SelectTrigger size="sm" className="h-7 w-40" aria-label={t('spaces.rating', 'Rating', { ns: 'editor' })} data-testid="fire-areas-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fire.kinds.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <span>({kind.label})</span>
        )}
        {levels.length > 0 ? (
          <Select value={String(fire.pick.atLeast)} onValueChange={(v) => fire.pick && fire.setPick({ kindId: fire.pick.kindId, atLeast: Number(v) })}>
            <SelectTrigger size="sm" className="h-7 w-36" aria-label={t('spaces.atLeast', 'At least', { ns: 'editor' })} data-testid="fire-areas-at-least">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {levels.map((v) => (
                  <SelectItem key={v} value={String(v)}>
                    {atLeastWords(kind, v, t)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <span>{atLeastWords(kind, fire.pick.atLeast, t)}</span>
        )}
      </div>
    ) : null

  if (s.kind === 'loading')
    return (
      <div className="flex items-center gap-2 text-sm" role="status" data-testid="fire-areas-loading">
        <Spinner />
        {t('spaces.findingClosedRatedAreas', 'Finding the closed rated areas on {{level}}…', { ns: 'editor', level: here })}
      </div>
    )
  if (s.kind === 'error' || s.kind === 'empty')
    return (
      <Alert variant={s.kind === 'error' ? 'destructive' : 'default'} data-testid={s.kind === 'error' ? 'fire-areas-error' : 'fire-areas-empty'}>
        <AlertTitle>{s.kind === 'error' ? t('spaces.fireAreasNotFoundTitle', 'Fire areas couldn’t be found', { ns: 'editor' }) : t('spaces.noFireAreasToAdd', 'No fire areas to add', { ns: 'editor' })}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>{s.message}</span>
          {picker}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={fire.start} disabled={fire.reason !== null} title={fire.reason ?? undefined}>
              {t('spaces.tryAgain', 'Try again', { ns: 'editor' })}
            </Button>
            <Button size="sm" variant="ghost" onClick={fire.close} data-testid="fire-areas-close">
              {t('spaces.close', 'Close', { ns: 'editor' })}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )

  const pending = s.rows.filter((r) => r.decision === 'pending').length
  const allReason = editReason ?? (pending === 0 ? t('spaces.everyFireAreaDecided', 'Every fire area here is already added or dismissed.', { ns: 'editor' }) : null)
  const act = (why: string | null) => setRefused(why)
  return (
    <section className="flex flex-col gap-2 rounded border p-2" aria-label={t('spaces.fireAreasFromRatedWalls', 'Fire areas from rated walls', { ns: 'editor' })} data-testid="fire-areas-review">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">
          {t('spaces.fireAreasFound', '{{count}} {{areaWord}} closed by rated walls on {{level}}', {
            ns: 'editor',
            count: s.rows.length,
            areaWord: s.rows.length === 1 ? t('spaces.fireAreaOne', 'fire area', { ns: 'editor' }) : t('spaces.fireAreaMany', 'fire areas', { ns: 'editor' }),
            level: here,
          })}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('spaces.fireAreasReviewHow', 'Outlined on the plan. Each Accept adds a fire-area zone you can Undo; Esc or Close leaves the rest.', { ns: 'editor' })}
          {s.alreadyZones > 0 ? t('spaces.moreAlreadyHaveZone', ' {{count}} more already have a fire-area zone.', { ns: 'editor', count: s.alreadyZones }) : ''}
        </p>
        {picker}
      </div>
      {refused ? (
        <Alert variant="destructive" data-testid="fire-areas-refused">
          <AlertDescription>{refused}</AlertDescription>
        </Alert>
      ) : null}
      <ItemGroup className="max-h-64 overflow-auto">
        {s.rows.map((r, i) => {
          const acceptReason =
            r.decision === 'added'
              ? t('spaces.fireAreaAddedWhy', 'Added: it is in the zones list below.', { ns: 'editor' })
              : r.decision === 'dismissed'
                ? t('spaces.fireAreaDismissedWhy', 'Dismissed: press Dismissed to bring it back.', { ns: 'editor' })
                : editReason
          return (
            <Item key={r.proposal.key} size="sm" variant="outline" data-testid="fire-area-proposal" data-area={r.proposal.key} data-decision={r.decision}>
              <ItemContent>
                <ItemTitle>
                  {t('spaces.fireAreaName', 'Fire area {{number}}', { ns: 'editor', number: i + 1 })}
                  {r.decision === 'added' ? (
                    <Badge variant="secondary">{t('spaces.added', 'Added', { ns: 'editor' })}</Badge>
                  ) : r.decision === 'dismissed' ? (
                    <Badge variant="outline">{t('spaces.dismissed', 'Dismissed', { ns: 'editor' })}</Badge>
                  ) : null}
                </ItemTitle>
                <ItemDescription>
                  {t('spaces.fireAreaRow', '{{area}} sq ft · closed by {{count}} rated {{wallWord}}', {
                    ns: 'editor',
                    area: areaFt2(r.proposal).toLocaleString('en-US'),
                    count: r.proposal.elementIds.length,
                    wallWord: r.proposal.elementIds.length === 1 ? t('spaces.wallOne', 'wall', { ns: 'editor' }) : t('spaces.wallMany', 'walls', { ns: 'editor' }),
                  })}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  size="sm"
                  onClick={() => act(fire.accept(r.proposal.key))}
                  disabled={acceptReason !== null}
                  title={acceptReason ?? t('spaces.acceptFireAreaWhy', 'Adds it as a fire-area zone; Undo takes it back', { ns: 'editor' })}
                  aria-label={t('spaces.acceptFireAreaNamed', 'Accept fire area {{number}}', { ns: 'editor', number: i + 1 })}
                  data-testid="fire-area-accept"
                >
                  <Check data-icon="inline-start" />
                  {t('spaces.accept', 'Accept', { ns: 'editor' })}
                </Button>
                <Button
                  size="sm"
                  variant={r.decision === 'dismissed' ? 'secondary' : 'ghost'}
                  aria-pressed={r.decision === 'dismissed'}
                  onClick={() => fire.dismiss(r.proposal.key)}
                  disabled={r.decision === 'added'}
                  title={r.decision === 'added' ? t('spaces.fireAreaAddedUndo', 'Added: Undo takes it back.', { ns: 'editor' }) : undefined}
                  aria-label={t('spaces.dismissFireAreaNamed', 'Dismiss fire area {{number}}', { ns: 'editor', number: i + 1 })}
                  data-testid="fire-area-dismiss"
                >
                  <X data-icon="inline-start" />
                  {r.decision === 'dismissed' ? t('spaces.dismissed', 'Dismissed', { ns: 'editor' }) : t('spaces.dismiss', 'Dismiss', { ns: 'editor' })}
                </Button>
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => act(fire.acceptAll())}
          disabled={allReason !== null}
          title={allReason ?? t('spaces.acceptAllFireAreasWhy', 'Adds every fire area not added or dismissed, in one step; Undo takes them all back', { ns: 'editor' })}
          data-testid="fire-areas-accept-all"
        >
          {t('spaces.acceptAll', 'Accept all', { ns: 'editor' })}
        </Button>
        <Button size="sm" variant="ghost" onClick={fire.close} data-testid="fire-areas-close">
          {t('spaces.closeEsc', 'Close (Esc)', { ns: 'editor' })}
        </Button>
      </div>
    </section>
  )
}
