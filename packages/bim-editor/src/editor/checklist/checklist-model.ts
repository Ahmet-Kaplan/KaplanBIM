import { GRAPH_ANSWER_LIMIT, type Requirement } from '@permitzip/bim-kernel'
import { englishOnly, type Translate } from '../i18n/translate'
import { SHOW_AGENT_FOUND } from './decisions'

/**
 * The checklist's list, from the requirements graph: one group per cause
 * ("Room 104 is Assembly A-3", "fully sprinklered: allowable floor area
 * tripled"), most open items first, five per group then "and N more"
 * (product owner decision 6). A requirement from a second source for the same thing
 * in the same place sits beside the one that governs (decision 11).
 */

export interface ChecklistRow {
  /** The governing requirement. */
  readonly requirement: Requirement
  /** Requirements from other sources for the same key and place, shown side by side. */
  readonly conflicts: readonly Requirement[]
}

export interface ChecklistGroup {
  readonly cause: string
  readonly rows: readonly ChecklistRow[]
  /** Rows that still need something (not met, open, or unverified and unchecked). */
  readonly open: number
}

const FULFILMENT_ORDER: Readonly<Record<string, number>> = { not_met: 0, open: 1, unchecked: 2, met: 3 }

/** Whether a requirement still needs someone's attention. */
export function needsAttention(r: Requirement): boolean {
  if (r.status === 'withdrawn') return false
  if (r.fulfilment.state !== 'met') return true
  return r.status === 'proposed' && r.ruleVerification !== 'verified'
}

function rowRank(r: Requirement): number {
  const f = FULFILMENT_ORDER[r.fulfilment.state] ?? 2
  return r.status === 'withdrawn' ? 10 + f : f
}

/** Group, rank and pair conflicts. Withdrawn requirements sort last in their group. */
export function checklistGroups(requirements: readonly Requirement[]): ChecklistGroup[] {
  const byId = new Map(requirements.map((r) => [r.id, r]))
  const groups = new Map<string, ChecklistRow[]>()
  for (const r of requirements) {
    if (r.standing === 'conflicting') continue
    const conflicts = (r.conflictsWith ?? []).map((id) => byId.get(id)).filter((c): c is Requirement => c !== undefined)
    const cause = r.causeGroup ?? r.cause
    const list = groups.get(cause)
    const row = { requirement: r, conflicts }
    if (list) list.push(row)
    else groups.set(cause, [row])
  }
  const out: ChecklistGroup[] = []
  for (const [cause, rows] of groups) {
    rows.sort((a, b) => rowRank(a.requirement) - rowRank(b.requirement) || a.requirement.title.localeCompare(b.requirement.title))
    out.push({ cause, rows, open: rows.filter((row) => needsAttention(row.requirement)).length })
  }
  out.sort((a, b) => b.open - a.open || b.rows.length - a.rows.length || a.cause.localeCompare(b.cause))
  return out
}

/** The rows a group shows before "and N more". */
export function visibleRows(group: ChecklistGroup, expanded: boolean): { readonly rows: readonly ChecklistRow[]; readonly more: number } {
  if (expanded || group.rows.length <= GRAPH_ANSWER_LIMIT) return { rows: group.rows, more: 0 }
  return { rows: group.rows.slice(0, GRAPH_ANSWER_LIMIT), more: group.rows.length - GRAPH_ANSWER_LIMIT }
}

/** How many requirements still need attention (the rail badge and the Needs chip). */
export function needsCount(requirements: readonly Requirement[]): number {
  return requirements.filter((r) => r.standing !== 'conflicting' && needsAttention(r)).length
}

/** The model's own state for a requirement, in the language on screen (§8's status vocabulary). */
function ownStatusWord(status: string, t: Translate): string | null {
  switch (status) {
    case 'verified':
      return t('checklist.status.verified', 'Verified', { ns: 'editor' })
    case 'overridden':
      return t('checklist.status.overridden', 'Overridden', { ns: 'editor' })
    case 'withdrawn':
      return t('checklist.status.withdrawn', 'Withdrawn', { ns: 'editor' })
    default:
      return null
  }
}

/**
 * The status chip: the model's own state when a person set one, else the
 * rule's standing in its source ("Found by an agent" only with
 * `SHOW_AGENT_FOUND`).
 */
export function statusLabel(r: Requirement, t: Translate = englishOnly): string {
  const own = ownStatusWord(r.status, t)
  if (own) return own
  if (r.ruleVerification === 'verified') return t('checklist.status.verifiedInStudy', 'Verified in its code study', { ns: 'editor' })
  if (r.ruleVerification === 'invalidated') return t('checklist.status.ruledOut', 'Ruled out in its code study', { ns: 'editor' })
  if (r.ruleVerification === 'agent_found' && SHOW_AGENT_FOUND) return t('checklist.status.agentFound', 'Found by an agent', { ns: 'editor' })
  return t('checklist.status.proposed', 'Proposed', { ns: 'editor' })
}

export function fulfilmentLabel(r: Requirement, t: Translate = englishOnly): string {
  if (r.fulfilment.summary) return r.fulfilment.summary
  switch (r.fulfilment.state) {
    case 'met':
      return t('checklist.fulfil.met', 'Met', { ns: 'editor' })
    case 'not_met':
      return t('checklist.fulfil.notMet', 'Not met', { ns: 'editor' })
    case 'open':
      return t('checklist.fulfil.notDrawn', 'Not drawn yet', { ns: 'editor' })
    default:
      return t('checklist.fulfil.manual', 'No model check; a person confirms it', { ns: 'editor' })
  }
}

/** "138" with its unit, "2 ea", "A"; null for a manual rule. */
export function valueLabel(r: Pick<Requirement, 'value' | 'unit' | 'compare'>, t: Translate = englishOnly): string | null {
  if (r.value === null) return null
  // §7: the unit is a symbol and travels as it is.
  const unit = r.unit && r.unit !== '1' ? ` ${r.unit}` : ''
  const prefix =
    r.compare === 'at_least'
      ? t('checklist.value.atLeast', 'at least', { ns: 'editor' }) + ' '
      : r.compare === 'at_most'
        ? t('checklist.value.atMost', 'at most', { ns: 'editor' }) + ' '
        : ''
  return `${prefix}${String(r.value)}${typeof r.value === 'number' ? unit : ''}`
}
