import {
  type BimElement,
  type ElementId,
  type PressureState,
} from '@permitzip/bim-kernel'
import {
  AIR_ROLE_WORDS,
  netCfm,
  pressurizationOf,
  pressurizationScopeZones,
  signedCfm,
  signedContributorCfm,
  type PressurizationScope,
  type PressurizationSet,
} from '@permitzip/bim-pack-mechanical'
import { to } from '@permitzip/bim-units'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * The Pressurization section's rows (Building Model › Ventilation): one line
 * per zone and one for the building, each with exhaust, makeup air, outdoor air,
 * net and the verdict against its target, plus the items behind each line and
 * the makeup-air load. Plain strings ready to print; the kernel did the sums.
 */

export type PressurizationVerdict = 'meets' | 'misses' | 'no_target' | 'incomplete' | 'nothing'

export interface PressurizationItemRow {
  readonly partId: ElementId
  readonly label: string
  readonly role: string
  /** "+2,400" / "−3,000" / "—". */
  readonly cfm: string
  readonly missing: string | null
  readonly planned: boolean
}

export interface PressurizationRow {
  readonly id: string
  readonly name: string
  readonly exhaust: string
  readonly makeup: string
  readonly outdoor: string
  readonly net: string
  readonly state: PressureState | null
  readonly target: PressureState | null
  readonly verdict: PressurizationVerdict
  /** "net −220 cfm: negative (target negative, met)" or what is missing. */
  readonly text: string
  readonly why: string | null
  readonly items: readonly PressurizationItemRow[]
  /** "Kitchen spaces need 350 cfm of exhaust; fans draw 3,000." when the ventilation pack says so. */
  readonly exhaustNote: string | null
}

export interface MakeupHeatRow {
  readonly partId: ElementId
  readonly mark: string
  /** "2,400 × 1.08 × (92 − 80) = 31,104 Btu/h heating, added to RTU-2" or what to type. */
  readonly text: string
  readonly problem: boolean
}

export interface PressurizationView {
  readonly rows: readonly PressurizationRow[]
  readonly heat: readonly MakeupHeatRow[]
  /** Items that sit in no zone (counted for the building only). */
  readonly unassigned: readonly string[]
  readonly tolerance: string
  readonly empty: string | null
}

const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const cfmText = (v: number) => `${WHOLE.format(Math.round(v))} cfm`

function verdictOf(s: PressurizationSet): PressurizationVerdict {
  if (s.balance.status !== 'complete') return 'incomplete'
  if (s.balance.contributors.length === 0) return 'nothing'
  if (s.meetsTarget === null) return 'no_target'
  return s.meetsTarget ? 'meets' : 'misses'
}

function row(s: PressurizationSet, items: readonly PressurizationItemRow[], exhaustNote: string | null): PressurizationRow {
  const net = netCfm(s)
  return {
    id: s.id,
    name: s.name,
    exhaust: s.subtotals ? cfmText(to(s.subtotals.exhaust, 'cfm')) : '—',
    makeup: s.subtotals ? cfmText(to(s.subtotals.makeupAir, 'cfm')) : '—',
    outdoor: s.subtotals ? cfmText(to(s.subtotals.outdoorAir, 'cfm')) : '—',
    net: net === null ? '—' : `${signedCfm(net)} cfm`,
    state: s.state,
    target: s.target?.target ?? null,
    verdict: verdictOf(s),
    text: s.text,
    why: s.target?.why ?? null,
    items,
    exhaustNote,
  }
}

export function pressurizationView(elements: Readonly<Record<string, BimElement>>, scope: PressurizationScope, t: Translate = englishOnly): PressurizationView {
  const report = pressurizationOf(elements)
  const { zones, showBuilding } = pressurizationScopeZones(elements, report, scope)
  const item = (c: (typeof report.contributors)[number]): PressurizationItemRow => {
    const v = signedContributorCfm(c)
    return { partId: c.partId, label: c.label, role: AIR_ROLE_WORDS[c.role], cfm: v === null ? '—' : signedCfm(v), missing: c.value === null ? (c.missing ?? null) : null, planned: c.planned }
  }
  const rows: PressurizationRow[] = zones.map((z) => {
    const note =
      z.requiredExhaust === null
        ? null
        : `${t('balance.needsExhaust', 'Its spaces need {{cfm}} of exhaust (ventilation table)', { ns: 'editor', cfm: cfmText(to(z.requiredExhaust, 'cfm')) })}${z.exhaustShort ? t('balance.lessIsDrawn', '; less is drawn.', { ns: 'editor' }) : '.'}`
    return row(z, report.contributors.filter((c) => c.zoneIds.includes(z.zoneId)).map(item), note)
  })
  if (showBuilding) rows.push(row(report.building, report.contributors.map(item), null))
  const inScope = new Set(zones.map((z) => z.zoneId))
  const shownParts = new Set(showBuilding ? report.contributors.map((c) => c.partId) : report.contributors.filter((c) => c.zoneIds.some((id) => inScope.has(id))).map((c) => c.partId))
  const heat: MakeupHeatRow[] = report.heat
    .filter((h) => shownParts.has(h.partId))
    .map((h) => {
      if (!h.heat)
        return {
          partId: h.partId,
          mark: h.mark,
          text: h.missing ?? t('balance.noLoadWorkedOut', '{{mark}}: no load worked out.', { ns: 'editor', mark: h.mark }),
          problem: true,
        }
      const unit =
        h.servingUnits.length === 1
          ? t('balance.addedToUnit', ', added to {{unit}}', { ns: 'editor', unit: h.servingUnits[0]?.mark ?? '' })
          : h.servingUnits.length > 1
            ? t('balance.sharedByUnits', ', shared by {{units}}', { ns: 'editor', units: h.servingUnits.map((u) => u.mark).join(t('balance.andConjunction', ' and ', { ns: 'editor' })) })
            : t('balance.noUnitServes', ', and no unit serves its zone yet', { ns: 'editor' })
      return { partId: h.partId, mark: h.mark, text: `${h.heat.arithmetic} ${h.heat.direction}${unit}`, problem: false }
    })
  const empty =
    report.empty ??
    (rows.length === 0
      ? scope.kind === 'level'
        ? t('balance.noZonesOnLevel', 'No zones on this level yet. Make zones in the Spaces panel and assign their units.', { ns: 'editor' })
        : t('balance.noZones', 'No zones yet. Make zones in the Spaces panel and assign their units.', { ns: 'editor' })
      : null)
  return {
    rows,
    heat,
    unassigned: showBuilding ? report.unassigned.map((c) => c.label) : [],
    tolerance: t('balance.withinTolerance', 'Within ±{{cfm}} cfm counts as neutral.', { ns: 'editor', cfm: WHOLE.format(Math.round(to(report.tolerance, 'cfm'))) }),
    empty,
  }
}
