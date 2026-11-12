import { commandSchema, type Command, type ModelState, type ScheduleDefinitionV2 } from '@permitzip/bim-kernel'
import { ScheduleDefinitionError, openSchedule, type RowSet, type ScheduleSession } from '@permitzip/bim-kernel/schedules'
import { viewScheduleDefinition } from '../../contracts/bim/schedules/view-definition'
import type { CellCommandPlanner, CellEditBatch, CellRef, CellRefusal, TypeScopeImpact } from '@permitzip/bim-sync'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * Turns schedule grid edits into model commands for `SyncScheduleConnection`.
 * Each cell goes through the kernel's own `session.planEdit` (the field's
 * writer), run on this browser's copy of the model with the same definition
 * the model server evaluates, so a row key here is the row key on the wire.
 * Everything a batch produces is sent as one command, so it saves and undoes
 * as one step.
 */

/**
 * The two refusals the grid says in the editor's own words, rather than the
 * kernel's English: a batch this kernel cannot save as one step, and a served
 * item that is changed where it lives.
 */
export function severalCommandsNotYet(t: Translate = englishOnly): string {
  return t('schedule.planner.severalCommands', "Changes to several items at once can't be saved as one step yet. Change one cell at a time for now.", { ns: 'editor' })
}

export function childRowsNotEditable(t: Translate = englishOnly): string {
  return t('schedule.planner.childRows', 'Served items are changed on their own rows. Open their schedule or select them in the model.', { ns: 'editor' })
}

export { viewScheduleDefinition }

/** Many set_parameters on the same element and scope merge into one; anything else needs a batch. */
function mergeParameterWrites(commands: readonly Command[]): Command[] {
  const out: Command[] = []
  for (const c of commands) {
    const last = out.find((o) => o.type === 'set_parameters' && c.type === 'set_parameters' && o.id === c.id && o.scope === c.scope)
    if (last && last.type === 'set_parameters' && c.type === 'set_parameters') {
      out[out.indexOf(last)] = { ...last, values: { ...last.values, ...c.values } }
    } else out.push(c)
  }
  return out
}

/**
 * One command for the whole batch: itself when there is one, otherwise the
 * kernel's model-edit batch when this kernel has one. Null with no batch.
 */
export function combineCommands(commands: readonly Command[], label: string): Command | null {
  const merged = mergeParameterWrites(commands)
  if (merged.length === 1) return merged[0] ?? null
  const batch = commandSchema.safeParse({ type: 'batch_edits', label, commands: merged })
  return batch.success ? batch.data : null
}

function typeLabels(model: Pick<ModelState, 'elements'>, elementIds: readonly string[]): string {
  const names = new Set<string>()
  for (const id of elementIds) {
    const el = model.elements[id]
    if (el?.kind !== 'part') continue
    const type = model.elements[el.typeId]
    names.add(type?.kind === 'part_type' ? type.definition.typeName || type.definition.familyName : el.typeId)
  }
  return [...names].join(', ')
}

function refusal(cell: CellRef, reason: string): CellRefusal {
  return { rowKey: cell.rowKey, columnId: cell.columnId, ...(cell.parent ? { parent: cell.parent } : {}), reason }
}

export interface KernelPlannerOptions {
  /** The model as this person sees it now (their unsaved edits included). */
  readonly model: () => ModelState | null
  /** The language the grid refuses in. */
  readonly t?: Translate
}

export class KernelCellPlanner implements CellCommandPlanner {
  private cache: { model: ModelState; viewId: string; definition: ScheduleDefinitionV2; session: ScheduleSession } | null = null

  constructor(private readonly options: KernelPlannerOptions) {}

  /** One engine session per model revision and view: preview and save share it. */
  private session(rows: RowSet): ScheduleSession | string {
    const t = this.options.t ?? englishOnly
    const model = this.options.model()
    if (!model) return t('schedule.planner.modelNotLoaded', "The model hasn't loaded yet. Try again in a moment.", { ns: 'editor' })
    const definition = viewScheduleDefinition(model, rows.viewId)
    if (!definition) return t('schedule.planner.gone', 'This schedule is no longer in the model.', { ns: 'editor' })
    const hit = this.cache
    if (hit && hit.model === model && hit.viewId === rows.viewId && hit.definition === definition) return hit.session
    try {
      const session = openSchedule(model, definition, { viewId: rows.viewId, revision: rows.revision })
      this.cache = { model, viewId: rows.viewId, definition, session }
      return session
    } catch (err) {
      if (err instanceof ScheduleDefinitionError) return err.problems.map((p) => p.message).join(' ')
      console.error('[KernelCellPlanner] opening the schedule for an edit failed', { viewId: rows.viewId, err })
      return t('schedule.planner.unreadable', "This schedule couldn't be read for editing. Reload the page and try again.", { ns: 'editor' })
    }
  }

  plan(rows: RowSet, batch: CellEditBatch): { readonly command: Command | null; readonly typeScope: readonly TypeScopeImpact[]; readonly refusals: readonly CellRefusal[] } {
    const session = this.session(rows)
    if (typeof session === 'string') return { command: null, typeScope: [], refusals: batch.edits.map((e) => refusal(e, session)) }
    const model = this.options.model()
    const commands: Command[] = []
    const refusals: CellRefusal[] = []
    const typeScope: TypeScopeImpact[] = []
    for (const edit of batch.edits) {
      if (edit.parent) {
        refusals.push(refusal(edit, childRowsNotEditable(this.options.t ?? englishOnly)))
        continue
      }
      const plan = session.planEdit({ rowKey: edit.rowKey, columnId: edit.columnId, value: edit.value })
      if (!plan.ok) {
        refusals.push(refusal(edit, plan.reason))
        continue
      }
      commands.push(...plan.commands)
      if (plan.scope === 'type' && plan.confirm && model) {
        const heading = rows.columns.find((c) => c.id === edit.columnId)?.heading ?? edit.columnId
        typeScope.push({ typeLabel: typeLabels(model, plan.affectedElementIds), instanceCount: plan.affectedElementIds.length, columnHeading: heading })
      }
    }
    if (commands.length === 0) return { command: null, typeScope, refusals }
    const t = this.options.t ?? englishOnly
    const label =
      batch.edits.length === 1
        ? t('schedule.planner.cellEdit', 'Schedule cell edit', { ns: 'editor' })
        : t('schedule.planner.batchEdit', 'Schedule edit ({{count}} cells)', { ns: 'editor', count: batch.edits.length })
    const command = combineCommands(commands, label)
    if (!command) return { command: null, typeScope, refusals: [...refusals, ...batch.edits.filter((e) => !refusals.some((r) => r.rowKey === e.rowKey && r.columnId === e.columnId)).map((e) => refusal(e, severalCommandsNotYet(t)))] }
    return { command, typeScope, refusals }
  }

  explain(rows: RowSet, cell: CellRef): string | null {
    if (cell.parent) return null
    const session = this.session(rows)
    return typeof session === 'string' ? null : session.explain(cell.rowKey, cell.columnId)
  }
}
