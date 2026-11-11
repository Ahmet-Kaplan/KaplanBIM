'use client'

import { useMemo, useState } from 'react'
import { Compass, Crosshair, RotateCcw, Ruler } from 'lucide-react'
import {
  describeWorkingAngle,
  formatSharedFt,
  modelToShared,
  normalizeAngleDeg,
  normalizeWorkingAngleDeg,
  originPointPosition,
  siteWorkingAngleDeg,
  type Command,
  type OriginPoint,
  type SiteFrame,
} from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { Input } from '../../ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { MM_PER_FT } from '../placement'
import { moveOriginCommand, moveOriginLabel, type OriginMoveMode } from '../coordinates'
import { CoordinatesDiagram } from './CoordinatesDiagram'
import { tabForPoint, type CoordinatesTab } from './coordinates-tab'
import { MoveModeChoice } from './MoveModeChoice'
import { useEditorTranslate, type Translate } from '../i18n/translate'

export type { CoordinatesTab } from './coordinates-tab'

/** The four things this dialog sets, in the language on screen. */
function tabLabel(tab: CoordinatesTab, t: Translate): string {
  switch (tab) {
    case 'origin':
      return t('coordinates.tabOrigin', 'Project origin', { ns: 'editor' })
    case 'site_point':
      return t('coordinates.tabSitePoint', 'Site point', { ns: 'editor' })
    case 'north':
      return t('coordinates.tabNorth', 'North', { ns: 'editor' })
    case 'working_angle':
      return t('coordinates.tabWorkingAngle', 'Working angle', { ns: 'editor' })
  }
}

const TABS: readonly CoordinatesTab[] = ['origin', 'site_point', 'north', 'working_angle']

function isTab(value: string): value is CoordinatesTab {
  return TABS.some((t) => t === value)
}

export { tabForPoint }

const pointOfTab = (tab: CoordinatesTab): Exclude<OriginPoint, 'internal_origin'> | null => (tab === 'origin' ? 'project_base_point' : tab === 'site_point' ? 'survey_point' : null)

const ft = (mm: number) => formatSharedFt(mm)

function parseFt(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n * MM_PER_FT : null
}

function parseDeg(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

type PointValues = { readonly x: string; readonly y: string; readonly z: string; readonly ns: string; readonly ew: string; readonly elev: string }

function valuesOf(site: SiteFrame, point: OriginPoint): PointValues {
  const p = originPointPosition(site, point)
  const s = modelToShared(site, p)
  return { x: ft(p.x), y: ft(p.y), z: ft(p.z), ns: ft(s.northSouth), ew: ft(s.eastWest), elev: ft(s.elevation) }
}

/** The open view's working-angle facts, for the Working angle tab. */
export interface CoordinatesViewInfo {
  readonly id: string
  readonly name: string
  /** A floor or ceiling plan: it can be drawn turned to the working angle. */
  readonly isPlan: boolean
  readonly orientation: 'plan_north' | 'true_north' | 'working_angle'
  /** The view's own working angle; undefined when it uses the model's. */
  readonly ownWorkingAngleDeg: number | undefined
}

interface Props {
  readonly site: SiteFrame
  readonly initialTab: CoordinatesTab
  readonly initialMode: OriginMoveMode
  /** Why editing is off (read-only access, not connected); null when it is allowed. */
  readonly editBlocked: string | null
  /** The view open in the canvas, when there is one. */
  readonly view: CoordinatesViewInfo | null
  readonly onCancel: () => void
  /** Sends one command; returns the plain refusal, or null when it was accepted. */
  readonly onSubmit: (command: Command, label: string) => string | null
  /** Close and pick true north with two clicks in the view. */
  readonly onPickTrueNorth: () => void
  /** Close and pick a building edge for the working angle. */
  readonly onPickWorkingAngle: () => void
  /** Show a point on the origin marker. */
  readonly onPointChange: (point: OriginPoint) => void
}

/**
 * Coordinates, in plain words, one idea per tab: the project origin (where
 * drawings and site coordinates are measured from), the site point (a fixed
 * mark on the land), north (true north against plan north, set once for the
 * whole model) and the working angle (the direction people draw in). A small
 * picture above the tabs shows the open tab's idea. Type values and Save;
 * each change is one undoable edit. Esc or Cancel saves nothing.
 */
export function CoordinatesDialog({ site, initialTab, initialMode, editBlocked, view, onCancel, onSubmit, onPickTrueNorth, onPickWorkingAngle, onPointChange }: Props) {
  const t = useEditorTranslate()
  const [tab, setTab] = useState<CoordinatesTab>(initialTab)
  const [mode, setMode] = useState<OriginMoveMode>(initialMode)
  const startOrigin = useMemo(() => valuesOf(site, 'project_base_point'), [site])
  const startSite = useMemo(() => valuesOf(site, 'survey_point'), [site])
  const [origin, setOrigin] = useState<PointValues>(startOrigin)
  const [sitePoint, setSitePoint] = useState<PointValues>(startSite)
  const [north, setNorth] = useState(String(site.trueNorthDeg))
  const modelAngle = siteWorkingAngleDeg(site)
  const [angle, setAngle] = useState(String(modelAngle))
  const [error, setError] = useState<string | null>(null)

  const chooseTab = (next: string) => {
    if (!isTab(next)) return
    setTab(next)
    setError(null)
    const point = pointOfTab(next)
    if (point) onPointChange(point)
  }

  const changedPoint = (now: PointValues, start: PointValues) => (mode === 'move_point' ? now.x !== start.x || now.y !== start.y || now.z !== start.z : now.ns !== start.ns || now.ew !== start.ew || now.elev !== start.elev)
  const originChanged = changedPoint(origin, startOrigin)
  const siteChanged = changedPoint(sitePoint, startSite)
  const northDeg = parseDeg(north)
  const northChanged = northDeg !== null && normalizeAngleDeg(northDeg) !== site.trueNorthDeg
  const angleDeg = parseDeg(angle)
  const angleChanged = angleDeg !== null && normalizeWorkingAngleDeg(angleDeg) !== modelAngle
  const changed = originChanged || siteChanged || northChanged || angleChanged
  const saveBlocked = editBlocked ?? (changed ? null : 'Change a value to save.')

  const pointCommand = (which: Exclude<OriginPoint, 'internal_origin'>, v: PointValues): { command: Command; label: string } | string | null => {
    if (mode === 'move_point') {
      const [x, y, z] = [parseFt(v.x), parseFt(v.y), parseFt(v.z)]
      if (x === null || y === null || z === null) return 'Type the position in this model in feet: east, north and height.'
      const command = moveOriginCommand(which, mode, { position: { x, y, z } })
      return command ? { command, label: moveOriginLabel(which, mode) } : null
    }
    const [ns, ew, elev] = [parseFt(v.ns), parseFt(v.ew), parseFt(v.elev)]
    if (ns === null || ew === null || elev === null) return 'Type the site coordinates in feet: north–south, east–west and elevation.'
    const command = moveOriginCommand(which, mode, { shared: { northSouth: ns, eastWest: ew, elevation: elev } })
    return command ? { command, label: moveOriginLabel(which, mode) } : null
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (saveBlocked) return
    const commands: Array<{ command: Command; label: string }> = []
    for (const [which, values, didChange] of [
      ['project_base_point', origin, originChanged],
      ['survey_point', sitePoint, siteChanged],
    ] as const) {
      if (!didChange) continue
      const made = pointCommand(which, values)
      if (typeof made === 'string') {
        setTab(tabForPoint(which))
        return setError(made)
      }
      if (made) commands.push(made)
    }
    if (northChanged && northDeg !== null) commands.push({ command: { type: 'set_true_north', angleDeg: northDeg }, label: 'set true north' })
    if (angleChanged && angleDeg !== null) commands.push({ command: { type: 'set_working_angle', angleDeg }, label: 'set the working angle' })
    for (const { command, label } of commands) {
      const refusal = onSubmit(command, label)
      if (refusal) return setError(refusal)
    }
    onCancel()
  }

  /** One-click actions in the Working angle tab: sent straight away, then the dialog closes. */
  const act = (command: Command, label: string) => {
    const refusal = onSubmit(command, label)
    if (refusal) return setError(refusal)
    onCancel()
  }

  const pointFields = (prefix: 'origin' | 'site', values: PointValues, set: (next: PointValues) => void) => {
    const field = (id: keyof PointValues, labelText: string, enabled: boolean) => (
      <Field key={id}>
        <FieldLabel htmlFor={`bm-coord-${prefix}-${id}`}>{labelText}</FieldLabel>
        <Input
          id={`bm-coord-${prefix}-${id}`}
          inputMode="decimal"
          value={values[id]}
          disabled={!enabled}
          onChange={(e) => {
            set({ ...values, [id]: e.target.value })
            setError(null)
          }}
        />
      </Field>
    )
    return (
      <>
        <FieldSet>
          <FieldLegend variant="label">{t('coordinates.inThisModel', 'In this model (ft)', { ns: 'editor' })}</FieldLegend>
          <FieldGroup className="grid grid-cols-3 gap-2">
            {field('x', t('coordinates.east', 'East', { ns: 'editor' }), mode === 'move_point')}
            {field('y', t('coordinates.north', 'North', { ns: 'editor' }), mode === 'move_point')}
            {field('z', t('coordinates.height', 'Height', { ns: 'editor' }), mode === 'move_point')}
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend variant="label">{t('coordinates.onTheSite', 'On the site (ft)', { ns: 'editor' })}</FieldLegend>
          <FieldGroup className="grid grid-cols-3 gap-2">
            {field('ns', t('coordinates.northSouth', 'North–south', { ns: 'editor' }), mode === 'relocate_project')}
            {field('ew', t('coordinates.eastWest', 'East–west', { ns: 'editor' }), mode === 'relocate_project')}
            {field('elev', t('coordinates.elevation', 'Elevation', { ns: 'editor' }), mode === 'relocate_project')}
          </FieldGroup>
          <FieldDescription>
            {mode === 'move_point'
              ? t('coordinates.markerOnlyWhy', 'Moving the marker only: type where it sits in this model; its site coordinates follow.', { ns: 'editor' })
              : t('coordinates.buildingWhy', 'Moving the building on the site: type the site coordinates this point should have.', { ns: 'editor' })}
          </FieldDescription>
        </FieldSet>
      </>
    )
  }

  const viewOwn = view?.ownWorkingAngleDeg
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-xl" data-testid="coordinates-dialog">
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('coordinates.title', 'Coordinates', { ns: 'editor' })}</DialogTitle>
            <DialogDescription>
              {t(
                'coordinates.description',
                'Where this building sits on the real site, which way is north, and which way you draw. Nothing here moves geometry, drawings or linked models. Every change can be undone.',
                { ns: 'editor' },
              )}
            </DialogDescription>
          </DialogHeader>

          <CoordinatesDiagram topic={tab} mode={mode} />

          <Tabs value={tab} onValueChange={chooseTab}>
            <TabsList className="w-full" aria-label={t('coordinates.whatToSet', 'What to set', { ns: 'editor' })}>
              {TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} data-testid={`coord-tab-${tab}`}>
                  {tabLabel(tab, t)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="origin" className="flex flex-col gap-3 pt-2" data-testid="coord-panel-origin">
              <FieldDescription>
                {t(
                  'coordinates.originWhy',
                  'The point your drawings and site coordinates are measured from, usually a building corner or a grid crossing. Other tools call it the project base point.',
                  { ns: 'editor' },
                )}
              </FieldDescription>
              <MoveModeChoice value={mode} testIdPrefix="coord-mode" onChange={setMode} />
              {pointFields('origin', origin, setOrigin)}
            </TabsContent>

            <TabsContent value="site_point" className="flex flex-col gap-3 pt-2" data-testid="coord-panel-site_point">
              <FieldDescription>
                {t(
                  'coordinates.sitePointWhy',
                  'A fixed mark on the land, usually the surveyor’s benchmark. You only need it when someone gives you survey coordinates to match. Other tools call it the survey point.',
                  { ns: 'editor' },
                )}
              </FieldDescription>
              <MoveModeChoice value={mode} testIdPrefix="coord-site-mode" onChange={setMode} />
              {pointFields('site', sitePoint, setSitePoint)}
            </TabsContent>

            <TabsContent value="north" className="flex flex-col gap-3 pt-2" data-testid="coord-panel-north">
              <FieldDescription>
                {t(
                  'coordinates.northWhy',
                  'True north is real-world north. Plan north is straight up on a plan. One angle for the whole model: true-north plans, the compass in 3D and sheet north arrows follow it.',
                  { ns: 'editor' },
                )}
              </FieldDescription>
              <div className="flex items-end gap-2">
                <Field className="w-72">
                  <FieldLabel htmlFor="bm-coord-north">
                    {t('coordinates.trueNorthDegrees', 'True north (degrees clockwise from plan north)', { ns: 'editor' })}
                  </FieldLabel>
                  <Input id="bm-coord-north" inputMode="decimal" value={north} onChange={(e) => setNorth(e.target.value)} data-testid="coord-north" />
                </Field>
                <Button type="button" variant="outline" disabled={editBlocked !== null} onClick={onPickTrueNorth} data-testid="coord-pick-north">
                  <Crosshair data-icon="inline-start" />
                  {t('coordinates.pickTwoPoints', 'Pick two points in the view', { ns: 'editor' })}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="working_angle" className="flex flex-col gap-3 pt-2" data-testid="coord-panel-working_angle">
              <FieldDescription>
                {t(
                  'coordinates.workingAngleWhy',
                  'Turns the directions you draw in to match the building. Route snaps, the placement grid, drafting ortho and polar steps and new crop boxes follow it. Nothing moves and site coordinates don’t change.',
                  { ns: 'editor' },
                )}
              </FieldDescription>
              <div className="flex flex-wrap items-end gap-2">
                <Field className="w-72">
                  <FieldLabel htmlFor="bm-coord-working-angle">
                    {t('coordinates.workingAngleDegrees', 'Working angle (degrees counter-clockwise)', { ns: 'editor' })}
                  </FieldLabel>
                  <Input id="bm-coord-working-angle" inputMode="decimal" value={angle} onChange={(e) => setAngle(e.target.value)} data-testid="coord-working-angle" />
                </Field>
                <Button type="button" variant="outline" disabled={editBlocked !== null} onClick={onPickWorkingAngle} data-testid="coord-pick-working-angle">
                  <Ruler data-icon="inline-start" />
                  {t('coordinates.alignAxesToEdge', 'Align axes to an edge', { ns: 'editor' })}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={editBlocked !== null || modelAngle === 0}
                  title={modelAngle === 0 ? t('coordinates.alreadySquare', 'Already square to the model.', { ns: 'editor' }) : undefined}
                  onClick={() => act({ type: 'set_working_angle', angleDeg: 0 }, t('coordinates.putBackSquare', 'put the working angle back square', { ns: 'editor' }))}
                  data-testid="coord-working-angle-reset"
                >
                  <RotateCcw data-icon="inline-start" />
                  {t('coordinates.squareToModel', 'Square to the model', { ns: 'editor' })}
                </Button>
              </div>
              <FieldDescription data-testid="coord-working-angle-now">
                {t('coordinates.now', 'Now: {{angle}}.', { ns: 'editor', angle: describeWorkingAngle(modelAngle) })}
              </FieldDescription>
              {view && viewOwn !== undefined && (
                <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="coord-view-own-angle">
                  <span>
                    {t('coordinates.viewOwnAngle', '{{name}} uses its own angle: {{angle}}.', {
                      ns: 'editor',
                      name: view.name,
                      angle: describeWorkingAngle(viewOwn).toLowerCase(),
                    })}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={editBlocked !== null}
                    onClick={() =>
                      act(
                        { type: 'set_view_properties', viewId: view.id, props: { workingAngleDeg: null } },
                        t('coordinates.useModelAngleWhat', 'use the model’s working angle in {{name}}', { ns: 'editor', name: view.name }),
                      )
                    }
                  >
                    {t('coordinates.useModelAngle', 'Use the model’s angle here', { ns: 'editor' })}
                  </Button>
                </div>
              )}
              {view?.isPlan && (
                <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="coord-plan-turn">
                  <span>
                    {view.orientation === 'working_angle'
                      ? t('coordinates.drawnTurned', '{{name}} is drawn turned to the working angle.', { ns: 'editor', name: view.name })
                      : view.orientation === 'true_north'
                        ? t('coordinates.drawnTrueNorth', '{{name}} is drawn with true north up.', { ns: 'editor', name: view.name })
                        : t('coordinates.drawnPlanNorth', '{{name}} is drawn with plan north up.', { ns: 'editor', name: view.name })}
                  </span>
                  {view.orientation !== 'working_angle' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={editBlocked !== null}
                      onClick={() =>
                        act(
                          { type: 'set_view_properties', viewId: view.id, props: { orientation: 'working_angle' } },
                          t('coordinates.turnPlanToWorkingAngle', 'turn the plan to the working angle', { ns: 'editor' }),
                        )
                      }
                      data-testid="coord-plan-turn-working"
                    >
                      <Compass data-icon="inline-start" />
                      {t('coordinates.turnThisPlan', 'Turn this plan to it', { ns: 'editor' })}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={editBlocked !== null}
                      onClick={() =>
                        act(
                          { type: 'set_view_properties', viewId: view.id, props: { orientation: 'plan_north' } },
                          t('coordinates.turnPlanToPlanNorthWhat', 'turn the plan to plan north', { ns: 'editor' }),
                        )
                      }
                      data-testid="coord-plan-turn-plan-north"
                    >
                      {t('coordinates.backToPlanNorth', 'Back to plan north up', { ns: 'editor' })}
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {(error ?? editBlocked) && (
            <FieldDescription className="text-danger-600" role="alert">
              {error ?? editBlocked}
            </FieldDescription>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('coordinates.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
            <Button type="submit" disabled={saveBlocked !== null} title={saveBlocked ?? undefined} data-testid="coord-save">
              {t('coordinates.save', 'Save', { ns: 'editor' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
