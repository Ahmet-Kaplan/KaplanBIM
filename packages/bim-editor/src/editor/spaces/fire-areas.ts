import {
  containsPoint,
  elementsOfKind,
  outlineAreaMm2,
  proposeRatedZones,
  zoneBoundsOf,
  type Command,
  type ElementId,
  type ModelState,
  type RatedZoneProposal,
} from '@permitzip/bim-kernel'
import { activePackSet, modelPackSet, withModelPacks, type PackSet } from '@permitzip/bim-kernel/packs'
import { formatRating, RATING_KIND_POINT, type RatingKindRow } from '@permitzip/bim-kernel/rated-routes'
import { newElementId } from '../placement'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * "Fire areas from rated walls": the closed areas walls rated at least a
 * level of an add-on's rating kind make on the plan's level (rated walls that
 * don't bound rooms included), for the person to accept as fire-area zones.
 * Nothing is written until Accept; each Accept (or Accept all) is one undo
 * step. Pure, so the hook and the tests share it.
 */

/** Said when the level has no closed rated area at all. A function, not a constant: a constant would carry English into a Turkish panel. */
export const noRatedAreas = (t: Translate = englishOnly): string => t('spaces.noRatedAreas', 'No closed rated areas on this level: check the walls’ fire ratings', { ns: 'editor' })

/** Said when no add-on in force rates walls, so nothing could ever close an area. */
export const noRatingKinds = (t: Translate = englishOnly): string =>
  t('spaces.noRatingKinds', 'No add-on in force rates walls. Turn on the Architecture add-on (or another that gives wall ratings) to find fire areas.', { ns: 'editor' })

/** What the person picked: walls rated at least `atLeast` of `kindId`. */
export interface RatedPick {
  readonly kindId: string
  readonly atLeast: number
}

/** The add-ons the model is open with (built-ins when none is bound). */
export function packSetOf(model: ModelState): PackSet {
  return modelPackSet(model.modelId) ?? activePackSet()
}

/** The rating kinds that are an amount ("1-hour"), not a yes / no: the ones a fire area can be closed by. */
export function areaRatingKinds(set: PackSet = activePackSet()): readonly RatingKindRow[] {
  return set.items(RATING_KIND_POINT).filter((r: RatingKindRow) => r.unit.trim().length > 0)
}

/** The rating a person most likely means: one in hours, at one hour (else its lowest level). Null with no kind. */
export function defaultRatedPick(kinds: readonly RatingKindRow[]): RatedPick | null {
  const kind = kinds.find((k) => /^h(ou)?rs?$/i.test(k.unit.trim())) ?? kinds[0]
  if (!kind) return null
  const levels = kind.levels ?? []
  return { kindId: kind.id, atLeast: levels.length === 0 || levels.includes(1) ? 1 : (levels.find((v) => v >= 1) ?? levels[0] ?? 1) }
}

/** "1-hour or more" for the picker. */
export function atLeastWords(kind: RatingKindRow, value: number, t: Translate = englishOnly): string {
  return t('spaces.atLeastOrMore', '{{rating}} or more', { ns: 'editor', rating: formatRating(kind, value) })
}

const SAME_AREA = 0.005

/** The fire-area zones already outlined on the level (a proposal they already cover isn't offered again). */
function coveredBy(model: ModelState, levelId: ElementId, p: RatedZoneProposal): boolean {
  const area = p.areaM2 * 1e6
  return elementsOfKind(model.elements, 'zone').some((z) => {
    if (z.purpose !== 'fire_area') return false
    const b = zoneBoundsOf(z)
    if (b.kind !== 'outline' || b.levelId !== levelId) return false
    return containsPoint(b.outline, p.centre) && Math.abs(outlineAreaMm2(b.outline) - area) <= SAME_AREA * area
  })
}

export type FireAreaOutcome =
  | { readonly kind: 'review'; readonly proposals: readonly RatedZoneProposal[]; readonly alreadyZones: number }
  | { readonly kind: 'empty'; readonly message: string }

/** Read under the model's own add-ons (the ratings come from them). */
export function proposeFireAreas(model: ModelState, levelId: ElementId, pick: RatedPick, t: Translate = englishOnly): FireAreaOutcome {
  const found = withModelPacks(model.modelId, () => proposeRatedZones(model.elements, levelId, { ratingKind: pick.kindId, atLeast: pick.atLeast }))
  const fresh = found.filter((p) => !coveredBy(model, levelId, p))
  if (fresh.length === 0)
    return {
      kind: 'empty',
      message: found.length > 0 ? t('spaces.everyAreaHasZone', 'Every closed rated area on this level already has a fire-area zone.', { ns: 'editor' }) : noRatedAreas(t),
    }
  return { kind: 'review', proposals: fresh, alreadyZones: found.length - fresh.length }
}

/**
 * "Fire area N", numbered on from the model's highest.
 *
 * The number is read off the *trailing digits* of a fire-area zone's name, not
 * off an English prefix: the name is written in the language the person works
 * in (`spaces.fireAreaName`), and a Turkish model whose zones read *Yangın
 * bölgesi 3* must still get 4 from an English screen.
 */
function nextFireAreaNumber(model: ModelState): number {
  let n = 0
  for (const z of elementsOfKind(model.elements, 'zone')) {
    if (z.purpose !== 'fire_area') continue
    const m = /(\d+)\s*$/u.exec(z.name)
    if (m) n = Math.max(n, Number(m[1]))
  }
  return n + 1
}

/** The proposals as fire-area zones in one undoable step; null when there are none. */
export function fireAreaZonesCommand(model: ModelState, levelId: ElementId, proposals: readonly RatedZoneProposal[], t: Translate = englishOnly): Command | null {
  if (proposals.length === 0) return null
  let n = nextFireAreaNumber(model)
  const commands = proposals.map((p) => ({
    type: 'create_zone' as const,
    zoneId: newElementId('zone'),
    name: t('spaces.fireAreaName', 'Fire area {{number}}', { ns: 'editor', number: n++ }),
    purpose: 'fire_area' as const,
    outline: { levelId, outline: p.outline.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) })) },
  }))
  const [only] = commands
  if (commands.length === 1 && only) return only
  return { type: 'batch_edits', label: t('spaces.addFireAreasCount', 'Add {{count}} fire areas', { ns: 'editor', count: commands.length }), commands }
}
