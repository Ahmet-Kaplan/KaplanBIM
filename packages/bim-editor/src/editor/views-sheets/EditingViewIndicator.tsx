'use client'

import { Check } from 'lucide-react'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/** How editing in place ends, in the language on screen. */
function finishEditingHint(t: Translate): string {
  return t('view.finishEditingHint', 'Esc or double-click outside to finish', { ns: 'editor' })
}

/**
 * Floats over the drawing while a placed view is edited in place. It must never
 * take layout space (product decision, Oct 21: the old full-width banner shifted the whole
 * sheet down on enter and up on exit), and only its button takes the pointer so
 * the canvas under it still gets clicks and drags.
 */
export function EditingViewIndicator({ viewName, onDone }: { viewName: string; onDone: () => void }) {
  const t = useEditorTranslate()
  return (
    <Badge
      variant="outline"
      className="pointer-events-none absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)] gap-1.5 rounded-full bg-background/95 py-0.5 pl-3 pr-0.5 font-normal text-foreground shadow-sm"
      role="status"
      aria-live="polite"
      data-testid="editing-view-banner"
    >
      <span className="truncate">
        {t('view.editingNamed', 'Editing {{name}}', { ns: 'editor', name: '' })}<span className="font-medium">{viewName}</span>
      </span>
      <span className="sr-only">. {finishEditingHint(t)}.</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="xs" className="pointer-events-auto rounded-full" onClick={onDone} data-testid="finish-editing-view">
            <Check data-icon="inline-start" />
            {t('view.done', 'Done', { ns: 'editor' })}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{finishEditingHint(t)}</TooltipContent>
      </Tooltip>
    </Badge>
  )
}
