'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Spinner } from '../../ui/spinner'
import { useEditorTranslate } from '../i18n/translate'
import { areaFt2 } from './propose-rooms'
import type { ProposeControls } from './use-spaces-tool'

/**
 * The rooms "Propose rooms from this drawing" found, for the engineer to
 * accept or reject one by one (or Accept all). Nothing is in the model until
 * "Add … rooms": then the accepted ones become spaces in one undoable step.
 * Cancel or Esc leaves with nothing written. Loading, nothing found and
 * failures each say so.
 */
export function ProposedRoomsReview({ propose, editReason }: { readonly propose: ProposeControls; readonly editReason: string | null }) {
  const t = useEditorTranslate()
  const [refused, setRefused] = useState<string | null>(null)
  const s = propose.state
  if (s.kind === 'idle') return null
  if (s.kind === 'loading')
    return (
      <div className="flex items-center gap-2 text-sm" role="status" data-testid="spaces-propose-loading">
        <Spinner />
        {t('spaces.readingLinesOn', 'Reading the lines on {{drawing}}…', { ns: 'editor', drawing: s.drawing })}
      </div>
    )
  if (s.kind === 'error' || s.kind === 'empty')
    return (
      <Alert variant={s.kind === 'error' ? 'destructive' : 'default'} data-testid={s.kind === 'error' ? 'spaces-propose-error' : 'spaces-propose-empty'}>
        <AlertTitle>{s.kind === 'error' ? t('spaces.roomsCouldntBeProposed', 'Rooms couldn’t be proposed', { ns: 'editor' }) : t('spaces.noRoomsToPropose', 'No rooms to propose', { ns: 'editor' })}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>{s.message}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={propose.start} disabled={propose.reason !== null}>
              {t('spaces.tryAgain', 'Try again', { ns: 'editor' })}
            </Button>
            <Button size="sm" variant="ghost" onClick={propose.cancel}>
              {t('spaces.close', 'Close', { ns: 'editor' })}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )

  const accepted = s.proposals.filter((p) => p.decision === 'accepted').length
  const pending = s.proposals.filter((p) => p.decision === 'pending').length
  const addReason = editReason ?? (accepted === 0 ? t('spaces.acceptAtLeastOneRoom', 'Accept at least one room first.', { ns: 'editor' }) : null)
  const add = () => {
    const why = propose.commit()
    setRefused(why)
  }
  return (
    <section className="flex flex-col gap-2 rounded border p-2" aria-label={t('spaces.proposedRooms', 'Proposed rooms', { ns: 'editor' })} data-testid="spaces-propose-review">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">
          {t('spaces.roomsProposedFrom', '{{count}} {{roomWord}} proposed from {{drawing}}', {
            ns: 'editor',
            count: s.proposals.length,
            roomWord: s.proposals.length === 1 ? t('spaces.roomOne', 'room', { ns: 'editor' }) : t('spaces.roomMany', 'rooms', { ns: 'editor' }),
            drawing: s.drawing,
          })}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('spaces.proposedReviewHow', 'Dashed on the plan. Nothing is saved until you add them; Esc or Cancel leaves nothing behind.', { ns: 'editor' })}
          {s.alreadySpaces > 0 ? t('spaces.moreAlreadyHaveSpace', ' {{count}} more already have a space.', { ns: 'editor', count: s.alreadySpaces }) : ''}
        </p>
      </div>
      {refused ? (
        <Alert variant="destructive" data-testid="spaces-propose-refused">
          <AlertDescription>{refused}</AlertDescription>
        </Alert>
      ) : null}
      <ItemGroup className="max-h-64 overflow-auto">
        {s.proposals.map((p, i) => (
          <Item key={p.room.key} size="sm" variant="outline" data-testid="spaces-proposal" data-room={p.room.key} data-decision={p.decision}>
            <ItemContent>
              <ItemTitle>
                {t('spaces.roomName', 'Room {{number}}', { ns: 'editor', number: i + 1 })}
                {p.decision === 'accepted' ? (
                  <Badge variant="secondary">{t('spaces.accepted', 'Accepted', { ns: 'editor' })}</Badge>
                ) : p.decision === 'rejected' ? (
                  <Badge variant="outline">{t('spaces.rejected', 'Rejected', { ns: 'editor' })}</Badge>
                ) : null}
              </ItemTitle>
              <ItemDescription>
                {t('spaces.roomRow', '{{area}} sq ft · {{openings}} · {{percent}}% along drawn lines', {
                  ns: 'editor',
                  area: areaFt2(p.room).toLocaleString('en-US'),
                  openings:
                    p.room.openings.length === 0
                      ? t('spaces.noOpenings', 'no openings', { ns: 'editor' })
                      : p.room.openings.length === 1
                        ? t('spaces.oneOpeningKept', '{{count}} opening kept', { ns: 'editor', count: p.room.openings.length })
                        : t('spaces.openingsKept', '{{count}} openings kept', { ns: 'editor', count: p.room.openings.length }),
                  percent: Math.round(p.room.confidence * 100),
                })}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                size="sm"
                variant={p.decision === 'accepted' ? 'default' : 'outline'}
                aria-pressed={p.decision === 'accepted'}
                aria-label={t('spaces.acceptRoomNamed', 'Accept room {{number}}', { ns: 'editor', number: i + 1 })}
                onClick={() => propose.decide(p.room.key, p.decision === 'accepted' ? 'pending' : 'accepted')}
                data-testid="spaces-proposal-accept"
              >
                <Check data-icon="inline-start" />
                {t('spaces.accept', 'Accept', { ns: 'editor' })}
              </Button>
              <Button
                size="sm"
                variant={p.decision === 'rejected' ? 'secondary' : 'ghost'}
                aria-pressed={p.decision === 'rejected'}
                aria-label={t('spaces.rejectRoomNamed', 'Reject room {{number}}', { ns: 'editor', number: i + 1 })}
                onClick={() => propose.decide(p.room.key, p.decision === 'rejected' ? 'pending' : 'rejected')}
                data-testid="spaces-proposal-reject"
              >
                <X data-icon="inline-start" />
                {t('spaces.reject', 'Reject', { ns: 'editor' })}
              </Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={propose.acceptAll}
          disabled={pending === 0}
          title={pending === 0 ? t('spaces.everyRoomDecided', 'Every room is already accepted or rejected.', { ns: 'editor' }) : t('spaces.acceptEveryRoomWhy', 'Accept every room you haven’t rejected', { ns: 'editor' })}
          data-testid="spaces-propose-accept-all"
        >
          {t('spaces.acceptAll', 'Accept all', { ns: 'editor' })}
        </Button>
        <Button
          size="sm"
          onClick={add}
          disabled={addReason !== null}
          title={addReason ?? t('spaces.addAcceptedRoomsWhy', 'Adds the accepted rooms as spaces in one step; Undo takes them all back', { ns: 'editor' })}
          data-testid="spaces-propose-add"
        >
          {accepted === 1
            ? t('spaces.addOneAcceptedRoom', 'Add {{count}} accepted room', { ns: 'editor', count: accepted })
            : t('spaces.addAcceptedRooms', 'Add {{count}} accepted rooms', { ns: 'editor', count: accepted })}
        </Button>
        <Button size="sm" variant="ghost" onClick={propose.cancel} data-testid="spaces-propose-cancel">
          {t('spaces.cancelEsc', 'Cancel (Esc)', { ns: 'editor' })}
        </Button>
      </div>
    </section>
  )
}
