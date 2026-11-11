'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, EyeOff, RotateCcw, TriangleAlert } from 'lucide-react'
import { DIAGRAM_KIND_LABELS, evaluateDiagram, resolveField, type DiagramHints, type ModelState, type ViewElement } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Separator } from '../../ui/separator'
import { Switch } from '../../ui/switch'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import type { SubmitCommand } from '../views-sheets/types'
import { hintsCommand, isPipingDiagram, reorderCommand, siblingsOf, movedCount } from './diagram-commands'
import { PipingDiagramProperties } from './PipingDiagramProperties'
import { useEditorTranslate } from '../i18n/translate'

interface Props {
  readonly model: ModelState
  readonly view: ViewElement
  readonly selectedIds: readonly string[]
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
  /** Select a model element (a warning's equipment). */
  readonly onSelect: (elementId: string) => void
}

/**
 * A live diagram's own properties: what it draws now and its warnings, and
 * the engineer's layout choices (direction, look, detail, what it shows, the
 * order of what a source feeds). Each change is one undoable hint edit; the
 * drawing itself always comes from the model.
 */
export function DiagramProperties({ model, view, selectedIds, canEdit, blockedReason, submit, onSelect }: Props) {
  const [error, setError] = useState<string | null>(null)
  const def = view.props?.diagram
  const evaluation = useMemo(() => evaluateDiagram(model.elements, view), [model.elements, view])
  if (!def || !evaluation) return null
  const hints: DiagramHints = def.hints ?? {}

  const t = useEditorTranslate()
  const isOneLine = def.kind === 'one_line'

  const piping = isPipingDiagram(view)
  if (piping) return <PipingDiagramProperties model={model} view={view} selectedIds={selectedIds} canEdit={canEdit} blockedReason={blockedReason} submit={submit} />
  const disabledReason = canEdit ? null : blockedReason
  const set = (patch: Parameters<typeof hintsCommand>[1], label: string) => {
    const command = hintsCommand(view, patch)
    setError(command ? submit(command, label) : null)
  }
  const selectedId = selectedIds.length === 1 ? (selectedIds[0] ?? null) : null
  const selectedBox = selectedId ? evaluation.boxes.find((b) => b.elementId === selectedId) : undefined
  const siblings = selectedId && selectedBox ? siblingsOf(model, view, selectedId) : null
  const at = siblings && selectedId ? siblings.ids.indexOf(selectedId) : -1
  const pins = movedCount(view)
  const hidden = hints.hidden ?? []
  const reorder = (step: -1 | 1) => {
    if (!selectedId || !selectedBox) return
    const command = reorderCommand(model, view, selectedId, step)

    if (command)
      setError(
        submit(
          command,
          step < 0
            ? t('diagram.moveEarlier', 'move {{name}} earlier on {{view}}', { ns: 'editor', name: selectedBox.name, view: view.name })
            : t('diagram.moveLater', 'move {{name}} later on {{view}}', { ns: 'editor', name: selectedBox.name, view: view.name }),
        ),
      )

  }

  return (

    <section
      className="flex flex-col gap-3"
      aria-label={t('diagram.properties', 'Diagram', { ns: 'editor' })}
      data-testid="diagram-properties"
    >

      <Separator />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{DIAGRAM_KIND_LABELS[def.kind]}</span>
        <p className="text-xs text-muted-foreground" data-testid="diagram-summary">

          {t('diagram.summaryLead', 'Drawn from the model:', { ns: 'editor' })}{' '}
          {evaluation.equipment.length === 0
            ? t('diagram.summaryNothing', 'nothing to draw yet. Place and feed panels from the Electrical tab.', { ns: 'editor' })
            : t('diagram.summaryEquipment', '{{n}} pieces of equipment, redrawn whenever the model changes.', { ns: 'editor', n: evaluation.equipment.length })}{' '}
          {t('diagram.summaryHow', 'Click equipment to select it; drag it to move it on this diagram.', { ns: 'editor' })}

        </p>
      </div>

      {evaluation.warnings.length > 0 && (
        <Alert data-testid="diagram-warnings">
          <TriangleAlert />

          <AlertTitle>
            {evaluation.warnings.length === 1
              ? t('diagram.oneThingToCheck', '1 thing to check', { ns: 'editor' })
              : t('diagram.thingsToCheck', '{{n}} things to check', { ns: 'editor', n: evaluation.warnings.length })}
          </AlertTitle>

          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {evaluation.warnings.map((w) => (
                <li key={`${w.kind}:${w.elementId}`} className="flex items-start justify-between gap-2">
                  <span data-testid="diagram-warning">{w.message}</span>
                  <Button variant="ghost" size="sm" onClick={() => onSelect(w.elementId)}>

                    {t('diagram.select', 'Select', { ns: 'editor' })}
                  </Button>

                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {isOneLine && (
        <Field>

          <FieldLabel>{t('diagram.powerFlows', 'Power flows', { ns: 'editor' })}</FieldLabel>

          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={hints.orientation ?? 'vertical'}

            onValueChange={(v) =>
              v &&
              set(
                { orientation: v === 'horizontal' ? 'horizontal' : undefined },
                v === 'horizontal'
                  ? t('diagram.layLeftToRight', 'lay the diagram out left to right', { ns: 'editor' })
                  : t('diagram.layTopToBottom', 'lay the diagram out top to bottom', { ns: 'editor' }),
              )
            }

            disabled={!canEdit}
            title={disabledReason ?? undefined}
            data-testid="diagram-orientation"
          >

            <ToggleGroupItem value="vertical">{t('diagram.topToBottom', 'Top to bottom', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="horizontal">{t('diagram.leftToRight', 'Left to right', { ns: 'editor' })}</ToggleGroupItem>

          </ToggleGroup>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field>

          <FieldLabel htmlFor="diagram-style">{t('diagram.look', 'Look', { ns: 'editor' })}</FieldLabel>


          <Select
            value={hints.style ?? 'flat'}
            onValueChange={(v) =>
              set(
                { style: v === 'box3d' ? 'box3d' : undefined },
                v === 'box3d'
                  ? t('diagram.drawAs3d', 'draw equipment as 3D boxes', { ns: 'editor' })
                  : t('diagram.drawFlat', 'draw equipment flat', { ns: 'editor' }),
              )
            }
            disabled={!canEdit}
          >

            <SelectTrigger id="diagram-style" size="sm" data-testid="diagram-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>

                <SelectItem value="flat">{t('diagram.styleFlat', 'Flat', { ns: 'editor' })}</SelectItem>
                <SelectItem value="box3d">{t('diagram.styleBox3d', '3D boxes', { ns: 'editor' })}</SelectItem>

              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>

          <FieldLabel htmlFor="diagram-detail">{t('diagram.detail', 'Detail', { ns: 'editor' })}</FieldLabel>


          <Select
            value={hints.detail ?? 'full'}
            onValueChange={(v) =>
              set(
                { detail: v === 'schematic' ? 'schematic' : undefined },
                v === 'schematic'
                  ? t('diagram.showSchematic', 'show the diagram schematic', { ns: 'editor' })
                  : t('diagram.showEveryRating', 'show every rating', { ns: 'editor' }),
              )
            }
            disabled={!canEdit}
          >

            <SelectTrigger id="diagram-detail" size="sm" data-testid="diagram-detail">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>

                <SelectItem value="full">{t('diagram.everyRating', 'Every rating', { ns: 'editor' })}</SelectItem>
                <SelectItem value="schematic">{t('diagram.schematic', 'Schematic', { ns: 'editor' })}</SelectItem>

              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {(
        [

          ...(isOneLine
            ? ([['utility', t('diagram.utilitySource', 'Utility source above each service', { ns: 'editor' }), hints.utility !== false]] as const)
            : []),
          ['showWarnings', t('diagram.warningsOnDrawing', 'Warnings on the drawing', { ns: 'editor' }), hints.showWarnings !== false],
          ...(def.kind !== 'plumbing_riser'
            ? ([['showLoads', t('diagram.equipmentLoads', 'Equipment loads (motors, units)', { ns: 'editor' }), hints.showLoads === true]] as const)
            : []),

        ] as ReadonlyArray<readonly ['utility' | 'showWarnings' | 'showLoads', string, boolean]>
      ).map(([key, label, on]) => (
        <Field key={key} orientation="horizontal">

          <Switch
            id={`diagram-${key}`}
            checked={on}
            disabled={!canEdit}
            onCheckedChange={(next) =>
              set(
                { [key]: key === 'showLoads' ? (next ? true : undefined) : next ? undefined : false },
                next
                  ? t('diagram.showNamed', 'show {{name}}', { ns: 'editor', name: label.toLowerCase() })
                  : t('diagram.hideNamed', 'hide {{name}}', { ns: 'editor', name: label.toLowerCase() }),
              )
            }
            data-testid={`diagram-${key}`}
          />

          <FieldLabel htmlFor={`diagram-${key}`}>{label}</FieldLabel>
        </Field>
      ))}

      {selectedBox && selectedId && (
        <div className="flex flex-col gap-2 rounded-md border p-2" data-testid="diagram-selected">

          <span className="text-xs font-medium">
            {t('diagram.namedOnThisDiagram', '{{name}} on this diagram', { ns: 'editor', name: selectedBox.name })}
          </span>

          <div className="flex flex-wrap gap-2">
            {siblings && siblings.ids.length > 1 && (
              <>
                <Button variant="outline" size="sm" onClick={() => reorder(-1)} disabled={!canEdit || at <= 0}
title={at <= 0 ? t('diagram.alreadyFirst', 'Already first under what feeds it', { ns: 'editor' }) : (disabledReason ?? undefined)} data-testid="diagram-earlier">
                  <ArrowUp data-icon="inline-start" />
                  {t('diagram.earlier', 'Earlier', { ns: 'editor' })}

                </Button>
                <Button variant="outline" size="sm" onClick={() => reorder(1)} disabled={!canEdit || at < 0 || at >= siblings.ids.length - 1}
title={at >= siblings.ids.length - 1 ? t('diagram.alreadyLast', 'Already last under what feeds it', { ns: 'editor' }) : (disabledReason ?? undefined)} data-testid="diagram-later">
                  <ArrowDown data-icon="inline-start" />
                  {t('diagram.later', 'Later', { ns: 'editor' })}

                </Button>
              </>
            )}
            {isOneLine && (
              <Button
                variant="outline"
                size="sm"
                disabled={!canEdit}

                onClick={() =>
                  set(
                    { futureSpaces: { ...(hints.futureSpaces ?? {}), [selectedId]: Math.min(12, (hints.futureSpaces?.[selectedId] ?? 0) + 1) } },
                    t('diagram.addFutureSpaceWhat', 'add a future space under {{name}}', { ns: 'editor', name: selectedBox.name }),
                  )
                }
                data-testid="diagram-future-add"
              >
                {hints.futureSpaces?.[selectedId]
                  ? t('diagram.addFutureSpaceN', 'Add future space ({{n}})', { ns: 'editor', n: hints.futureSpaces[selectedId] })
                  : t('diagram.addFutureSpace', 'Add future space', { ns: 'editor' })}

              </Button>
            )}
            {isOneLine && (hints.futureSpaces?.[selectedId] ?? 0) > 0 && (

              <Button
                variant="ghost"
                size="sm"
                disabled={!canEdit}
                onClick={() =>
                  set(
                    { futureSpaces: { ...(hints.futureSpaces ?? {}), [selectedId]: 0 } },
                    t('diagram.removeFutureSpacesWhat', 'remove future spaces under {{name}}', { ns: 'editor', name: selectedBox.name }),
                  )
                }
              >
                {t('diagram.removeSpaces', 'Remove spaces', { ns: 'editor' })}
              </Button>

            )}

            <Button
              variant="ghost"
              size="sm"
              disabled={!canEdit}
              onClick={() =>
                set(
                  { hidden: [...hidden, selectedId] },
                  t('diagram.leaveOffWhat', 'leave {{name}} off {{view}}', { ns: 'editor', name: selectedBox.name, view: view.name }),
                )
              }
              data-testid="diagram-hide"
            >
              <EyeOff data-icon="inline-start" />
              {t('diagram.leaveOff', 'Leave off this diagram', { ns: 'editor' })}
            </Button>

          </div>
        </div>
      )}

      {hidden.length > 0 && (
        <Field>

          <FieldLabel>{t('diagram.leftOff', 'Left off this diagram', { ns: 'editor' })}</FieldLabel>

          <div className="flex flex-wrap gap-1">
            {hidden.map((id) => (

              <Button
                key={id}
                variant="outline"
                size="sm"
                disabled={!canEdit}
                onClick={() =>
                  set(
                    { hidden: hidden.filter((h) => h !== id) },
                    t('diagram.showAgainWhat', 'show {{name}} on {{view}} again', { ns: 'editor', name: id, view: view.name }),
                  )
                }
              >
                {t('diagram.showAgain', 'Show {{name}} again', { ns: 'editor', name: resolveField(model.elements, id, 'name').text || id })}
              </Button>

            ))}
          </div>
        </Field>
      )}

      <Button variant="outline" size="sm" className="self-start" disabled={!canEdit || pins === 0}
title={pins === 0 ? t('diagram.nothingMoved', 'Nothing has been moved on this diagram', { ns: 'editor' }) : (disabledReason ?? undefined)} onClick={() => set({ pins: undefined, textOffsets: undefined }, t('diagram.resetWhat', 'reset positions on {{view}}', { ns: 'editor', view: view.name }))} data-testid="diagram-reset-pins">
        <RotateCcw data-icon="inline-start" />
        {pins > 0
          ? t('diagram.resetPositionsN', 'Reset positions ({{n}} moved)', { ns: 'editor', n: pins })
          : t('diagram.resetPositions', 'Reset positions', { ns: 'editor' })}

      </Button>
      {error && <FieldDescription className="text-danger-600">{error}</FieldDescription>}
    </section>
  )
}
