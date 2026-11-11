'use client'

import { useEffect, useRef, useState } from 'react'
import { parseDrawingScale, type Command, type DrawingUnderlay, type Vec2 } from '@permitzip/bim-kernel'
import { parseToSI, PROFILE_US_FEET_INCHES } from '@permitzip/bim-units'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Skeleton } from '../../ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'
import { useUnderlayPageFrom } from './use-underlays'

interface Props {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly projectId: string
  readonly underlay: DrawingUnderlay | null
  /** Where the first picked point lands in the model (the plan's centre, or the model origin). */
  readonly modelAt: Vec2
  readonly submit: (command: Command, undoLabel: string) => string | null
}

/** A typed distance in feet and inches (24'-0", 24', 288") as millimetres, or why not. */
export function distanceMm(text: string, t: Translate = englishOnly): number | string {
  if (text.trim() === '') return t('spaces.typeTheRealDistance', 'Type the real distance between the two points, such as 24\'-0".', { ns: 'editor' })
  try {
    const mm = parseToSI(text, 'length', PROFILE_US_FEET_INCHES) * 1000
    return mm > 0 ? mm : t('spaces.distanceAboveZero', 'The distance has to be more than zero.', { ns: 'editor' })
  } catch (err) {
    console.error('[CalibrateUnderlayDialog] reading the distance failed', { text, err })
    return t('spaces.distanceUnreadable', '"{{typed}}" isn\'t a length this can read. Try 24\'-0" or 7.3 m.', { ns: 'editor', typed: text })
  }
}

/**
 * Set a drawing's scale (F3): pick two points on the page that are a known
 * distance apart (both ends of a dimension string) and type that distance, or
 * type the printed scale. Until then tracing over it is off, and the panel
 * says so.
 */
export function CalibrateUnderlayDialog({ open, onOpenChange, projectId, underlay, modelAt, submit }: Props) {
  const t = useEditorTranslate()
  const { page } = useUnderlayPageFrom(useEditorHost().data.underlays, projectId, open ? underlay : null)
  const [points, setPoints] = useState<Vec2[]>([])
  const [distance, setDistance] = useState('')
  const [scale, setScale] = useState(`1/8" = 1'-0"`)
  const [tab, setTab] = useState<'points' | 'scale'>('points')
  const [refusal, setRefusal] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (open) {
      setPoints([])
      setDistance('')
      setRefusal(null)
    }
  }, [open, underlay?.id])

  if (!underlay) return null
  const ready = page.state === 'ready' ? page.value : null

  const pick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current
    if (!img || !ready) return
    const box = img.getBoundingClientRect()
    const u = (e.clientX - box.left) / box.width
    const v = (e.clientY - box.top) / box.height
    // Source units: page points (or pixels) from the bottom-left, y up.
    const p = { x: u * ready.width, y: (1 - v) * ready.height }
    setPoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]))
  }

  const parsedDistance = distanceMm(distance, t)
  const pointsReason =
    points.length < 2
      ? points.length === 0
        ? t('spaces.clickTwoPoints', 'Click two points on the drawing.', { ns: 'editor' })
        : t('spaces.clickSecondPoint', 'Click the second point on the drawing.', { ns: 'editor' })
      : typeof parsedDistance === 'string'
        ? parsedDistance
        : null
  const scaleReason = parseDrawingScale(scale) === null ? t('spaces.writeTheScale', 'Write the scale as printed, such as 1/8" = 1\'-0" or 1:100.', { ns: 'editor' }) : null
  const reason = underlay.locked
    ? t('spaces.drawingLocked', '{{drawing}} is locked. Unlock it in the Spaces panel to change its scale.', { ns: 'editor', drawing: underlay.source.name })
    : tab === 'points'
      ? pointsReason
      : scaleReason

  const save = () => {
    if (reason) return
    const calibration: Extract<Command, { type: 'calibrate_underlay' }>['calibration'] =
      tab === 'points' && points[0] && points[1] && typeof parsedDistance === 'number' ? { method: 'two_points', a: points[0], b: points[1], distanceMm: parsedDistance } : { method: 'stated_scale', scale }
    const refused = submit({ type: 'calibrate_underlay', underlayId: underlay.id, calibration, ...(underlay.calibration ? {} : { modelAt }) }, t('spaces.setDrawingScaleCommand', 'Set drawing scale', { ns: 'editor' }))
    if (refused) {
      setRefusal(refused)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="calibrate-underlay-dialog">
        <DialogHeader>
          <DialogTitle>{t('spaces.setTheScaleOf', 'Set the scale of {{drawing}}', { ns: 'editor', drawing: underlay.source.name })}</DialogTitle>
          <DialogDescription>{t('spaces.tracingOffUntilScale', 'Tracing over it stays off until it has a scale, so spaces come out the right size.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v === 'scale' ? 'scale' : 'points')}>
          <TabsList>
            <TabsTrigger value="points">{t('spaces.twoPointsAndDistance', 'Two points and a distance', { ns: 'editor' })}</TabsTrigger>
            <TabsTrigger value="scale" disabled={underlay.source.format !== 'pdf'} title={underlay.source.format !== 'pdf' ? t('spaces.pictureHasNoPrintedSize', 'A picture has no printed size; use two points.', { ns: 'editor' }) : undefined}>
              {t('spaces.printedScale', 'Printed scale', { ns: 'editor' })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="points" className="flex flex-col gap-3">
            {page.state === 'loading' ? (
              <Skeleton className="h-80" aria-busy="true" />
            ) : page.state === 'error' ? (
              <Alert variant="destructive">
                <AlertTitle>{t('spaces.drawingDidntLoad', 'The drawing didn’t load', { ns: 'editor' })}</AlertTitle>
                <AlertDescription>{page.message}</AlertDescription>
              </Alert>
            ) : (
              <div className="relative max-h-[50vh] overflow-auto rounded border">
                {/* eslint-disable-next-line @next/next/no-img-element -- a served page picture, sized by the dialog */}
                <img ref={imgRef} src={page.value.imageUrl} alt={`${underlay.source.name}, page ${underlay.source.page ?? 1}`} className="block w-full cursor-crosshair select-none" onClick={pick} draggable={false} data-testid="calibrate-page" />
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${page.value.width} ${page.value.height}`} preserveAspectRatio="none">
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={page.value.height - p.y} r={Math.max(page.value.width, page.value.height) / 250} fill="var(--mutiny-selection)" />
                  ))}
                  {points[0] && points[1] ? <line x1={points[0].x} y1={page.value.height - points[0].y} x2={points[1].x} y2={page.value.height - points[1].y} stroke="var(--mutiny-selection)" strokeWidth={Math.max(page.value.width, page.value.height) / 600} /> : null}
                </svg>
              </div>
            )}
            <Field data-invalid={points.length >= 2 && typeof parsedDistance === 'string' && distance !== ''}>
              <FieldLabel htmlFor="calibrate-distance">{t('spaces.realDistanceBetweenPoints', 'Real distance between the two points', { ns: 'editor' })}</FieldLabel>
              <Input id="calibrate-distance" placeholder={`24'-0"`} value={distance} onChange={(e) => setDistance(e.target.value)} className="w-40" data-testid="calibrate-distance" />
              <FieldDescription>
                {points.length < 2
                  ? t('spaces.pointsPickedOfTwo', '{{count}} of 2 points picked. Both ends of a dimension string work best.', { ns: 'editor', count: points.length })
                  : t('spaces.clickAgainToStartOver', 'Click again to start over.', { ns: 'editor' })}
              </FieldDescription>
              {points.length >= 2 && distance !== '' && typeof parsedDistance === 'string' ? <FieldError>{parsedDistance}</FieldError> : null}
            </Field>
          </TabsContent>
          <TabsContent value="scale">
            <Field data-invalid={scaleReason !== null}>
              <FieldLabel htmlFor="calibrate-scale">{t('spaces.scalePrintedOnSheet', 'Scale printed on the sheet', { ns: 'editor' })}</FieldLabel>
              <Input id="calibrate-scale" value={scale} onChange={(e) => setScale(e.target.value)} className="w-48" data-testid="calibrate-scale" />
              <FieldDescription>{t('spaces.scaleOnlyForOriginalSize', 'Only right when the PDF is the original sheet size (not shrunk to fit a page). If unsure, use two points.', { ns: 'editor' })}</FieldDescription>
              {scaleReason ? <FieldError>{scaleReason}</FieldError> : null}
            </Field>
          </TabsContent>
        </Tabs>
        {refusal ? (
          <Alert variant="destructive" data-testid="calibrate-refusal">
            <AlertTitle>{t('spaces.scaleWasntSet', 'The scale wasn’t set', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter className="items-center">
          {reason ? <span className="mr-auto text-xs text-muted-foreground" data-testid="calibrate-reason">{reason}</span> : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('spaces.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button onClick={save} disabled={reason !== null} title={reason ?? undefined} data-testid="calibrate-save">
            {t('spaces.setScale', 'Set scale', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
