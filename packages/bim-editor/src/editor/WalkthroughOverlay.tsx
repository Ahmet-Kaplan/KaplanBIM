'use client'

import { useEffect, useState } from 'react'
import { Footprints, X } from 'lucide-react'
import type { ModelViewer3D } from '@permitzip/bim-viewer-3d'
import { Button } from '../ui/button'
import { useEditorTranslate } from './i18n/translate'

/**
 * The way into the model and out again: a person 1.62 m tall, walking the
 * storey they entered, with walls that stop them.
 *
 * The viewer owns the walking (the camera, the collider world, the frame
 * budget); this owns the two words and the two buttons, because a viewer draws
 * no chrome and knows nothing about who is looking at the model. While walking
 * it says how to move and how to leave, and it is the only thing on the canvas
 * that takes the pointer — a click on the model captures the pointer instead of
 * selecting an element.
 */
export function WalkthroughOverlay({ viewer }: { readonly viewer: ModelViewer3D }) {
  const t = useEditorTranslate()
  const [walking, setWalking] = useState(() => viewer.walkthroughActive())
  useEffect(() => viewer.onWalkthroughChange(setWalking), [viewer])

  if (!walking) {
    return (
      <div className="absolute bottom-3 left-3">
        <Button size="sm" variant="secondary" className="shadow-sm" onClick={() => viewer.enterWalkthrough()} data-testid="enter-walkthrough">
          <Footprints data-icon="inline-start" />
          {t('walk.enter', 'Walk the model', { ns: 'editor' })}
        </Button>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center" data-testid="walkthrough-hint">
      <div className="pointer-events-auto flex items-center gap-3 rounded-md border bg-background/95 px-3 py-1.5 text-xs shadow-sm">
        <span className="text-muted-foreground">{t('walk.keys', 'W A S D to walk, the pointer looks, Esc leaves', { ns: 'editor' })}</span>
        <Button size="sm" variant="ghost" onClick={() => viewer.exitWalkthrough()} data-testid="leave-walkthrough">
          <X data-icon="inline-start" />
          {t('walk.leave', 'Leave walkthrough', { ns: 'editor' })}
        </Button>
      </div>
    </div>
  )
}
