'use client'

import { useState } from 'react'
import { Hammer, Undo2 } from 'lucide-react'
import { groupIdOf, isOrganized, organizationOf, phaseCreatedOf, phaseDemolishedOf, type BimElement, type ModelState } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useEditorTranslate } from '../i18n/translate'
import type { SubmitCommand } from '../views-sheets/types'
import { managePath } from './labels'

const NOT_DEMOLISHED = 'none'
const MIXED = 'mixed'

interface Props {
  readonly model: ModelState
  /** What is selected: one element, or a run / branch / system / box selection. */
  readonly ids: readonly string[]
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
}

function common(values: readonly string[]): string {
  const first = values[0]
  return first !== undefined && values.every((v) => v === first) ? first : MIXED
}

/** Group and phases of the selection, with controls to change them. */
export function ElementOrganizationFields({ model, ids, canEdit, blockedReason, submit }: Props) {
  const [error, setError] = useState<string | null>(null)
  const t = useEditorTranslate()
  const org = organizationOf(model)
  const elements = ids.map((id) => model.elements[id]).filter((el): el is BimElement => el !== undefined && isOrganized(el))
  if (elements.length === 0) return null
  const list = elements.map((el) => el.id)
  const one = elements.length === 1
  const count = elements.length
  const group = common(elements.map((el) => groupIdOf(org, el)))
  const created = common(elements.map((el) => phaseCreatedOf(org, el)))
  const demolished = common(elements.map((el) => phaseDemolishedOf(org, el) ?? NOT_DEMOLISHED))
  const anyDemolished = elements.some((el) => phaseDemolishedOf(org, el) !== null)
  const locked = elements.map((el) => org.groupById.get(groupIdOf(org, el))).find((g) => g?.entry.locked)
  const lockedWhat = one
    ? t('org.lockedOne', '"{{name}}" is locked. Unlock it in {{path}} to change it.', { ns: 'editor', name: locked?.entry.name ?? '', path: managePath(t) })
    : t('org.lockedMany', '"{{name}}" is locked. Unlock it in {{path}} to change these {{n}}.', { ns: 'editor', name: locked?.entry.name ?? '', path: managePath(t), n: count })
  const blocked = !canEdit ? blockedReason : locked ? lockedWhat : null
  const activePhase = org.phases.find((p) => p.id === org.activePhaseId)
  const run = (refusal: string | null) => setError(refusal)
  /**
   * The undo label for the selection: one element or many, each said in full.
   * A function rather than a table, so every word is a `t()` call the guard can
   * read (§8: no plural suffix after a count — "3 eleman", never "3 elemanlar").
   */
  const undoMove = (name: string): string =>
    one
      ? t('org.undo.moveOneTo', 'move it to {{name}}', { ns: 'editor', name })
      : t('org.undo.moveManyTo', 'move these {{n}} to {{name}}', { ns: 'editor', name, n: count })
  const undoBuiltIn = (name: string): string =>
    one
      ? t('org.undo.setBuiltInOne', 'set it as built in {{name}}', { ns: 'editor', name })
      : t('org.undo.setBuiltInMany', 'set these {{n}} as built in {{name}}', { ns: 'editor', name, n: count })
  const undoRestore = (): string =>
    one ? t('org.undo.restoreOne', 'restore it', { ns: 'editor' }) : t('org.undo.restoreMany', 'restore these {{n}}', { ns: 'editor', n: count })
  const undoDemolish = (): string =>
    one ? t('org.undo.demolishOne', 'demolish it', { ns: 'editor' }) : t('org.undo.demolishMany', 'demolish these {{n}}', { ns: 'editor', n: count })

  return (
    <FieldSet data-testid="element-organization">
      <FieldLegend variant="label">{t('org.fields.legend', 'Group and phase', { ns: 'editor' })}</FieldLegend>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="el-group">{t('org.fields.group', 'Group', { ns: 'editor' })}</FieldLabel>
          <Select
            value={group}
            disabled={blocked !== null}
            onValueChange={(id) =>
              id !== MIXED &&
              run(
                submit(
                  { type: 'assign_elements_to_group', ids: list, groupId: id },
                  undoMove(org.groupById.get(id)?.entry.name ?? t('org.thatGroup', 'that group', { ns: 'editor' })),
                ),
              )
            }
          >
            <SelectTrigger id="el-group" size="sm" data-testid="element-group">
              <SelectValue placeholder={t('empty.mixedGroups', 'Mixed groups', { ns: 'editor' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {group === MIXED && (
                  <SelectItem value={MIXED} disabled>
                    {t('empty.mixedGroups', 'Mixed groups', { ns: 'editor' })}
                  </SelectItem>
                )}
                {org.groups.map((g) => (
                  <SelectItem key={g.id} value={g.id} disabled={g.entry.locked}>
                    {g.entry.name}
                    {g.entry.locked ? ` ${t('status.locked', '(locked)', { ns: 'editor' })}` : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="el-phase-created">{t('org.fields.builtIn', 'Built in', { ns: 'editor' })}</FieldLabel>
          <Select
            value={created}
            disabled={blocked !== null}
            onValueChange={(id) =>
              id !== MIXED &&
              run(
                submit(
                  { type: 'set_element_phases', ids: list, phaseCreated: id },
                  undoBuiltIn(org.phases.find((p) => p.id === id)?.entry.name ?? t('org.thatPhase', 'that phase', { ns: 'editor' })),
                ),
              )
            }
          >
            <SelectTrigger id="el-phase-created" size="sm" data-testid="element-phase-created">
              <SelectValue placeholder={t('empty.mixedPhases', 'Mixed phases', { ns: 'editor' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {created === MIXED && (
                  <SelectItem value={MIXED} disabled>
                    {t('empty.mixedPhases', 'Mixed phases', { ns: 'editor' })}
                  </SelectItem>
                )}
                {org.phases.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.entry.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="el-phase-demolished">{t('org.fields.demolishedIn', 'Demolished in', { ns: 'editor' })}</FieldLabel>
          <Select
            value={demolished}
            disabled={blocked !== null}
            onValueChange={(id) =>
              id !== MIXED &&
              run(
                submit(
                  { type: 'set_element_phases', ids: list, phaseDemolished: id === NOT_DEMOLISHED ? null : id },
                  id === NOT_DEMOLISHED ? undoRestore() : undoDemolish(),
                ),
              )
            }
          >
            <SelectTrigger id="el-phase-demolished" size="sm" data-testid="element-phase-demolished">
              <SelectValue placeholder={t('empty.mixed', 'Mixed', { ns: 'editor' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {demolished === MIXED && (
                  <SelectItem value={MIXED} disabled>
                    {t('empty.mixed', 'Mixed', { ns: 'editor' })}
                  </SelectItem>
                )}
                <SelectItem value={NOT_DEMOLISHED}>{t('empty.notDemolished', 'Not demolished', { ns: 'editor' })}</SelectItem>
                {org.phases.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.entry.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {anyDemolished ? (
          <Button
            variant="outline"
            size="sm"
            disabled={blocked !== null}
            onClick={() => run(submit({ type: 'undemolish_elements', ids: list }, undoRestore()))}
            data-testid="element-undemolish"
          >
            <Undo2 data-icon="inline-start" />
            {t('empty.notDemolished', 'Not demolished', { ns: 'editor' })}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={blocked !== null}
            onClick={() => run(submit({ type: 'demolish_elements', ids: list }, undoDemolish()))}
            data-testid="element-demolish"
          >
            <Hammer data-icon="inline-start" />
            {t('org.fields.demolishIn', 'Demolish in {{phase}}', { ns: 'editor', phase: activePhase?.entry.name ?? t('org.theActivePhase', 'the active phase', { ns: 'editor' }) })}
          </Button>
        )}
        {(error ?? blocked) && <FieldDescription className={error ? 'text-danger-600' : undefined}>{error ?? blocked}</FieldDescription>}
      </FieldGroup>
    </FieldSet>
  )
}
