'use client'

import { notClosedWords, openBoundedSpaces, type ElementId, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { useEditorTranslate } from '../i18n/translate'

/**
 * Rooms whose walls opened after an edit ("Office 101 is no longer closed: a
 * wall was moved or removed near the east side"). Each keeps its last
 * outline; Select picks the room and the wall that changed, Undo takes the
 * last edit back.
 */
export function OpenRoomsAlert({ model, onSelect, onUndo }: { readonly model: ModelState; readonly onSelect?: (ids: readonly ElementId[]) => void; readonly onUndo?: () => void }) {
  const t = useEditorTranslate()
  const open = openBoundedSpaces(model.elements)
  if (open.length === 0) return null
  return (
    <Alert variant="destructive" data-testid="spaces-open-rooms">
      <AlertTitle>
        {open.length === 1 ? t('spaces.aRoomNoLongerClosed', 'A room is no longer closed', { ns: 'editor' }) : t('spaces.roomsNoLongerClosed', '{{count}} rooms are no longer closed', { ns: 'editor', count: open.length })}
      </AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        {open.map((s) => {
          const culprit = s.bounds.kind === 'bounded' ? s.bounds.open?.elementId : undefined
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-2" data-testid="spaces-open-room" data-space={s.id}>
              <span>{t('spaces.keepsLastOutline', '{{words}}. It keeps its last outline.', { ns: 'editor', words: notClosedWords(model.elements, s) ?? '' })}</span>
              {onSelect ? (
                <Button size="sm" variant="outline" onClick={() => onSelect(culprit ? [s.id, culprit] : [s.id])}>
                  {t('spaces.select', 'Select', { ns: 'editor' })}
                </Button>
              ) : null}
              {onUndo ? (
                <Button size="sm" variant="outline" onClick={onUndo}>
                  {t('spaces.undo', 'Undo', { ns: 'editor' })}
                </Button>
              ) : null}
            </div>
          )
        })}
      </AlertDescription>
    </Alert>
  )
}
