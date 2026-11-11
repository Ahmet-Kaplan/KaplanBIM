'use client'

import { useMemo, useState } from 'react'
import { BrickWall, ChevronDown, Combine, Flame, Layers, Lock, LockOpen, PencilRuler, Plus, Rows3, ScanSearch, SquareSplitHorizontal, SquareDashed, Trash2, X, Zap } from 'lucide-react'
import { childrenOf, elementsOfKind, isCalibrated, zonePurposeWords, type Command, type ElementId, type ModelState, type ZonePurpose } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../ui/select'
import { Skeleton } from '../../ui/skeleton'
import { Slider } from '../../ui/slider'
import { Switch } from '../../ui/switch'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { newElementId } from '../placement'
import { MakeCeilingFromHeightButton } from '../ceilings/MakeCeilingFromHeightButton'
import { SpaceLoadsDialog } from './SpaceLoadsDialog'
import { SpaceLinkedEnvelope } from './SpaceLinkedEnvelope'
import { LinkedCopiesReview } from './LinkedCopiesReview'
import { CodeZonesList } from './CodeZonesList'
import { OpenRoomsAlert } from './OpenRoomsAlert'
import { ProposedRoomsReview } from './ProposedRoomsReview'
import { FireAreasReview } from './FireAreasReview'
import type { FireAreaControls } from './use-fire-areas'
import { SpaceBoundaryProperties } from './SpaceBoundaryProperties'
import type { ProposeControls } from './use-spaces-tool'
import { useWindowedRows, windowBoxStyle, windowSlice } from '../use-windowed-rows'
import { useEditorTranslate, type Translate } from '../i18n/translate'
import { figuresLine, formatLoadAmount, LOAD_QUANTITIES, scopeFigures, type LoadScope } from './space-loads'
import { formatFt2, nextSpaceNumber, setUseCommand, SPACE_USES, spaceRows, spaceUsesIn, zoneFitHeading, zoneRows, zoneServers, type SpaceLoadsReader, type SpaceRow } from './space-rows'

const NO_USE = '__none__'
const NOBODY = '__nobody__'

/**
 * A zone's purpose, as the picker offers it. The words are a function rather
 * than a string because they are read on a screen: §2.3 *Zone* is *bölge* and
 * a fire area is a *yangın bölgesi*.
 */
const PURPOSES: ReadonlyArray<{ readonly value: ZonePurpose; readonly label: (t: Translate) => string }> = [
  { value: 'thermal', label: (t) => t('spaces.purposeThermal', 'Thermal (HVAC)', { ns: 'editor' }) },
  { value: 'ventilation', label: (t) => t('spaces.purposeVentilation', 'Ventilation', { ns: 'editor' }) },
  { value: 'electrical_load_region', label: (t) => t('spaces.purposeElectricalLoadArea', 'Electrical load area', { ns: 'editor' }) },
  { value: 'lighting_control', label: (t) => t('spaces.purposeLightingControl', 'Lighting control', { ns: 'editor' }) },
  { value: 'fire_area', label: (t) => t('spaces.purposeFireArea', 'Fire area', { ns: 'editor' }) },
  { value: 'drainage_catchment', label: (t) => t('spaces.purposeDrainageArea', 'Drainage area', { ns: 'editor' }) },
]

/** Purposes a zone can have but the "Make zone" picker doesn't offer (code zones come from equipment). */
const OTHER_PURPOSE_LABELS: Readonly<Partial<Record<ZonePurpose, (t: Translate) => string>>> = {
  code_clearance: (t) => t('spaces.purposeCodeClearance', 'Code clearance', { ns: 'editor' }),
}

interface Props {
  /** Null while the model is loading. */
  readonly model: ModelState | null
  readonly error?: string | null
  readonly onRetry?: () => void
  /** The plan the person is on; spaces drawn and drawings added go on its level. */
  readonly levelId: ElementId | null
  readonly levelName: string | null
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: (command: Command, undoLabel: string) => string | null
  /** The Draw space tool is on (its button shows Stop). */
  readonly drawing: boolean
  readonly onDrawSpace: () => void
  readonly onRedrawSpace: (spaceId: ElementId) => void
  readonly onStopDrawing: () => void
  readonly onAddUnderlay: () => void
  readonly onCalibrate: (underlayId: ElementId) => void
  readonly onSelectSpace?: (spaceId: ElementId) => void
  /** Room from walls on the plan (use-spaces-tool). Absent: not offered. */
  readonly onRoomFromWalls?: () => void
  /** Separation line on the plan, then Split space. Absent: not offered. */
  readonly onSeparationLine?: () => void
  /** Select model elements (a room's wall, a room that opened); absent: rows only select spaces. */
  readonly onSelectElements?: (ids: readonly ElementId[]) => void
  /** Undo the last edit (offered on a room that opened). */
  readonly onUndo?: () => void
  /** Allocated vs actual per space from the loads layer, when it is mounted. */
  readonly loads?: SpaceLoadsReader
  /** "Propose rooms from this drawing" (use-spaces-tool). Absent: the action isn't offered. */
  readonly propose?: ProposeControls
  /** "Fire areas from rated walls" (use-spaces-tool). Absent: the action isn't offered. */
  readonly fireAreas?: FireAreaControls
  readonly onClose: () => void
  /** The project the model belongs to (add-ons' sections of a space's Loads read its tables). */
  readonly projectId?: string | null
}

/** The loads layer's figures for a row, when the engine has none of its own to say (estimate vs devices, never "allocated"). */
function loadText(row: SpaceRow, t: Translate): string | null {
  if (!row.loads) return null
  const parts = LOAD_QUANTITIES.flatMap((q) => {
    const a = row.loads?.allocated[q.key] ?? 0
    const b = row.loads?.actual[q.key] ?? 0
    if (a === 0 && b === 0) return []
    return [t('spaces.estimateDevices', '{{quantity}}: estimate {{estimate}}, devices so far {{devices}}', { ns: 'editor', quantity: q.label(t), estimate: formatLoadAmount(q.key, a), devices: formatLoadAmount(q.key, b) })]
  })
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Building Model › Spaces (F3): the engineers' own spaces, drawn over the
 * architect's PDF or made from rooms, with use, area (from the outline) and
 * occupants; zones made from selected spaces and assigned to equipment; the
 * drawings placed under the current level with their scale state.
 */
/** Estimated height of one spaces table row (inputs and a select), px. */
const SPACE_ROW_PX = 45

export function SpacesPanel(props: Props) {
  const t = useEditorTranslate()
  const { model, error, onRetry, levelId, levelName, canEdit, blockedReason, submit, drawing, onDrawSpace, onRedrawSpace, onStopDrawing, onAddUnderlay, onCalibrate, onSelectSpace, onRoomFromWalls, onSeparationLine, onSelectElements, onUndo, loads, propose, fireAreas, onClose } = props
  const [detailFor, setDetailFor] = useState<ElementId | null>(null)
  const rows = useMemo(() => (model ? spaceRows(model, loads, t) : []), [model, loads, t])
  const windowRows = useWindowedRows(rows.length, SPACE_ROW_PX)
  const zones = useMemo(() => (model ? zoneRows(model, t) : []), [model, t])
  const modelId = model?.modelId
  const settings = model?.settings
  const uses = useMemo(() => (modelId && settings ? spaceUsesIn({ modelId, settings }) : SPACE_USES), [modelId, settings])
  const serversByPurpose = useMemo(() => {
    const out = new Map<ZonePurpose, ReturnType<typeof zoneServers>>()
    if (model) for (const { zone } of zones) if (!out.has(zone.purpose)) out.set(zone.purpose, zoneServers(model, zone.purpose, t))
    return out
  }, [model, zones, t])
  const figuresByScope = useMemo(() => {
    const out = new Map<ElementId, string>()
    if (!model) return out
    for (const r of rows) {
      const f = scopeFigures(model, { kind: 'space', id: r.id })
      if (f) out.set(r.id, figuresLine(f, t))
    }
    for (const { zone } of zones) {
      const f = scopeFigures(model, { kind: 'zone', id: zone.id })
      if (f) out.set(zone.id, figuresLine(f, t))
    }
    return out
  }, [model, rows, zones, t])
  const [loadsFor, setLoadsFor] = useState<LoadScope | null>(null)
  const underlays = useMemo(() => (model && levelId ? elementsOfKind(model.elements, 'drawing_underlay').filter((u) => u.levelId === levelId) : []), [model, levelId])
  const roomCount = useMemo(() => (model ? elementsOfKind(model.elements, 'room').length : 0), [model])
  const [selected, setSelected] = useState<ReadonlySet<ElementId>>(new Set())
  const [zoneName, setZoneName] = useState('')
  const [zonePurpose, setZonePurpose] = useState<ZonePurpose>('thermal')
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; body: string; command: Command; label: string; action?: string } | null>(null)

  const send = (command: Command, label: string): boolean => {
    const refused = submit(command, label)
    setNotice(refused ? { tone: 'error', text: refused } : null)
    return refused === null
  }

  const editReason = canEdit ? null : blockedReason
  const drawReason = editReason ?? (levelId ? null : t('spaces.openPlanToDraw', 'Open a floor plan to draw spaces on its level.', { ns: 'editor' }))
  const fromRoomsReason = editReason ?? (roomCount === 0 ? t('spaces.noRoomsTraceInstead', 'This model has no rooms. Trace spaces over a drawing instead.', { ns: 'editor' }) : null)

  const addRow = () => {
    if (!model) return
    const number = nextSpaceNumber(model, levelId)
    send({ type: 'create_space', spaces: [{ spaceId: newElementId('space'), number, name: t('spaces.spaceName', 'Space {{number}}', { ns: 'editor', number }), ...(levelId ? { levelId } : {}) }] }, t('spaces.addSpaceCommand', 'Add space', { ns: 'editor' }))
  }
  const makeFromRooms = () => {
    if (send({ type: 'make_spaces_from_rooms', ...(levelId ? { levelId } : {}) }, t('spaces.makeSpacesFromRoomsCommand', 'Make spaces from rooms', { ns: 'editor' })))
      setNotice({
        tone: 'info',
        text: t('spaces.madeSpacesFromRooms', 'Made spaces from the rooms{{where}}.', { ns: 'editor', where: levelName ? t('spaces.onLevel', ' on {{level}}', { ns: 'editor', level: levelName }) : '' }),
      })
  }
  const makeZone = () => {
    const name = zoneName.trim() || t('spaces.zoneDefaultName', 'Zone {{number}}', { ns: 'editor', number: zones.length + 1 })
    if (send({ type: 'create_zone', zoneId: newElementId('zone'), name, purpose: zonePurpose, spaceIds: [...selected] }, t('spaces.makeZoneCommand', 'Make zone', { ns: 'editor' }))) {
      setSelected(new Set())
      setZoneName('')
    }
  }

  const header = (
    <header className="flex items-center gap-2">
      <h2 className="text-sm font-semibold">
        {t('panel.spaces', 'Spaces', { ns: 'editor' })}
        {model && !error ? `: ${rows.length}` : ''}
      </h2>
      <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={t('panel.closeSpaces', 'Close Spaces', { ns: 'editor' })} onClick={onClose}>
        <X />
      </Button>
    </header>
  )

  if (error)
    return (
      <section className="flex min-h-0 flex-col gap-3" aria-label={t('panel.spaces', 'Spaces', { ns: 'editor' })} data-testid="spaces-panel">
        {header}
        <Alert variant="destructive" data-testid="spaces-error">
          <AlertTitle>{t('spaces.theSpacesDidntLoad', 'The spaces didn’t load', { ns: 'editor' })}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{error}</span>
            {onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry}>
                {t('spaces.tryAgain', 'Try again', { ns: 'editor' })}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </section>
    )
  if (!model)
    return (
      <section className="flex min-h-0 flex-col gap-3" aria-label={t('panel.spaces', 'Spaces', { ns: 'editor' })} data-testid="spaces-panel" aria-busy="true">
        {header}
        <span className="sr-only">{t('spaces.loadingTheSpaces', 'Loading the spaces', { ns: 'editor' })}</span>
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </section>
    )

  return (
    <section className="flex min-h-0 flex-col gap-3" aria-label={t('panel.spaces', 'Spaces', { ns: 'editor' })} data-testid="spaces-panel">
      {header}
      <div className="flex flex-wrap gap-2">
        {drawing ? (
          <Button size="sm" variant="secondary" onClick={onStopDrawing} data-testid="spaces-stop-drawing">
            {t('spaces.stopDrawingEsc', 'Stop drawing (Esc)', { ns: 'editor' })}
          </Button>
        ) : (
          <Button size="sm" onClick={onDrawSpace} disabled={drawReason !== null} title={drawReason ?? t('spaces.clickSpaceCorners', 'Click the corners of a space on the plan', { ns: 'editor' })} data-testid="spaces-draw">
            <PencilRuler data-icon="inline-start" />
            {t('spaces.drawSpace', 'Draw space', { ns: 'editor' })}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onAddUnderlay}
          disabled={drawReason !== null}
          title={drawReason ?? t('spaces.addDrawingWhy', 'Put an architect’s PDF or picture under this plan to trace over', { ns: 'editor' })}
          data-testid="spaces-add-underlay"
        >
          <Layers data-icon="inline-start" />
          {t('spaces.addDrawing', 'Add drawing', { ns: 'editor' })}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={makeFromRooms}
          disabled={fromRoomsReason !== null}
          title={fromRoomsReason ?? t('spaces.oneSpacePerRoom', 'One space per room, following the room', { ns: 'editor' })}
          data-testid="spaces-from-rooms"
        >
          <SquareDashed data-icon="inline-start" />
          {t('spaces.makeFromRooms', 'Make from rooms', { ns: 'editor' })}
        </Button>
        {onRoomFromWalls || onSeparationLine || propose || fireAreas ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={editReason !== null || drawing}
                title={editReason ?? (drawing ? t('spaces.stopDrawingFirst', 'Stop drawing first.', { ns: 'editor' }) : t('spaces.roomsMenuWhy', 'Make, find and split rooms, and find fire areas, from the walls on this plan', { ns: 'editor' }))}
                data-testid="spaces-walls-menu"
              >
                <BrickWall data-icon="inline-start" />
                {t('spaces.roomsFromWalls', 'Rooms from walls', { ns: 'editor' })}
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                {onRoomFromWalls ? (
                  <DropdownMenuItem disabled={drawReason !== null} title={drawReason ?? undefined} onSelect={onRoomFromWalls} data-testid="spaces-room-from-walls">
                    <BrickWall />
                    {t('spaces.roomFromWalls', 'Room from walls', { ns: 'editor' })}
                    <span className="ml-auto text-xs text-muted-foreground">{t('spaces.hoverThenClickInside', 'Hover, then click inside', { ns: 'editor' })}</span>
                  </DropdownMenuItem>
                ) : null}
                {propose ? (
                  <DropdownMenuItem
                    disabled={propose.wallsReason !== null || propose.state.kind === 'review'}
                    title={propose.wallsReason ?? (propose.state.kind === 'review' ? t('spaces.finishRoomReview', 'Finish the room review open below first.', { ns: 'editor' }) : undefined)}
                    onSelect={propose.startFromWalls}
                    data-testid="spaces-find-from-walls"
                  >
                    <ScanSearch />
                    {t('spaces.findRoomsFromWalls', 'Find rooms from walls', { ns: 'editor' })}
                    <span className="ml-auto text-xs text-muted-foreground">{t('spaces.reviewEach', 'Review each', { ns: 'editor' })}</span>
                  </DropdownMenuItem>
                ) : null}
                {propose?.linkedWalls.shown ? (
                  <DropdownMenuCheckboxItem
                    checked={propose.linkedWalls.on}
                    onCheckedChange={propose.linkedWalls.toggle}
                    onSelect={(e) => e.preventDefault()}
                    title={propose.linkedWalls.note ?? t('spaces.linkedWallsWhy', "Find rooms from walls also uses the linked model's walls as room boundaries", { ns: 'editor' })}
                    data-testid="spaces-use-linked-walls"
                  >
                    {t('spaces.useLinkedWalls', "Use the linked model's walls", { ns: 'editor' })}
                    {propose.linkedWalls.note ? (
                      <span className="ml-auto text-xs text-muted-foreground">{propose.linkedWalls.reading ? t('spaces.loading', 'Loading…', { ns: 'editor' }) : t('spaces.notAvailable', 'Not available', { ns: 'editor' })}</span>
                    ) : null}
                  </DropdownMenuCheckboxItem>
                ) : null}
                {fireAreas ? (
                  <DropdownMenuItem
                    disabled={fireAreas.reason !== null || fireAreas.state.kind !== 'idle'}
                    title={
                      fireAreas.reason ??
                      (fireAreas.state.kind !== 'idle'
                        ? t('spaces.finishFireReview', 'Finish the fire-area review open below first.', { ns: 'editor' })
                        : t('spaces.fireAreasWhy', 'Find the areas closed by rated walls on this level; you accept each as a fire-area zone', { ns: 'editor' }))
                    }
                    onSelect={fireAreas.start}
                    data-testid="spaces-fire-areas"
                  >
                    <Flame />
                    {t('spaces.fireAreasFromRatedWalls', 'Fire areas from rated walls', { ns: 'editor' })}
                    <span className="ml-auto text-xs text-muted-foreground">{t('spaces.acceptEach', 'Accept each', { ns: 'editor' })}</span>
                  </DropdownMenuItem>
                ) : null}
                {onSeparationLine ? (
                  <DropdownMenuItem disabled={drawReason !== null} title={drawReason ?? undefined} onSelect={onSeparationLine} data-testid="spaces-split">
                    <SquareSplitHorizontal />
                    {t('spaces.splitSpace', 'Split space', { ns: 'editor' })}
                    <span className="ml-auto text-xs text-muted-foreground">{t('spaces.lineWallToWall', 'Line wall to wall', { ns: 'editor' })}</span>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {propose ? (
          <Button
            size="sm"
            variant="outline"
            onClick={propose.start}
            disabled={(editReason ?? propose.reason) !== null || propose.state.kind === 'loading' || propose.state.kind === 'review'}
            title={editReason ?? propose.reason ?? t('spaces.proposeRoomsWhy', 'Find the closed rooms on the drawing under this plan; you accept or reject each before anything is saved', { ns: 'editor' })}
            data-testid="spaces-propose-rooms"
          >
            <ScanSearch data-icon="inline-start" />
            {t('spaces.proposeRoomsFromDrawing', 'Propose rooms from this drawing', { ns: 'editor' })}
          </Button>
        ) : null}
      </div>
      {propose ? <ProposedRoomsReview propose={propose} editReason={editReason} /> : null}
      {fireAreas ? <FireAreasReview fire={fireAreas} editReason={editReason} levelName={levelName} /> : null}
      {editReason ? <p className="text-xs text-muted-foreground">{editReason}</p> : null}

      <OpenRoomsAlert model={model} onSelect={onSelectElements} onUndo={onUndo} />

      {notice ? (
        <Alert variant={notice.tone === 'error' ? 'destructive' : 'default'} data-testid="spaces-notice">
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      ) : null}

      {underlays.length > 0 ? (
        <div className="flex flex-col gap-2" data-testid="spaces-underlays">
          <h3 className="text-xs font-medium text-muted-foreground">{t('spaces.drawingsUnder', 'Drawings under {{level}}', { ns: 'editor', level: levelName ?? t('spaces.thisPlan', 'this plan', { ns: 'editor' }) })}</h3>
          <p className="text-xs text-muted-foreground" data-testid="spaces-underlay-where">
            {t('spaces.drawingsShowWhere', 'Drawings show on this level’s printed drawing (view Show › Printed drawing) and while you draw spaces. The live model doesn’t show them.', { ns: 'editor' })}
          </p>
          {underlays.map((u) => {
            const calibrated = isCalibrated(u)
            return (
              <div key={u.id} className="flex flex-col gap-2 rounded border p-2" data-testid="spaces-underlay" data-underlay={u.id} data-calibrated={calibrated}>
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm">
                    {u.source.name}
                    {u.source.page ? t('spaces.pageOfDrawing', ', page {{page}}', { ns: 'editor', page: u.source.page }) : ''}
                  </span>
                  {calibrated ? (
                    <Badge variant="secondary">{t('spaces.scaleSet', 'Scale set', { ns: 'editor' })}</Badge>
                  ) : (
                    <Badge variant="destructive">{t('spaces.notCalibratedTracingOff', 'Not calibrated: tracing is off', { ns: 'editor' })}</Badge>
                  )}
                  <Button
                    size="sm"
                    variant={calibrated ? 'ghost' : 'default'}
                    className="ml-auto"
                    onClick={() => onCalibrate(u.id)}
                    disabled={editReason !== null || u.locked === true}
                    title={u.locked ? t('spaces.unlockToChangeScale', 'Unlock it to change its scale.', { ns: 'editor' }) : (editReason ?? undefined)}
                    data-testid="spaces-calibrate"
                  >
                    {calibrated ? t('spaces.rescale', 'Rescale', { ns: 'editor' }) : t('spaces.setScale', 'Set scale', { ns: 'editor' })}
                  </Button>
                </div>
                {!calibrated ? <p className="text-xs text-muted-foreground">{t('spaces.pickTwoPointsOrScale', 'Pick two points a known distance apart, or type the printed scale. Until then spaces drawn here aren’t traced over it.', { ns: 'editor' })}</p> : null}
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-14">{t('spaces.opacity', 'Opacity', { ns: 'editor' })}</span>
                  <Slider
                    className="w-32"
                    min={10}
                    max={100}
                    step={5}
                    value={[u.opacityPct ?? 50]}
                    disabled={editReason !== null}
                    onValueCommit={(v) => send({ type: 'edit_underlay', underlayId: u.id, opacityPct: v[0] ?? 50 }, t('spaces.underlayOpacityCommand', 'Underlay opacity', { ns: 'editor' }))}
                    aria-label={t('spaces.opacityOf', 'Opacity of {{name}}', { ns: 'editor', name: u.source.name })}
                  />
                  <label className="flex items-center gap-1">
                    {u.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
                    <Switch
                      checked={u.locked === true}
                      disabled={editReason !== null}
                      onCheckedChange={(v) =>
                        send(
                          { type: 'edit_underlay', underlayId: u.id, locked: v },
                          v ? t('spaces.lockUnderlayCommand', 'Lock underlay', { ns: 'editor' }) : t('spaces.unlockUnderlayCommand', 'Unlock underlay', { ns: 'editor' }),
                        )
                      }
                      aria-label={t('spaces.lockSoItCantSlide', "Lock so it can't slide", { ns: 'editor' })}
                    />
                    {t('spaces.lock', 'Lock', { ns: 'editor' })}
                  </label>
                  <label className="flex items-center gap-1">
                    <Switch
                      checked={u.hidden !== true}
                      disabled={editReason !== null}
                      onCheckedChange={(v) =>
                        send({ type: 'edit_underlay', underlayId: u.id, hidden: !v }, v ? t('spaces.showUnderlayCommand', 'Show underlay', { ns: 'editor' }) : t('spaces.hideUnderlayCommand', 'Hide underlay', { ns: 'editor' }))
                      }
                      aria-label={t('spaces.showOnPrintedDrawing', 'Show on the printed drawing', { ns: 'editor' })}
                    />
                    {t('spaces.showOnPrintedDrawing', 'Show on the printed drawing', { ns: 'editor' })}
                  </label>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('spaces.removeNamed', 'Remove {{name}}', { ns: 'editor', name: u.source.name })}
                    disabled={editReason !== null}
                    onClick={() =>
                      setConfirm({
                        title: t('spaces.removeNamedTitle', 'Remove {{name}}?', { ns: 'editor', name: u.source.name }),
                        body: t('spaces.removeUnderlayWhat', 'The drawing comes off this plan. Spaces traced over it keep their outlines. Undo puts it back.', { ns: 'editor' }),
                        command: { type: 'delete_underlays', underlayIds: [u.id] },
                        label: t('spaces.removeUnderlayCommand', 'Remove underlay', { ns: 'editor' }),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Empty className="border" data-testid="spaces-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Rows3 />
            </EmptyMedia>
            <EmptyTitle>{t('spaces.noSpacesYet', 'No spaces yet', { ns: 'editor' })}</EmptyTitle>
            <EmptyDescription>
              {t('spaces.emptyHowPrefix', 'Two ways to start. Most jobs only have the architect’s PDF: add it with', { ns: 'editor' })} <strong>{t('spaces.addDrawing', 'Add drawing', { ns: 'editor' })}</strong>
              {t('spaces.emptyHowThenScale', ', set its scale, then', { ns: 'editor' })} <strong>{t('spaces.drawSpace', 'Draw space', { ns: 'editor' })}</strong>
              {t('spaces.emptyHowOverEachRoom', ' over each room. If the model has rooms,', { ns: 'editor' })} <strong>{t('spaces.makeFromRooms', 'Make from rooms', { ns: 'editor' })}</strong>
              {t('spaces.emptyHowOneSpacePerRoom', ' makes one space per room.', { ns: 'editor' })}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button size="sm" onClick={onAddUnderlay} disabled={drawReason !== null} title={drawReason ?? undefined}>
              {t('spaces.traceOverADrawing', 'Trace over a drawing', { ns: 'editor' })}
            </Button>
            <Button size="sm" variant="outline" onClick={makeFromRooms} disabled={fromRoomsReason !== null} title={fromRoomsReason ?? undefined}>
              {t('spaces.makeFromRooms', 'Make from rooms', { ns: 'editor' })}
            </Button>
            <Button size="sm" variant="ghost" onClick={addRow} disabled={editReason !== null} title={editReason ?? t('spaces.typeASpaceNow', 'Type a space into the list now; draw it later', { ns: 'editor' })} data-testid="spaces-add-row">
              <Plus data-icon="inline-start" />
              {t('spaces.addRow', 'Add row', { ns: 'editor' })}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={addRow} disabled={editReason !== null} title={editReason ?? t('spaces.typeASpaceNow', 'Type a space into the list now; draw it later', { ns: 'editor' })} data-testid="spaces-add-row">
              <Plus data-icon="inline-start" />
              {t('spaces.addRow', 'Add row', { ns: 'editor' })}
            </Button>
          </div>
          <div ref={windowRows.scrollRef} className="min-h-0 overflow-auto" style={windowBoxStyle(windowRows)}>
            <Table data-testid="spaces-table">
              <TableCaption className="sr-only">{t('spaces.tableCaption', 'Spaces with their use, area, occupants and loads', { ns: 'editor' })}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6">
                    <span className="sr-only">{t('spaces.pickForAZone', 'Pick for a zone', { ns: 'editor' })}</span>
                  </TableHead>
                  <TableHead>{t('spaces.numberColumn', 'Number', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('spaces.nameColumn', 'Name', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('spaces.levelColumn', 'Level', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('spaces.useColumn', 'Use', { ns: 'editor' })}</TableHead>
                  <TableHead className="text-right">{t('spaces.areaColumn', 'Area', { ns: 'editor' })}</TableHead>
                  <TableHead className="text-right">{t('spaces.occupantsColumn', 'Occupants', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('spaces.loadsColumn', 'Loads', { ns: 'editor' })}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('spaces.actions', 'Actions', { ns: 'editor' })}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {windowRows.padTop > 0 && <TableRow aria-hidden="true" className="border-0 hover:bg-transparent" style={{ height: windowRows.padTop }} />}
                {windowSlice(rows, windowRows).map(({ item: r, index }) => (
                  <TableRow
                    key={r.id}
                    ref={windowRows.measure}
                    data-index={index}
                    data-testid="spaces-row"
                    data-space={r.id}
                    data-state={detailFor === r.id ? 'selected' : undefined}
                    onClick={() => {
                      setDetailFor(r.id)
                      onSelectSpace?.(r.id)
                    }}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={(v) =>
                          setSelected((current) => {
                            const next = new Set(current)
                            if (v === true) next.add(r.id)
                            else next.delete(r.id)
                            return next
                          })
                        }
                        aria-label={t('spaces.pickNamedForAZone', 'Pick {{space}} for a zone', { ns: 'editor', space: r.label })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 w-16"
                        defaultValue={r.number}
                        disabled={editReason !== null}
                        aria-label={t('spaces.spaceNumberAria', 'Space number', { ns: 'editor' })}
                        onBlur={(e) => e.target.value.trim() !== r.number && send({ type: 'edit_space', spaceId: r.id, number: e.target.value.trim() }, t('spaces.renumberSpace', 'Renumber space', { ns: 'editor' }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 w-32"
                        defaultValue={r.name}
                        disabled={editReason !== null}
                        aria-label={t('spaces.spaceNameAria', 'Space name', { ns: 'editor' })}
                        data-testid="spaces-name"
                        onBlur={(e) => e.target.value.trim() !== r.name && send({ type: 'edit_space', spaceId: r.id, name: e.target.value.trim() }, t('spaces.renameSpace', 'Rename space', { ns: 'editor' }))}
                      />
                    </TableCell>
                    <TableCell className="text-xs">{r.levelName ?? t('spaces.notOnALevel', 'Not on a level', { ns: 'editor' })}</TableCell>
                    <TableCell>
                      <Select
                        value={r.useId ?? NO_USE}
                        disabled={editReason !== null}
                        onValueChange={(v) => {
                          const command = setUseCommand(r.id, v === NO_USE ? null : v, uses, model ?? undefined, t)
                          if (typeof command === 'string') setNotice({ tone: 'error', text: command })
                          else send(command, t('spaces.setSpaceUse', 'Set space use', { ns: 'editor' }))
                        }}
                      >
                        <SelectTrigger className="h-7 w-44" aria-label={t('spaces.useOfNamed', 'Use of {{space}}', { ns: 'editor', space: r.label })} data-testid="spaces-use">
                          <SelectValue placeholder={t('spaces.pickAUse', 'Pick a use', { ns: 'editor' })} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value={NO_USE}>{t('spaces.noUseYet', 'No use yet', { ns: 'editor' })}</SelectItem>
                          </SelectGroup>
                          {[...new Set(uses.map((u) => u.category))].map((cat) => (
                            <SelectGroup key={cat}>
                              <SelectLabel>{cat}</SelectLabel>
                              {uses
                                .filter((u) => u.category === cat)
                                .map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right tabular-nums" data-testid="spaces-area">
                      {formatFt2(r.areaFt2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="h-7 w-16 text-right tabular-nums"
                        key={`${r.id}:${r.occupants ?? ''}`}
                        defaultValue={r.occupants ?? ''}
                        placeholder={r.useName ? '' : t('spaces.pickAUse', 'Pick a use', { ns: 'editor' })}
                        disabled={editReason !== null}
                        aria-label={t('spaces.occupantsOfNamed', 'Occupants of {{space}}{{basis}}', {
                          ns: 'editor',
                          space: r.label,
                          basis: r.occupantsTyped ? t('spaces.occupantsTyped', ' (typed)', { ns: 'editor' }) : t('spaces.occupantsFromUse', ' (from the use)', { ns: 'editor' }),
                        })}
                        title={r.occupantsTyped ? t('spaces.occupantsTypedTitle', 'Typed. Clear it to go back to the use’s default.', { ns: 'editor' }) : t('spaces.occupantsFromUseTitle', 'From the use’s default density. Type a number to override.', { ns: 'editor' })}
                        data-testid="spaces-occupants"
                        onBlur={(e) => {
                          const typed = e.target.value.trim()
                          if (typed === '' && r.occupantsTyped) send({ type: 'edit_space', spaceId: r.id, occupants: null }, t('spaces.occupantsFromUseCommand', 'Occupants from the use', { ns: 'editor' }))
                          else if (typed !== '' && Number(typed) !== r.occupants) {
                            const n = Number(typed)
                            if (!Number.isInteger(n) || n < 0) setNotice({ tone: 'error', text: t('spaces.occupantsWholeNumber', 'Occupants is a whole number of people.', { ns: 'editor' }) })
                            else send({ type: 'edit_space', spaceId: r.id, occupants: n }, t('spaces.setOccupants', 'Set occupants', { ns: 'editor' }))
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="max-w-56 text-xs">
                      {(() => {
                        const line = figuresByScope.get(r.id) ?? loadText(r, t)
                        return (
                          <div className="flex flex-col items-start gap-0.5">
                            <Button
                              variant={line ? 'link' : 'outline'}
                              size="sm"
                              className={line ? 'h-auto whitespace-normal p-0 text-left text-xs' : 'h-7'}
                              aria-label={line ? t('spaces.loadsOnNamedWithFigures', 'Loads on {{name}}: {{line}}', { ns: 'editor', name: r.label, line }) : t('spaces.addLoadToNamed', 'Add load to {{name}}', { ns: 'editor', name: r.label })}
                              title={line ? t('spaces.seeChangeAddLoads', 'See, change or add loads', { ns: 'editor' }) : t('spaces.loadsWhat', 'Lighting, receptacles or any load, as a total or per square foot', { ns: 'editor' })}
                              data-testid="spaces-loads"
                              onClick={(e) => {
                                e.stopPropagation()
                                setLoadsFor({ kind: 'space', id: r.id, label: r.label })
                              }}
                            >
                              {line ? null : <Plus data-icon="inline-start" />}
                              {line ?? t('spaces.addLoad', 'Add load', { ns: 'editor' })}
                            </Button>
                            <span className="text-muted-foreground">{r.zones.length > 0 ? r.zones.join(', ') : r.madeBy}</span>
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={r.areaFt2 === null ? t('spaces.drawNamed', 'Draw {{space}}', { ns: 'editor', space: r.label }) : t('spaces.redrawNamed', 'Redraw {{space}}', { ns: 'editor', space: r.label })}
                        title={drawReason ?? (r.areaFt2 === null ? t('spaces.drawOnPlan', 'Draw it on the plan', { ns: 'editor' }) : t('spaces.redrawItsOutline', 'Redraw its outline', { ns: 'editor' }))}
                        disabled={drawReason !== null}
                        onClick={() => onRedrawSpace(r.id)}
                      >
                        <PencilRuler />
                      </Button>
                      <MakeCeilingFromHeightButton model={model} spaceId={r.id} label={r.label} editReason={editReason} submit={submit} />
                      {childrenOf(model.elements, r.id).length > 0 ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('spaces.mergeNamedBack', 'Merge {{space}} back into one room', { ns: 'editor', space: r.label })}
                          title={editReason ?? t('spaces.mergeBackWhy', 'Remove the separation line and merge the sub-rooms back, with their loads', { ns: 'editor' })}
                          disabled={editReason !== null}
                          data-testid="spaces-merge-back"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirm({
                              title: t('spaces.mergeBackTitle', 'Merge {{space}} back into one room?', { ns: 'editor', space: r.label }),
                              body: t('spaces.mergeBackWhat', 'The separation line and the sub-rooms go; their loads come back to the room. Undo splits it again.', { ns: 'editor' }),
                              command: { type: 'merge_space_children', spaceId: r.id },
                              label: t('spaces.mergeBackCommand', 'Merge back', { ns: 'editor' }),
                              action: t('spaces.mergeBackAction', 'Merge back', { ns: 'editor' }),
                            })
                          }}
                        >
                          <Combine />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('spaces.deleteNamed', 'Delete {{space}}', { ns: 'editor', space: r.label })}
                        disabled={editReason !== null}
                        onClick={() =>
                          setConfirm({
                            title: t('spaces.deleteNamedTitle', 'Delete {{space}}?', { ns: 'editor', space: r.label }),
                            body: t('spaces.deleteSpaceWhat', 'It comes out of every zone. Undo puts it back.', { ns: 'editor' }),
                            command: { type: 'delete_spaces', spaceIds: [r.id] },
                            label: t('spaces.deleteSpaceCommand', 'Delete space', { ns: 'editor' }),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {windowRows.padBottom > 0 && <TableRow aria-hidden="true" className="border-0 hover:bg-transparent" style={{ height: windowRows.padBottom }} />}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {detailFor && model.elements[detailFor]?.kind === 'space' ? (
        <div className="flex flex-col gap-2 border-t pt-2" data-testid="spaces-detail">
          <h3 className="text-xs font-medium text-muted-foreground">{rows.find((r) => r.id === detailFor)?.label ?? t('spaces.spaceFallback', 'Space', { ns: 'editor' })}</h3>
          <SpaceBoundaryProperties model={model} spaceId={detailFor} onSelectElement={onSelectElements ? (id) => onSelectElements([id]) : undefined} />
          <SpaceLinkedEnvelope model={model} spaceId={detailFor} submit={submit} editReason={editReason} />
        </div>
      ) : null}

      <LinkedCopiesReview model={model} submit={submit} editReason={editReason} />

      {rows.length > 0 || zones.length > 0 ? (
        <div className="flex flex-col gap-2 border-t pt-2" data-testid="spaces-zones">
          <h3 className="text-xs font-medium text-muted-foreground">{t('spaces.zoneTitle', 'Zones', { ns: 'editor' })}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-36"
              placeholder={t('spaces.zoneDefaultName', 'Zone {{number}}', { ns: 'editor', number: zones.length + 1 })}
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              aria-label={t('spaces.newZoneName', 'New zone name', { ns: 'editor' })}
              data-testid="spaces-zone-name"
            />
            <Select value={zonePurpose} onValueChange={(v) => setZonePurpose(PURPOSES.find((p) => p.value === v)?.value ?? 'thermal')}>
              <SelectTrigger className="h-8 w-44" aria-label={t('spaces.zonePurpose', 'Zone purpose', { ns: 'editor' })}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PURPOSES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label(t)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={makeZone}
              disabled={editReason !== null || selected.size === 0}
              title={editReason ?? (selected.size === 0 ? t('spaces.tickSpacesFirst', 'Tick the spaces that make the zone first.', { ns: 'editor' }) : undefined)}
              data-testid="spaces-make-zone"
            >
              {t('spaces.makeZoneFromSelected', 'Make zone from {{count}} selected', { ns: 'editor', count: selected.size })}
            </Button>
          </div>
          {zones.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('spaces.noZonesYet', 'No zones yet. Tick spaces above, name the zone, and make it. Then pick the equipment that serves it.', { ns: 'editor' })}</p>
          ) : (
            zones.map(({ zone, servedByMark, spaceLabels, boundsLine }) => {
              const servers = serversByPurpose.get(zone.purpose) ?? { fits: [], others: [] }
              const zoneLine = figuresByScope.get(zone.id)
              return (
                <div key={zone.id} className="flex flex-wrap items-center gap-2 text-sm" data-testid="spaces-zone" data-zone={zone.id}>
                  <span className="font-medium">{zone.name}</span>
                  <Badge variant="outline">{PURPOSES.find((p) => p.value === zone.purpose)?.label(t) ?? OTHER_PURPOSE_LABELS[zone.purpose]?.(t) ?? zonePurposeWords(zone.purpose)}</Badge>
                  <span className="text-xs text-muted-foreground" data-testid="spaces-zone-covers">
                    {boundsLine ?? (spaceLabels.length === 0 ? t('spaces.noSpacesLower', 'no spaces', { ns: 'editor' }) : spaceLabels.join(', '))}
                  </span>
                  <Select
                    value={zone.servedBy ?? NOBODY}
                    disabled={editReason !== null}
                    onValueChange={(v) => send({ type: 'edit_zone', zoneId: zone.id, servedBy: v === NOBODY ? null : v }, t('spaces.assignZoneToEquipment', 'Assign zone to equipment', { ns: 'editor' }))}
                  >
                    <SelectTrigger className="ml-auto h-7 w-44" aria-label={t('spaces.equipmentServingNamed', 'Equipment serving {{zone}}', { ns: 'editor', zone: zone.name })} data-testid="spaces-zone-served-by">
                      <SelectValue placeholder={t('spaces.servedByEllipsis', 'Served by…', { ns: 'editor' })}>
                        {servedByMark ? t('spaces.servedByName', 'Served by {{name}}', { ns: 'editor', name: servedByMark }) : t('spaces.notAssigned', 'Not assigned', { ns: 'editor' })}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={NOBODY}>{t('spaces.notAssigned', 'Not assigned', { ns: 'editor' })}</SelectItem>
                      </SelectGroup>
                      {servers.fits.length === 0 && servers.others.length === 0 ? (
                        <SelectGroup>
                          <SelectItem value="__none_available__" disabled>
                            {t('spaces.noEquipmentWithMark', 'No equipment with a mark yet', { ns: 'editor' })}
                          </SelectItem>
                        </SelectGroup>
                      ) : (
                        <>
                          <SelectGroup data-testid="spaces-zone-fits">
                            <SelectLabel>{zoneFitHeading(zone.purpose, t)}</SelectLabel>
                            {servers.fits.length === 0 ? (
                              <SelectItem value="__no_fit__" disabled>
                                {t('spaces.noneFitsYet', 'None yet: equipment with an airflow, a duct connection or an HVAC load lists here', { ns: 'editor' })}
                              </SelectItem>
                            ) : (
                              servers.fits.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.label}
                                </SelectItem>
                              ))
                            )}
                          </SelectGroup>
                          {servers.others.length > 0 ? (
                            <SelectGroup data-testid="spaces-zone-others">
                              <SelectLabel>{t('spaces.otherEquipment', 'Other equipment', { ns: 'editor' })}</SelectLabel>
                              {servers.others.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ) : null}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    aria-label={zoneLine ? t('spaces.loadsOnNamedWithFigures', 'Loads on {{name}}: {{line}}', { ns: 'editor', name: zone.name, line: zoneLine }) : t('spaces.addLoadToNamed', 'Add load to {{name}}', { ns: 'editor', name: zone.name })}
                    title={zoneLine ?? t('spaces.loadsSpreadOverZone', 'Loads spread over the whole zone', { ns: 'editor' })}
                    data-testid="spaces-zone-loads"
                    onClick={() => setLoadsFor({ kind: 'zone', id: zone.id, label: zone.name })}
                  >
                    <Zap data-icon="inline-start" />
                    {t('spaces.loadsButton', 'Loads', { ns: 'editor' })}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('spaces.deleteZoneNamed', 'Delete {{zone}}', { ns: 'editor', zone: zone.name })}
                    disabled={editReason !== null}
                    onClick={() =>
                      setConfirm({
                        title: t('spaces.deleteZoneTitle', 'Delete {{zone}}?', { ns: 'editor', zone: zone.name }),
                        body: t('spaces.deleteZoneWhat', 'Its spaces stay. Undo puts the zone back.', { ns: 'editor' }),
                        command: { type: 'delete_zones', zoneIds: [zone.id] },
                        label: t('spaces.deleteZoneCommand', 'Delete zone', { ns: 'editor' }),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                  {zoneLine ? (
                    <p className="basis-full text-xs text-muted-foreground" data-testid="spaces-zone-figures">
                      {zoneLine}
                    </p>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      ) : null}

      <CodeZonesList model={model} levelId={levelId} editReason={editReason} send={send} />

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('spaces.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) send(confirm.command, confirm.label)
                setConfirm(null)
              }}
            >
              {confirm?.action ?? t('spaces.delete', 'Delete', { ns: 'editor' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SpaceLoadsDialog scope={loadsFor} model={model} canEdit={canEdit} blockedReason={blockedReason} submit={submit} onClose={() => setLoadsFor(null)} projectId={props.projectId ?? null} />
    </section>
  )
}
