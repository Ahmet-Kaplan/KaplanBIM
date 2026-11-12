'use client'

import { useEffect, useState } from 'react'
import { Undo2, X } from 'lucide-react'
import type { ModelViewer3D } from '@permitzip/bim-viewer-3d'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { useEditorTranslate } from './i18n/translate'

/**
 * After a wheel zoom carries the eye through the surface it zoomed toward
 * (into a wall, under a roof): say so, and offer the way back. The zoom
 * itself never stops at a surface and nothing moves the eye on its own
 * (an internal design note, section 4).
 */
export function ZoomThroughNotice({ viewer }: { readonly viewer: ModelViewer3D }) {
  const t = useEditorTranslate()
  const [passed, setPassed] = useState(false)
  useEffect(() => viewer.onPassThroughChange(setPassed), [viewer])
  if (!passed) return null
  return (
    <div className="absolute bottom-3 right-3 max-w-xs" data-testid="zoomed-through">
      <Alert>
        <Undo2 />
        <AlertTitle>{t('zoom.throughTitle', 'You zoomed through a surface', { ns: 'editor' })}</AlertTitle>
        <AlertDescription>
          <p>{t('zoom.throughBody', 'The view is inside or behind what you were zooming toward.', { ns: 'editor' })}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => viewer.stepBackOut()} data-testid="step-back-out">
              <Undo2 data-icon="inline-start" />
              {t('zoom.stepBackOut', 'Step back out', { ns: 'editor' })}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => viewer.dismissPassThrough()} aria-label={t('zoom.stayHere', 'Stay here', { ns: 'editor' })}>
              <X data-icon="inline-start" />
              {t('zoom.stayHere', 'Stay here', { ns: 'editor' })}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
