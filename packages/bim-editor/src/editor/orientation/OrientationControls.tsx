'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Home, LayoutTemplate, Scan } from 'lucide-react'
import type { ModelViewer3D } from '@permitzip/bim-viewer-3d'
import {
  isElevationSide,
  orientationFor,
  PROJECTIONS,
  squareOnSide,
  type ElevationSide,
  type Projection,
  type Side,
  type ViewVector,
} from '@permitzip/bim-viewer-3d/light'
import { Button } from '../../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { PROJECTION_SHORTCUT } from '../building-model-ribbon'

import { OrientationBall } from './OrientationBall'
import { sideLabel } from './words'
import { useEditorTranslate, type Translate } from '../i18n/translate'


/** The flat list of views in the Orientation options menu: the six sides, then the three-quarter views. */
const SIDE_VIEWS: readonly Side[] = ['top', 'south', 'north', 'east', 'west', 'bottom']

export const THREE_QUARTER_VIEWS: ReadonlyArray<{ readonly key: string; readonly west: boolean; readonly north: boolean; readonly view: ViewVector }> = [
  { key: 'southEast', west: false, north: false, view: { x: 1, y: -1, z: 1 } },
  { key: 'southWest', west: true, north: false, view: { x: -1, y: -1, z: 1 } },
  { key: 'northEast', west: false, north: true, view: { x: 1, y: 1, z: 1 } },
  { key: 'northWest', west: true, north: true, view: { x: -1, y: 1, z: 1 } },
]

/** The four three-quarter views (§2.3's norths and easts are the model's own words). */
function threeQuarterLabel(view: { readonly key: string }, t: Translate): string {
  switch (view.key) {
    case 'southEast':
      return t('orientation.aboveSouthEast', 'Above, from the south-east', { ns: 'editor' })
    case 'southWest':
      return t('orientation.aboveSouthWest', 'Above, from the south-west', { ns: 'editor' })
    case 'northEast':
      return t('orientation.aboveNorthEast', 'Above, from the north-east', { ns: 'editor' })
    case 'northWest':
      return t('orientation.aboveNorthWest', 'Above, from the north-west', { ns: 'editor' })
    default:
      return view.key
  }
}

export { sideLabel }

function projectionLabel(projection: Projection, t: Translate): string {
  return projection === 'orthographic'
    ? t('orientation.orthographic', 'Orthographic', { ns: 'editor' })
    : t('orientation.perspective', 'Perspective', { ns: 'editor' })
}


const RAD_TO_DEG = 180 / Math.PI

interface Props {
  readonly viewer: Pick<ModelViewer3D, 'orientation' | 'onCameraChange' | 'orientTo' | 'orbitBy' | 'frame'>
  /** Space to leave on the right (the properties panel), px. */
  readonly rightInset: number
  readonly canCreateViews: boolean
  readonly blockedReason: string
  readonly onCreatePlan: () => void
  readonly onCreateElevation: (side: ElevationSide) => void
  /** Degrees clockwise from plan north to true north: the compass dial's N points there. */
  readonly trueNorthDeg: number
  readonly projection: Projection
  readonly onProjectionChange: (projection: Projection) => void
}

export { projectionLabel }
export const otherProjection = (p: Projection): Projection => (p === 'orthographic' ? 'perspective' : 'orthographic')

/**
 * Orientation controls for the 3D view, top right: the orientation ball, then a
 * flat toolbar with Home, the projection switch, a compass dial whose N is
 * true north, and a menu that lists every preset view. When the camera sits
 * square on the top or a side, it offers to save that as a plan or elevation.
 */
export function OrientationControls({ viewer, rightInset, canCreateViews, blockedReason, onCreatePlan, onCreateElevation, trueNorthDeg, projection, onProjectionChange }: Props) {
  const dialRef = useRef<HTMLSpanElement | null>(null)
  const [squareOn, setSquareOn] = useState<Side | null>(null)
  const [available, setAvailable] = useState(true)

  const follow = useCallback(() => {
    const o = viewer.orientation()
    setAvailable(o !== null)
    if (!o) return
    // Facing north (camera on the south side) puts plan north up; turning to face west puts it on the right.
    if (dialRef.current) dialRef.current.style.transform = `rotate(${(o.azimuth * RAD_TO_DEG + trueNorthDeg).toFixed(2)}deg)`
    setSquareOn(squareOnSide(o))
  }, [viewer, trueNorthDeg])

  useEffect(() => {
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        follow()
      })
    }
    schedule()
    const off = viewer.onCameraChange(schedule)
    return () => {
      off()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [viewer, follow])

  const turnTo = useCallback(
    (view: Side | ViewVector) => {
      void viewer.orientTo(orientationFor(view)).catch((err: unknown) => console.error('[OrientationControls] turning the camera failed', { view, err }))
    },
    [viewer],
  )


  if (!available) return null

  const t = useEditorTranslate()
  const onTop = squareOn === 'top'

  const side = isElevationSide(squareOn) ? squareOn : null

  return (
    <div
      // Only the ball and the toolbar take the pointer; the space around them is the canvas.
      className="pointer-events-none absolute top-3 flex flex-col items-center gap-1.5 *:pointer-events-auto"
      style={{ right: rightInset + 12 }}
      data-testid="orientation-controls"
      data-square-on={squareOn ?? ''}
      data-projection={projection}
    >
      <OrientationBall viewer={viewer} />

      <div
        className="flex items-center gap-1 rounded-md border bg-background/95 p-0.5 shadow-sm"
        role="toolbar"
        aria-label={t('orientation.viewOrientation', 'View orientation', { ns: 'editor' })}
      >

        <Tooltip>
          <TooltipTrigger asChild>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('orientation.homeView', 'Home view', { ns: 'editor' })}
              data-testid="orientation-home"
              onClick={() => void viewer.frame().catch((err: unknown) => console.error('[OrientationControls] home failed', err))}
            >

              <Home />
            </Button>
          </TooltipTrigger>

          <TooltipContent>{t('orientation.homeWhy', 'Home: everything in view from the south-east (F)', { ns: 'editor' })}</TooltipContent>

        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-[11px] font-medium"

              aria-label={t('orientation.projectionToggle', '{{current}} projection. Switch to {{other}}', {
                ns: 'editor',
                current: projectionLabel(projection, t),
                other: projectionLabel(otherProjection(projection), t).toLowerCase(),
              })}

              data-testid="orientation-projection-toggle"
              onClick={() => onProjectionChange(otherProjection(projection))}
            >

              {projection === 'orthographic' ? t('orientation.orthoShort', 'Ortho', { ns: 'editor' }) : t('orientation.perspShort', 'Persp', { ns: 'editor' })}

            </Button>
          </TooltipTrigger>
          <TooltipContent>

            {t('orientation.projectionSwitch', '{{current}}. Switch to {{other}} ({{shortcut}})', {
              ns: 'editor',
              current: projectionLabel(projection, t),
              other: projectionLabel(otherProjection(projection), t).toLowerCase(),
              shortcut: PROJECTION_SHORTCUT,
            })}

          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="img"
              tabIndex={0}

              aria-label={t('orientation.compassAria', 'Compass. True north is {{deg}}° clockwise from plan north.', { ns: 'editor', deg: trueNorthDeg })}

              data-testid="compass-dial"
              data-true-north={trueNorthDeg}
              className="relative flex size-7 items-center justify-center rounded-full border border-muted-foreground/40 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span ref={dialRef} aria-hidden className="absolute inset-0 flex flex-col items-center pt-px">
                <span className="text-[8px] font-bold leading-none text-danger-600">N</span>
                <span className="mt-px h-2 w-0.5 rounded-full bg-danger-600" />
              </span>
            </span>
          </TooltipTrigger>

          <TooltipContent>
            {t('orientation.trueNorthIs', 'True north is {{deg}}° clockwise from plan north. Set it under Manage › True north.', { ns: 'editor', deg: trueNorthDeg })}
          </TooltipContent>

        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>

            <Button variant="ghost" size="icon-sm" aria-label={t('orientation.options', 'Orientation options', { ns: 'editor' })}>

              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">

            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {squareOn
                ? t('orientation.lookingFrom', 'Looking from: {{side}}', { ns: 'editor', side: sideLabel(squareOn, t) })
                : t('orientation.turnTo', 'Turn to', { ns: 'editor' })}
            </DropdownMenuLabel>

            <DropdownMenuGroup>
              {SIDE_VIEWS.map((s) => (

                <DropdownMenuItem key={s} onSelect={() => turnTo(s)}>
                  {sideLabel(s, t)}

                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t('orientation.threeQuarter', 'Three-quarter views', { ns: 'editor' })}
            </DropdownMenuLabel>

            <DropdownMenuGroup>

              {THREE_QUARTER_VIEWS.map((entry) => (
                <DropdownMenuItem key={entry.key} onSelect={() => turnTo(entry.view)}>
                  {threeQuarterLabel(entry, t)}
                </DropdownMenuItem>
              ))}

            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('view.projection', 'Projection', { ns: 'editor' })}</DropdownMenuLabel>

            <DropdownMenuRadioGroup
              value={projection}
              onValueChange={(v) => {
                const picked = PROJECTIONS.find((p) => p === v)
                if (picked) onProjectionChange(picked)
              }}
            >
              {PROJECTIONS.map((p) => (
                <DropdownMenuRadioItem key={p} value={p} data-testid={`orientation-projection-${p}`}>

                  {projectionLabel(p, t)}

                  {p !== projection && <DropdownMenuShortcut>{PROJECTION_SHORTCUT}</DropdownMenuShortcut>}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={!canCreateViews || !onTop} onSelect={onCreatePlan}>
                <LayoutTemplate data-icon="inline-start" />

                {canCreateViews
                  ? onTop
                    ? t('orientation.createPlan', 'Create plan view from here', { ns: 'editor' })
                    : t('orientation.createPlanFirstTop', 'Create plan view from here (turn to Top first)', { ns: 'editor' })
                  : blockedReason}

              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canCreateViews || !side} onSelect={() => side && onCreateElevation(side)}>
                <Scan data-icon="inline-start" />

                {canCreateViews
                  ? side
                    ? t('orientation.createElevation', 'Create {{side}} elevation from here', { ns: 'editor', side: sideLabel(side, t).toLowerCase() })
                    : t('orientation.createElevationFirstSide', 'Create elevation from here (turn to a side first)', { ns: 'editor' })
                  : blockedReason}

              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(onTop || side) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                variant="outline"
                className="bg-background/95 shadow-sm"
                disabled={!canCreateViews}
                data-testid="orientation-create-from-here"
                onClick={() => (onTop ? onCreatePlan() : side && onCreateElevation(side))}
              >
                {onTop ? <LayoutTemplate data-icon="inline-start" /> : <Scan data-icon="inline-start" />}

                {onTop
                  ? t('orientation.planViewFromHere', 'Plan view from here', { ns: 'editor' })
                  : t('orientation.elevationFromHere', '{{side}} elevation from here', {
                      ns: 'editor',
                      side: side ? sideLabel(side, t) : '',
                    })}

              </Button>
            </span>
          </TooltipTrigger>

          <TooltipContent>
            {canCreateViews
              ? onTop
                ? t('orientation.savePlanView', 'Save a floor plan view for a level', { ns: 'editor' })
                : t('orientation.saveElevationView', 'Save this side as an elevation view (a section just outside the model)', { ns: 'editor' })
              : blockedReason}
          </TooltipContent>

        </Tooltip>
      )}
    </div>
  )
}
