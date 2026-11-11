'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, SquareDashed, X } from 'lucide-react'
import { densityReceptacleRules, receptaclePlacementRules, type NecEditionYear } from '@permitzip/bim-calc'
import { builtinPartTypes, elementsOfKind, proposalFeetInches, similarRooms, type ModelState, type PartTypeDefinition, type RoomGeometry, type Vec2 } from '@permitzip/bim-kernel'
import { PROPOSE_DEVICE_CHOICES, type ProposeDeviceChoice, acceptProposalCommand, checkReceptacleCoverage, proposeReceptacles, receptacleRoomGeometries, wallMountsFor, type DensityPreset, type ReceptacleRequest } from '@permitzip/bim-pack-electrical'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import type { ClickHandler, ProposalGhost } from '../model-session'
import type { SubmitCommand } from '../views-sheets/types'
import { hoveredRoomOf, useHoveredRoom } from '../input/hover-preview'
import { NEC_EDITIONS, type NecRules } from './use-nec-rules'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/** The add-on's device choices per location (types and words); the person picks. */
const CHOICE = Object.fromEntries(PROPOSE_DEVICE_CHOICES.map((c) => [c.location, c])) as Readonly<Record<ProposeDeviceChoice['location'], ProposeDeviceChoice | undefined>>
const firstType = (location: ProposeDeviceChoice['location']) => CHOICE[location]?.types[0] ?? ''

const typeName = (id: string) => builtinPartTypes().find((t) => t.id === id)?.definition.familyName ?? id
const definitionOf = (model: ModelState, id: string): PartTypeDefinition | null => {
  const el = model.elements[id]
  return el?.kind === 'part_type' ? el.definition : (builtinPartTypes().find((t) => t.id === id)?.definition ?? null)
}

const NO_DEVICES: readonly never[] = []

/** A run's kind in words — a `label(t)` accessor, not a table frozen in one language. */
function kindWord(kind: string, t: Translate): string {
  switch (kind) {
    case 'wall':
    case 'density':
      return t('electrical.kindWord.wall', 'Wall', { ns: 'editor' })
    case 'countertop':
      return t('electrical.kindWord.countertop', 'Countertop', { ns: 'editor' })
    case 'island':
      return t('electrical.kindWord.island', 'Island', { ns: 'editor' })
    case 'peninsula':
      return t('electrical.kindWord.peninsula', 'Peninsula', { ns: 'editor' })
    case 'bathroom':
      return t('electrical.kindWord.bathroom', 'Bathroom', { ns: 'editor' })
    case 'laundry':
      return t('electrical.kindWord.laundry', 'Laundry', { ns: 'editor' })
    case 'hallway':
      return t('electrical.kindWord.hallway', 'Hallway', { ns: 'editor' })
    default:
      return kind
  }
}

/** A rule's own word. */
function ruleWord(rule: string, t: Translate): string {
  switch (rule) {
    case 'general':
      return t('electrical.wallSpace', 'wall space', { ns: 'editor' })
    case 'kitchen':
      return t('electrical.ruleWord.kitchen', 'kitchen', { ns: 'editor' })
    case 'bathroom':
      return t('electrical.ruleWord.bathroom', 'bathroom', { ns: 'editor' })
    case 'laundry':
      return t('electrical.ruleWord.laundry', 'laundry', { ns: 'editor' })
    case 'hallway':
      return t('electrical.ruleWord.hallway', 'hallway', { ns: 'editor' })
    case 'none':
      return t('electrical.noneRequired', 'none required', { ns: 'editor' })
    default:
      return rule
  }
}

function TypeSelect({ id, label, value, options, onChange, testId }: { readonly id: string; readonly label: string; readonly value: string; readonly options: readonly string[]; readonly onChange: (v: string) => void; readonly testId: string }) {
  return (
    <Field className="min-w-44 flex-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {typeName(o)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

/**
 * Electrical › Propose receptacles. Pick the rooms and the receptacle type
 * for each kind of location; the panel shows where NEC 210.52 spacing (or a
 * commercial density preset) puts them, as ghosts in the plan and as a list,
 * with each room's coverage. Untick any you don't want, then Accept all or
 * Accept selected: one undoable edit that places devices and puts nothing on
 * a circuit (circuit them afterwards with Add to circuit or a room template).
 * While a hovered room's ghosts show, a click on that room in the plan places
 * them (one edit, one undo); a click anywhere else selects as before.
 * Esc or Close leaves the model unchanged. The agent's bim_propose_receptacles
 * and bim_accept_receptacles send the same command.
 */
export function ProposePanel({ model, nec, levelId, editBlocked, submit, onPreview, onFrame, onClose, onDone, subscribeHover, setClickHandler }: { readonly model: ModelState; readonly nec: NecRules; readonly levelId: string | null; readonly editBlocked: string | null; readonly submit: SubmitCommand; readonly onPreview: (ghosts: readonly ProposalGhost[] | null) => void; readonly onFrame?: (points: readonly Vec2[]) => void; readonly onClose: () => void; readonly onDone: (placed: number) => void; readonly subscribeHover?: (listener: (ids: readonly string[] | null) => void) => () => void; readonly setClickHandler?: (handler: ClickHandler) => () => void }) {
  const t = useEditorTranslate()
  const rooms = useMemo(() => elementsOfKind(model.elements, 'room').sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }) || a.name.localeCompare(b.name)), [model.elements])
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [mode, setMode] = useState<'dwelling' | 'density'>('dwelling')
  const [preset, setPreset] = useState<DensityPreset | null>(null)
  const [wallType, setWallType] = useState(firstType('wall'))
  const [counterType, setCounterType] = useState(firstType('countertop'))
  const [bathType, setBathType] = useState(firstType('bathroom'))
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Density is a firm preset, not code: it needs no edition. Dwelling spacing is 210.52 of the picked edition.
  const rules = useMemo(() => (mode === 'density' ? densityReceptacleRules() : nec.necEdition ? receptaclePlacementRules(nec.necEdition) : null), [mode, nec.necEdition])
  const mounts = useMemo(() => wallMountsFor(model, [wallType, counterType, bathType]), [model, wallType, counterType, bathType])
  const request = useMemo<ReceptacleRequest | null>(() => (rules ? { mode, ...(preset ? { preset } : {}), rules, devices: { wall: wallType, countertop: counterType, bathroom: bathType }, mounts } : null), [rules, mode, preset, wallType, counterType, bathType, mounts])
  const geometry = useMemo<RoomGeometry[]>(() => receptacleRoomGeometries(model, [...picked], { applianceMarks: rules?.applianceMarks ?? [] }), [model, picked, rules])
  const proposeFor = useCallback((rooms: readonly RoomGeometry[]) => (request ? proposeReceptacles(rooms, request) : null), [request])
  const proposal = useMemo(() => (geometry.length > 0 && (mode === 'dwelling' || preset) ? proposeFor(geometry) : null), [proposeFor, geometry, mode, preset])

  const kept = useMemo(() => proposal?.devices.filter((d) => !dropped.has(d.key)) ?? [], [proposal, dropped])
  // Hover a room in the plan: its ghosts, and the same for the rooms like it (Esc clears it).
  const hovered = useHoveredRoom(subscribeHover, model.elements)
  const [hoverDismissed, setHoverDismissed] = useState<string | null>(null)
  const hoverRoomId = hovered && hovered !== hoverDismissed && model.elements[hovered]?.kind === 'room' && !picked.has(hovered) ? hovered : null
  const hoverProposal = useMemo(() => (request && hoverRoomId && (mode === 'dwelling' || preset) ? proposeFor(receptacleRoomGeometries(model, [hoverRoomId], { applianceMarks: rules?.applianceMarks ?? [] })) : null), [proposeFor, request, hoverRoomId, mode, preset, model, rules])
  const similar = useMemo(() => (hoverRoomId ? similarRooms(model.elements, hoverRoomId).filter((id) => model.elements[id]?.kind === 'room') : []), [hoverRoomId, model.elements])
  const levelOfRoom = useMemo(() => {
    const byName = new Map(elementsOfKind(model.elements, 'level').map((l) => [l.name, l.id]))
    return (roomId: string) => byName.get(model.elements[roomId]?.partition?.level ?? '') ?? levelId
  }, [model.elements, levelId])
  const coverage = useMemo(() => {
    if (!proposal || !request) return new Map<string, boolean>()
    return new Map(proposal.rooms.map((r) => {
      const g = geometry.find((x) => x.id === r.roomId)
      const mine = kept.filter((d) => d.roomId === r.roomId).map((d) => d.position)
      return [r.roomId, g ? checkReceptacleCoverage(g, request, mine).every((c) => c.passes) : false]
    }))
  }, [proposal, request, geometry, kept])

  const shownGhosts = useMemo(() => (picked.size > 0 ? kept : (hoverProposal?.devices ?? NO_DEVICES)), [picked, kept, hoverProposal])
  useEffect(() => {
    if (shownGhosts.length === 0) return onPreview(null)
    onPreview(shownGhosts.flatMap((d) => {
      const definition = definitionOf(model, d.typeId)
      const on = levelOfRoom(d.roomId)
      return definition && on ? [{ typeId: d.typeId, definition, levelId: on, position: d.position, offsetMm: d.heightMm, rotationDeg: d.rotationDeg }] : []
    }))
  }, [shownGhosts, levelOfRoom, model, onPreview])
  useEffect(() => () => onPreview(null), [onPreview])
  // Ticking rooms frames them, so the ghosts can be seen at a useful scale.
  const framePoints = useMemo(() => rooms.filter((r) => picked.has(r.id)).flatMap((r) => r.outline), [rooms, picked])
  useEffect(() => {
    if (framePoints.length > 0) onFrame?.(framePoints)
  }, [framePoints, onFrame])
  useEffect(() => {
    // A tooltip or hover card dismissing itself marks Esc handled, so that can't gate it; an open list, menu or dialog keeps its own Esc.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (e.target instanceof Element && e.target.closest('[role="listbox"], [role="menu"], [role="dialog"]')) return
      // The first Esc clears a hover preview; the next closes it.
      if (hoverRoomId) return setHoverDismissed(hoverRoomId)
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, hoverRoomId])

  const acceptBlocked =
    editBlocked ??
    (!rules ? t('electrical.pickTheNECEditionFirst', 'Pick the NEC edition first.', { ns: 'editor' }) : picked.size === 0 ? t('electrical.tickTheRoomsToProposeFor', 'Tick the rooms to propose for.', { ns: 'editor' }) : mode === 'density' && !preset ? t('electrical.chooseLightMediumOrHeavy', 'Choose light, medium or heavy.', { ns: 'editor' }) : !proposal || proposal.devices.length === 0 ? t('electrical.nothingToPlaceTheseRoomsAlreadyHaveWhatTheRu', 'Nothing to place: these rooms already have what the rule asks for.', { ns: 'editor' }) : null)
  /** Place the hovered room's proposal, or the same in it and every similar room: one edit either way. */
  const acceptHovered = (withSimilar: boolean) => {
    if (!request || !hoverRoomId) return
    const ids = withSimilar ? [hoverRoomId, ...similar] : [hoverRoomId]
    const all = proposeFor(receptacleRoomGeometries(model, ids, { applianceMarks: rules?.applianceMarks ?? [] }))
    if (!all) return
    const command = acceptProposalCommand(model, all, null, levelId ? { fallbackLevelId: levelId } : {})
    if (typeof command === 'string') return setError(command)
    const refusal = submit(command, command.label)
    if (refusal) return setError(refusal)
    onDone(command.devices.length)
  }
  // A click on the previewed room places its ghosts, while they are what the plan shows and the model can be edited.
  const clickRoomId = setClickHandler && picked.size === 0 && editBlocked === null && hoverRoomId && (hoverProposal?.devices.length ?? 0) > 0 ? hoverRoomId : null
  const acceptHoveredRef = useRef(acceptHovered)
  useEffect(() => {
    acceptHoveredRef.current = acceptHovered
  })
  const elements = model.elements
  useEffect(() => {
    if (!setClickHandler || !clickRoomId) return
    const claims = (ids: readonly string[]) => hoveredRoomOf(elements, ids) === clickRoomId
    return setClickHandler({
      claims,
      click: (ids) => {
        if (!claims(ids)) return false
        acceptHoveredRef.current(false)
        return true
      },
    })
  }, [setClickHandler, clickRoomId, elements])
  const hoverRoom = hoverRoomId ? model.elements[hoverRoomId] : undefined
  const hoverName = hoverRoom?.kind === 'room' ? `${hoverRoom.name} ${hoverRoom.number}` : ''

  const accept = (keepOnly: boolean) => {
    if (!proposal) return
    const keys = keepOnly ? kept.map((d) => d.key) : null
    const command = acceptProposalCommand(model, proposal, keys, levelId ? { fallbackLevelId: levelId } : {})
    if (typeof command === 'string') return setError(command)
    const refusal = submit(command, command.label)
    if (refusal) return setError(refusal)
    onDone(command.devices.length)
  }

  return (
    <section className="flex min-h-0 flex-col gap-3 p-3" aria-label={t('electrical.proposeReceptacles', 'Propose receptacles', { ns: 'editor' })} data-testid="propose-panel">
      <header className="flex items-center gap-2">
        <h2 className="text-sm font-medium">{t('electrical.proposeReceptacles', 'Propose receptacles', { ns: 'editor' })}</h2>
        <span className="text-xs text-muted-foreground">{nec.label}</span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close propose receptacles" onClick={onClose} data-testid="propose-close">
          <X />
        </Button>
      </header>
      {rooms.length === 0 ? (
        <Empty className="border py-6" data-testid="propose-no-rooms">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SquareDashed />
            </EmptyMedia>
            <EmptyTitle>{t('electrical.noRoomsInThisModelYet', 'No rooms in this model yet', { ns: 'editor' })}</EmptyTitle>
            <EmptyDescription>Proposals measure rooms: their walls, doors and counters. Ask the agent in Cmd+J to trace the rooms from the architect&apos;s plan, then open this again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-auto">
              <FieldLabel>{t('electrical.rule', 'Rule', { ns: 'editor' })}</FieldLabel>
              <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => (v === 'dwelling' || v === 'density') && setMode(v)} data-testid="propose-mode">
                <ToggleGroupItem value="dwelling">{t('electrical.dwellingNEC21052', 'Dwelling (NEC 210.52)', { ns: 'editor' })}</ToggleGroupItem>
                <ToggleGroupItem value="density">{t('electrical.commercialDensity', 'Commercial density', { ns: 'editor' })}</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            {mode === 'density' && rules && (
              <Field className="w-auto">
                <FieldLabel>{t('electrical.densityYourChoiceNotACodeMinimum', 'Density (your choice, not a code minimum)', { ns: 'editor' })}</FieldLabel>
                <ToggleGroup type="single" variant="outline" size="sm" value={preset ?? ''} onValueChange={(v) => setPreset(v === 'light' || v === 'medium' || v === 'heavy' ? v : null)} data-testid="propose-preset">
                  {(['light', 'medium', 'heavy'] as const).map((p) => (
                    <ToggleGroupItem key={p} value={p} data-testid={`propose-preset-${p}`}>
                      {rules.presets[p].label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            )}
            {!nec.necEdition && (
              <Field className="w-36">
                <FieldLabel htmlFor="bm-propose-nec">{t('electrical.necEdition', 'NEC edition', { ns: 'editor' })}</FieldLabel>
                <Select value={nec.picked ?? ''} onValueChange={(v) => nec.pick(NEC_EDITIONS.find((e): e is NecEditionYear => e === v) ?? null)}>
                  <SelectTrigger id="bm-propose-nec" data-testid="propose-nec">
                    <SelectValue placeholder="Pick one" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {NEC_EDITIONS.map((e) => (
                        <SelectItem key={e} value={e}>
                          NEC {e}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <TypeSelect id="bm-propose-wall" label={CHOICE.wall?.label ?? ''} value={wallType} options={CHOICE.wall?.types ?? []} onChange={setWallType} testId="propose-wall-type" />
            {mode === 'dwelling' && <TypeSelect id="bm-propose-counter" label={CHOICE.countertop?.label ?? ''} value={counterType} options={CHOICE.countertop?.types ?? []} onChange={setCounterType} testId="propose-counter-type" />}
            {mode === 'dwelling' && <TypeSelect id="bm-propose-bath" label={CHOICE.bathroom?.label ?? ''} value={bathType} options={CHOICE.bathroom?.types ?? []} onChange={setBathType} testId="propose-bath-type" />}
          </div>
          <Field>
            <FieldLabel>{t('electrical.rooms', 'Rooms', { ns: 'editor' })}</FieldLabel>
            <div className="flex flex-wrap gap-x-4 gap-y-1" data-testid="propose-rooms">
              {rooms.map((r) => (
                <Label key={r.id} className="flex items-center gap-1.5 text-xs font-normal">
                  <Checkbox
                    aria-label={`Propose for ${r.name} ${r.number}`}
                    checked={picked.has(r.id)}
                    onCheckedChange={(on) => {
                      setError(null)
                      setPicked(on === true ? new Set([...picked, r.id]) : new Set([...picked].filter((x) => x !== r.id)))
                    }}
                    data-testid={`propose-room-${r.number}`}
                  />
                  {r.name} <span className="text-muted-foreground">{r.number}</span>
                </Label>
              ))}
            </div>
          </Field>
          {hoverProposal && hoverRoomId && (
            <Alert data-testid="propose-hover">
              <AlertTitle>
                {hoverName}: {hoverProposal.devices.length} proposed
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>{hoverProposal.devices.length === 0 ? t('electrical.thisRoomAlreadyHasWhatTheRuleAsksFor', 'This room already has what the rule asks for.', { ns: 'editor' }) : clickRoomId ? `Click the room to place these ${hoverProposal.devices.length}, or press Esc.` : `Place these ${hoverProposal.devices.length}, or press Esc.`}</span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={editBlocked !== null || hoverProposal.devices.length === 0} title={editBlocked ?? undefined} onClick={() => acceptHovered(false)} data-testid="propose-hover-place">
                    {t('electrical.placeThese', 'Place these', { ns: 'editor' })} {hoverProposal.devices.length}
                  </Button>
                  {similar.length > 0 && (
                    <Button size="sm" variant="outline" disabled={editBlocked !== null || hoverProposal.devices.length === 0} title={editBlocked ?? undefined} onClick={() => acceptHovered(true)} data-testid="propose-hover-similar">
                      {similar.length} similar room{similar.length === 1 ? '' : 's'}: do the same
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
          {proposal && (
            <>
              <Alert data-testid="propose-summary">
                {proposal.passes ? <CircleCheck /> : <CircleAlert />}
                <AlertTitle>{proposal.summary}</AlertTitle>
                <AlertDescription>{t('electrical.untickAnyYouDonAposTWantNothingIsPutOnACircu', 'Untick any you don&apos;t want. Nothing is put on a circuit: use Add to circuit or a room template afterwards.', { ns: 'editor' })}</AlertDescription>
              </Alert>
              <ItemGroup className="gap-1" data-testid="propose-preview">
                {proposal.rooms.map((r) => (
                  <Item key={r.roomId} variant="outline" size="sm" data-testid="propose-room-result" data-room={r.roomId}>
                    <ItemContent>
                      <ItemTitle className="text-xs">
                        {r.label}
                        <Badge variant="outline">{ruleWord(r.rule, t)}</Badge>
                        {r.runs.length > 0 &&
                          (coverage.get(r.roomId) ? (
                            <Badge variant="secondary" data-testid="propose-room-covered">
                              {t('electrical.covered', 'Covered', { ns: 'editor' })}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" data-testid="propose-room-gap">
                              {t('electrical.gapLeft', 'Gap left', { ns: 'editor' })}
                            </Badge>
                          ))}
                      </ItemTitle>
                      <ItemDescription className="text-xs">{r.ruleBasis}</ItemDescription>
                      <div className="flex flex-col gap-0.5">
                        {r.devices.map((d) => (
                          <Label key={d.key} className="flex items-start gap-1.5 text-xs font-normal" data-testid="propose-device">
                            <Checkbox
                              aria-label={t('electrical.keepKindReceptacle', 'Keep {{kind}} receptacle {{key}}', { ns: 'editor', kind: kindWord(d.kind, t), key: d.key })}
                              checked={!dropped.has(d.key)}
                              onCheckedChange={(on) => setDropped(on === true ? new Set([...dropped].filter((k) => k !== d.key)) : new Set([...dropped, d.key]))}
                            />
                            <span>
                              {kindWord(d.kind, t)}{t('electrical.kindReason', ': {{reason}}', { ns: 'editor', reason: d.reason })}{' '}
                              <span className="text-muted-foreground">
                                {t('electrical.heightUp', '({{cite}}, {{height}} up)', { ns: 'editor', cite: d.cite, height: proposalFeetInches(d.heightMm) })}
                              </span>
                            </span>
                          </Label>
                        ))}
                        {r.notes.map((n) => (
                          <p key={n} className="text-xs text-muted-foreground">
                            {n}
                          </p>
                        ))}
                      </div>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </>
          )}
        </div>
      )}
      {error && (
        <FieldDescription className="text-danger-600" role="alert">
          {error}
        </FieldDescription>
      )}
      {rooms.length > 0 && (
        <footer className="flex flex-wrap items-center gap-2">
          <Button onClick={() => accept(false)} disabled={acceptBlocked !== null} title={acceptBlocked ?? undefined} data-testid="propose-accept-all">
            {t('electrical.acceptAll', 'Accept all', { ns: 'editor' })}{proposal ? ` ${proposal.devices.length}` : ''}
          </Button>
          <Button variant="outline" onClick={() => accept(true)} disabled={acceptBlocked !== null || kept.length === 0 || kept.length === proposal?.devices.length} title={acceptBlocked ?? (kept.length === proposal?.devices.length ? t('electrical.untickTheOnesYouDonTWantFirst', 'Untick the ones you don’t want first', { ns: 'editor' }) : undefined)} data-testid="propose-accept-selected">
            {t('electrical.acceptSelected', 'Accept selected', { ns: 'editor' })} {kept.length}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('electrical.cancelEsc', 'Cancel (Esc)', { ns: 'editor' })}
          </Button>
          {acceptBlocked && <span className="text-xs text-muted-foreground" data-testid="propose-why">{acceptBlocked}</span>}
        </footer>
      )}
    </section>
  )
}
