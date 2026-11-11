import {
  derivedRegionsOfZone,
  elementsOfKind,
  fitsZonePurpose,
  outlineAreaMm2,
  pinnedUse,
  spaceBasis,
  spaceLabel,
  zoneBoundsOf,
  zoneSpaceIds,
  zonesOfSpace,
  type Command,
  type ElementId,
  type ModelState,
  type QuantityTotals,
  type Space,
  type Zone,
  type ZonePurpose,
} from '@permitzip/bim-kernel'
import { SPACE_USE_RATE_TARGETS, spaceUseCatalog, spaceUseRateTargets, type SpaceUseRow } from '@permitzip/bim-library'
import { requireAddOns } from '../../contracts/building-model/add-ons'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * What the Spaces panel shows, worked out from the model: one row per space
 * with its level, use, area (from geometry) and occupants, and allocated vs
 * actual load when the loads layer can say. Pure, so the panel and its tests
 * read the same rows.
 */

const FT2_PER_M2 = 10.7639104

export interface AllocatedActualSummary {
  readonly allocated: QuantityTotals
  readonly actual: QuantityTotals
}

/** The loads layer's answer for a space (k2-loads); absent until that layer is mounted. */
export type SpaceLoadsReader = (spaceId: ElementId) => AllocatedActualSummary | null

export interface SpaceRow {
  readonly id: ElementId
  readonly number: string
  readonly name: string
  readonly label: string
  readonly levelId: ElementId | null
  readonly levelName: string | null
  readonly useName: string | null
  readonly useId: string | null
  /** ft², or null when not drawn yet. */
  readonly areaFt2: number | null
  readonly occupants: number | null
  readonly occupantsTyped: boolean
  readonly zones: readonly string[]
  readonly origin: Space['origin']['kind']
  /** "Drawn", "Traced over A-101.pdf", "Not drawn yet". */
  readonly madeBy: string
  readonly loads: AllocatedActualSummary | null
}

function madeBy(model: ModelState, s: Space, t: Translate): string {
  if (s.bounds.kind === 'none' || !s.levelId) return t('spaces.notDrawnYet', 'Not drawn yet', { ns: 'editor' })
  if (s.bounds.kind === 'bounded') return s.bounds.open ? t('spaces.boundedOpen', 'Bounded by walls; no longer closed', { ns: 'editor' }) : t('spaces.boundedByWalls', 'Bounded by walls', { ns: 'editor' })
  switch (s.origin.kind) {
    case 'traced': {
      const u = model.elements[s.origin.underlayId]
      return t('spaces.tracedOver', 'Traced over {{drawing}}', { ns: 'editor', drawing: u?.kind === 'drawing_underlay' ? u.source.name : t('spaces.aRemovedDrawing', 'a removed drawing', { ns: 'editor' }) })
    }
    case 'from_room':
      return t('spaces.fromTheRoom', 'From the room', { ns: 'editor' })
    case 'from_linked_room':
      return t('spaces.fromLinkedRoom', 'From the linked model\'s room', { ns: 'editor' })
    case 'detected':
      return s.origin.accepted ? t('spaces.detectedAccepted', 'Detected, accepted', { ns: 'editor' }) : t('spaces.detectedProposed', 'Proposed, check it', { ns: 'editor' })
    default:
      return t('spaces.drawn', 'Drawn', { ns: 'editor' })
  }
}

export function spaceRows(model: ModelState, loads?: SpaceLoadsReader, t: Translate = englishOnly): SpaceRow[] {
  return elementsOfKind(model.elements, 'space')
    .map((s) => {
      const basis = spaceBasis(model.elements, s)
      const level = s.levelId ? model.elements[s.levelId] : undefined
      const use = pinnedUse(s)
      return {
        id: s.id,
        number: s.number,
        name: s.name,
        label: spaceLabel(s),
        levelId: s.levelId ?? null,
        levelName: level?.kind === 'level' ? level.name : null,
        useName: use?.name ?? null,
        useId: s.use?.useId ?? null,
        areaFt2: basis.areaM2 === null ? null : basis.areaM2 * FT2_PER_M2,
        occupants: basis.occupants,
        occupantsTyped: basis.occupantsBasis === 'typed',
        zones: zonesOfSpace(model.elements, s.id).map((z) => z.name),
        origin: s.origin.kind,
        madeBy: madeBy(model, s, t),
        loads: loads?.(s.id) ?? null,
      }
    })
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }) || a.name.localeCompare(b.name))
}

export interface ZoneRow {
  readonly zone: Zone
  readonly servedByMark: string | null
  readonly spaceLabels: readonly string[]
  /** For a zone not made of spaces: what it covers, in words ("Drawn outline, 420 sq ft", "Follows P1: …"). */
  readonly boundsLine: string | null
  /** True when spaces can be added to it (a spaces zone). */
  readonly ofSpaces: boolean
}

function markOf(model: ModelState, id: ElementId): string {
  const el = model.elements[id]
  return el && 'mark' in el && typeof el.mark === 'string' && el.mark.trim() !== '' ? el.mark : id
}

/** What an outlined, derived or unknown zone covers, in words. Null for a spaces zone. */
export function zoneBoundsLine(model: ModelState, zone: Zone, t: Translate = englishOnly): string | null {
  const b = zoneBoundsOf(zone)
  switch (b.kind) {
    case 'spaces':
      return null
    case 'outline':
      return t('spaces.zoneDrawnOutline', 'Drawn outline, {{area}}', { ns: 'editor', area: formatFt2((outlineAreaMm2(b.outline) / 1e6) * FT2_PER_M2) })
    case 'derived': {
      const r = derivedRegionsOfZone(model, zone)
      if (!r || !r.ok) return r ? r.reason : null
      const first = r.regions[0]
      const highFt = first ? Math.round(((first.topMm - first.bottomMm) / 304.8) * 10) / 10 : null
      return `${t('spaces.zoneFollows', 'Follows {{mark}}', { ns: 'editor', mark: markOf(model, b.hostId) })}${highFt === null ? '' : t('spaces.zoneUpTo', ': up to {{feet}} ft above it', { ns: 'editor', feet: highFt })}${first?.cite ? `, ${first.cite}` : ''}`
    }
    case 'unknown':
      return t('spaces.zoneUnknownKind', 'A kind of zone this version can’t show yet; it is kept as it is', { ns: 'editor' })
  }
}

export function zoneRows(model: ModelState, t: Translate = englishOnly): ZoneRow[] {
  return elementsOfKind(model.elements, 'zone').map((zone) => {
    const mark = zone.servedBy ? markOf(model, zone.servedBy) : null
    const spaceLabels = zoneSpaceIds(zone).flatMap((id) => {
      const s = model.elements[id]
      return s?.kind === 'space' ? [spaceLabel(s)] : []
    })
    return { zone, servedByMark: mark, spaceLabels, boundsLine: zoneBoundsLine(model, zone, t), ofSpaces: zoneBoundsOf(zone).kind === 'spaces' }
  })
}

export interface ZoneServer {
  readonly id: ElementId
  readonly label: string
}

const FIT_HEADINGS: Readonly<Partial<Record<ZonePurpose, 'hvac' | 'electrical' | 'plumbing'>>> = {
  thermal: 'hvac',
  ventilation: 'hvac',
  electrical_load_region: 'electrical',
  lighting_control: 'electrical',
  drainage_catchment: 'plumbing',
}

/** The picker's heading for equipment that fits a zone's purpose; other equipment is listed after it. */
export function zoneFitHeading(purpose: ZonePurpose, t: Translate = englishOnly): string {
  switch (FIT_HEADINGS[purpose]) {
    case 'hvac':
      return t('spaces.fitHvac', 'Heating and cooling equipment', { ns: 'editor' })
    case 'electrical':
      return t('spaces.fitElectrical', 'Electrical equipment', { ns: 'editor' })
    case 'plumbing':
      return t('spaces.fitPlumbing', 'Plumbing equipment', { ns: 'editor' })
    default:
      return t('spaces.fitEquipment', 'Equipment', { ns: 'editor' })
  }
}

/**
 * Equipment a zone can be assigned to (placed or planned parts and legacy
 * equipment, by mark), split by whether it fits the zone's purpose in the
 * shared connection model (`fitsZonePurpose`): for a thermal zone the RTUs
 * come first, the fryers and dishwasher after them under "Other equipment".
 */
export function zoneServers(model: ModelState, purpose: ZonePurpose, t: Translate = englishOnly): { readonly fits: readonly ZoneServer[]; readonly others: readonly ZoneServer[] } {
  const fits: ZoneServer[] = []
  const others: ZoneServer[] = []
  for (const el of elementsOfKind(model.elements, 'part', 'equipment')) {
    if (el.mark.trim() === '') continue
    const type = el.kind === 'part' ? model.elements[el.typeId] : undefined
    const category = type?.kind === 'part_type' ? type.definition.category : 'mechanical_equipment'
    if (category !== 'mechanical_equipment' && category !== 'electrical_equipment') continue
    // Hoisted: a nested template inside the argument reads as prose to the
    // negative-space scan, and this suffix is already keyed.
    const notPlaced = el.kind === 'part' && el.planned ? ` ${t('spaces.notPlacedYet', '(not placed yet)', { ns: 'editor' })}` : ''
    const row = { id: el.id, label: `${el.mark}${notPlaced}` }
    const fit = el.kind === 'part' ? fitsZonePurpose(model.elements, el, purpose) : purpose === 'fire_area'
    ;(fit ? fits : others).push(row)
  }
  const byLabel = (a: ZoneServer, b: ZoneServer) => a.label.localeCompare(b.label, undefined, { numeric: true })
  return { fits: fits.sort(byLabel), others: others.sort(byLabel) }
}

export function formatFt2(v: number | null): string {
  return v === null ? '—' : `${Math.round(v).toLocaleString('en-US')} sq ft`
}

/** The space uses a firm can pick, built-in rows plus the firm's own. */
export const SPACE_USES: readonly SpaceUseRow[] = spaceUseCatalog().catalog.rows

/** The space uses a person can pick in this model: built-in rows plus the rates and rows of the add-ons it pins. */
export function spaceUsesIn(model: Pick<ModelState, 'modelId' | 'settings'>): readonly SpaceUseRow[] {
  return requireAddOns().host.withPinnedPacks(model, () => spaceUseCatalog().catalog.rows)
}

/**
 * A `set use` edit for one space, with the row's rates pinned; or why not, in words.
 * With `model`, the rows and rate keys of the add-ons it pins are in force, so an add-on's rate (a live load) is pinned too.
 */
export function setUseCommand(spaceId: ElementId, useId: string | null, uses: readonly SpaceUseRow[] = SPACE_USES, model?: Pick<ModelState, 'modelId' | 'settings'>, t: Translate = englishOnly): Command | string {
  if (useId === null) return { type: 'edit_space', spaceId, use: null }
  const pin = (): Command | string => {
    const rows = model ? spaceUseCatalog().catalog.rows : uses
    const row = rows.find((u) => u.id === useId)
    if (!row) return t('spaces.useNotFound', 'There is no space use {{use}} in the library', { ns: 'editor', use: useId })
    const { calc } = requireAddOns()
    const pinned = calc.pinSpaceUse('builtin:space-uses', row, model ? spaceUseRateTargets() : SPACE_USE_RATE_TARGETS)
    if (typeof pinned === 'string') return pinned
    return { type: 'edit_space', spaceId, use: calc.pinnedUseForCommand(pinned) }
  }
  return model ? requireAddOns().host.withPinnedPacks(model, pin) : pin()
}

/** The next free space number on a level (101, 102, …), for the typed row and the Draw space tool. */
export function nextSpaceNumber(model: ModelState, levelId: ElementId | null): string {
  let max = 100
  for (const s of elementsOfKind(model.elements, 'space')) {
    if ((s.levelId ?? null) !== levelId) continue
    const n = Number.parseInt(s.number, 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return String(max + 1)
}
