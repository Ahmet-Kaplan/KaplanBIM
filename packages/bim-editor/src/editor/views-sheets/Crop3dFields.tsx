'use client'

import { useState } from 'react'
import { Axis3d, Camera, Expand, Ruler } from 'lucide-react'
import { describeWorkingAngle, normalizeBox, type CropBox3d } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { Input } from '../../ui/input'

import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { useEditorTranslate, type Translate } from '../i18n/translate'


const FT = 304.8

export interface Crop3dControls {
  readonly box: CropBox3d | null
  readonly on: boolean
  readonly shown: boolean
  readonly set: (change: { readonly enabled?: boolean; readonly show?: boolean }) => void
  readonly setBox: (box: CropBox3d, label: string) => string | null
  readonly reset: () => void
  /** Save the camera you are looking from now as this view's camera. */
  readonly useCamera: () => string | null
  /** The working angle in this view. */
  readonly workingAngleDeg: number
  /** Turn the box about its middle to the working angle, size kept. Returns the refusal, if any. */
  readonly alignToWorkingAngle: () => string | null
  /** Pick a building edge in the view; the box turns square to it. */
  readonly alignToEdge: () => void
  /** Why aligning can't run (null when it can). */
  readonly alignBlocked: string | null
}

type BoxField = 'width' | 'depth' | 'height' | 'bottom' | 'turn'


/** The five numbers a 3D crop box has, in the language on screen. */
function boxLabel(field: BoxField, t: Translate): string {
  switch (field) {
    case 'width':
      return t('crop3d.width', 'Width, east–west (ft)', { ns: 'editor' })
    case 'depth':
      return t('crop3d.depth', 'Depth, north–south (ft)', { ns: 'editor' })
    case 'height':
      return t('crop3d.height', 'Height (ft)', { ns: 'editor' })
    case 'bottom':
      return t('crop3d.bottom', 'Bottom elevation (ft)', { ns: 'editor' })
    case 'turn':
      return t('crop3d.turn', 'Turn (degrees)', { ns: 'editor' })
  }
}


/** A box with one of its numbers changed: sizes grow about the centre; the bottom moves the box up or down. */
export function boxWith(box: CropBox3d, field: BoxField, value: number): CropBox3d {
  switch (field) {
    case 'width':
      return normalizeBox({ ...box, halfSize: { ...box.halfSize, x: (value * FT) / 2 } })
    case 'depth':
      return normalizeBox({ ...box, halfSize: { ...box.halfSize, y: (value * FT) / 2 } })
    case 'height':
      // Keep the bottom where it is: a taller box grows upward.
      return normalizeBox({ ...box, center: { ...box.center, z: box.center.z - box.halfSize.z + (value * FT) / 2 }, halfSize: { ...box.halfSize, z: (value * FT) / 2 } })
    case 'bottom':
      return normalizeBox({ ...box, center: { ...box.center, z: value * FT + box.halfSize.z } })
    case 'turn':
      return normalizeBox({ ...box, rotationDeg: value })
  }
}

function valueOf(box: CropBox3d, field: BoxField): number {
  switch (field) {
    case 'width':
      return (box.halfSize.x * 2) / FT
    case 'depth':
      return (box.halfSize.y * 2) / FT
    case 'height':
      return (box.halfSize.z * 2) / FT
    case 'bottom':
      return (box.center.z - box.halfSize.z) / FT
    case 'turn':
      return box.rotationDeg
  }
}

/** A 3D view's crop box: on/off, shown or not, its size in feet, its turn, reset, and saving the camera. */

export function Crop3dFields({ controls, canEdit, disabledHint }: { controls: Crop3dControls; canEdit: boolean; disabledHint: string | undefined }) {
  const t = useEditorTranslate()
  const [error, setError] = useState<string | null>(null)

  const { box, on, shown } = controls
  const fields: readonly BoxField[] = ['width', 'depth', 'height', 'bottom', 'turn']
  return (
    <FieldSet data-testid="crop-3d-properties">

      <FieldLegend variant="label">{t('crop3d.title', '3D crop box', { ns: 'editor' })}</FieldLegend>

      <FieldGroup className="gap-2">
        <Field orientation="horizontal">
          <Checkbox id="vp-crop3d-on" checked={on} disabled={!canEdit} onCheckedChange={(v) => controls.set({ enabled: v === true })} />
          <FieldContent>

            <FieldLabel htmlFor="vp-crop3d-on" className="font-normal">
              {t('crop3d.cropToBox', 'Crop to the box', { ns: 'editor' })}
            </FieldLabel>
            <FieldDescription className="text-xs">
              {on
                ? t('crop3d.onlyInside', 'Only what is inside the box shows, live and on sheets.', { ns: 'editor' })
                : t('crop3d.showingEverything', 'Showing everything.', { ns: 'editor' })}
            </FieldDescription>

          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="vp-crop3d-show" checked={shown} disabled={!canEdit} onCheckedChange={(v) => controls.set({ show: v === true })} />
          <FieldContent>

            <FieldLabel htmlFor="vp-crop3d-show" className="font-normal">
              {t('crop3d.showBox', 'Show crop box', { ns: 'editor' })}
            </FieldLabel>
            <FieldDescription className="text-xs">
              {t('crop3d.showBoxWhy', 'Its outline and six grips show while working. It never prints.', { ns: 'editor' })}
            </FieldDescription>

          </FieldContent>
        </Field>
        {box && (
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) => (
              <BoxNumber
                key={`${f}:${valueOf(box, f)}`}
                id={`vp-crop3d-${f}`}

                label={boxLabel(f, t)}

                value={valueOf(box, f)}
                disabled={!canEdit}
                allowNegative={f === 'bottom' || f === 'turn'}

                onCommit={(n) => setError(controls.setBox(boxWith(box, f, n), t('crop3d.change', 'change the 3D crop box {{field}}', { ns: 'editor', field: boxLabel(f, t).toLowerCase() })))}

              />
            ))}
          </div>
        )}

        <FieldDescription className="text-xs">
          {disabledHint ?? t('crop3d.howToSize', 'Drag the grips on the box in the view (Shift moves both sides), or type its size and turn here.', { ns: 'editor' })}
        </FieldDescription>

        <div className="flex flex-col gap-1" data-testid="crop-3d-align">
          <div className="grid grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={controls.alignBlocked !== null || (box !== null && Math.abs(box.rotationDeg - controls.workingAngleDeg) < 1e-6)}
                    onClick={() => setError(controls.alignToWorkingAngle())}
                    data-testid="crop-3d-align-working"
                  >

                    <Axis3d data-icon="inline-start" />
                    {t('crop3d.alignToWorkingAngle', 'Align to working angle', { ns: 'editor' })}

                  </Button>
                </span>
              </TooltipTrigger>

              <TooltipContent>
                {controls.alignBlocked ??
                  (box !== null && Math.abs(box.rotationDeg - controls.workingAngleDeg) < 1e-6
                    ? t('crop3d.alreadySquare', 'Already square to the working angle.', { ns: 'editor' })
                    : t('crop3d.turnAboutMiddle', 'Turn the box about its middle so it is square to the building. Its size stays.', { ns: 'editor' }))}
              </TooltipContent>

            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" className="w-full" disabled={controls.alignBlocked !== null} onClick={controls.alignToEdge} data-testid="crop-3d-align-edge">

                    <Ruler data-icon="inline-start" />
                    {t('crop3d.alignToEdge', 'Align to an edge…', { ns: 'editor' })}

                  </Button>
                </span>
              </TooltipTrigger>

              <TooltipContent>
                {controls.alignBlocked ??
                  t('crop3d.alignToEdgeWhy', 'Click a wall, or two points along a building edge, and the box turns square to it.', { ns: 'editor' })}
              </TooltipContent>

            </Tooltip>
          </div>
          <FieldDescription className="text-xs" data-testid="crop-3d-working-angle">

            {t('crop3d.workingAngleHere', 'Working angle here: {{angle}}.', {
              ns: 'editor',
              angle: describeWorkingAngle(controls.workingAngleDeg).toLowerCase(),
            })}

          </FieldDescription>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="sm" className="w-full" disabled={!canEdit} onClick={controls.reset} data-testid="crop-3d-reset">

                  <Expand data-icon="inline-start" />
                  {t('crop3d.resetCrop', 'Reset crop', { ns: 'editor' })}

                </Button>
              </span>
            </TooltipTrigger>

            <TooltipContent>{disabledHint ?? t('crop3d.resetWhy', 'Put the box back around the whole model, linked models included', { ns: 'editor' })}</TooltipContent>

          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="sm" className="w-full" disabled={!canEdit} onClick={() => setError(controls.useCamera())} data-testid="crop-3d-use-camera">

                  <Camera data-icon="inline-start" />
                  {t('crop3d.useThisCamera', 'Use this camera', { ns: 'editor' })}

                </Button>
              </span>
            </TooltipTrigger>

            <TooltipContent>
              {disabledHint ?? t('crop3d.useCameraWhy', 'Save where you are looking from now: the view opens here, and prints from here on a sheet', { ns: 'editor' })}
            </TooltipContent>

          </Tooltip>
        </div>
        {error && (
          <p className="text-xs text-danger-600" role="alert">
            {error}
          </p>
        )}
      </FieldGroup>
    </FieldSet>
  )
}


function BoxNumber({ id, label, value, disabled, allowNegative, onCommit }: { id: string; label: string; value: number; disabled: boolean; allowNegative: boolean; onCommit: (value: number) => void }) {
  const t = useEditorTranslate()
  const [text, setText] = useState(value.toFixed(2).replace(/\.?0+$/, ''))

  const [error, setError] = useState<string | null>(null)
  const commit = () => {
    const n = Number(text)
    if (text.trim() === '' || !Number.isFinite(n) || (!allowNegative && n <= 0)) {

      setError(
        allowNegative
          ? t('crop3d.enterNumber', 'Enter a number, like 10 or -2.5.', { ns: 'editor' })
          : t('crop3d.enterSize', 'Enter a size in feet above zero, like 12 or 12.5.', { ns: 'editor' }),
      )

      return
    }
    setError(null)
    if (Math.abs(n - value) > 1e-6) onCommit(n)
  }
  return (
    <Field>
      <FieldLabel htmlFor={id} className="text-xs">
        {label}
      </FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') setText(value.toFixed(2).replace(/\.?0+$/, ''))
        }}
        className="h-8"
      />
      {error && <FieldDescription className="text-danger-600">{error}</FieldDescription>}
    </Field>
  )
}
