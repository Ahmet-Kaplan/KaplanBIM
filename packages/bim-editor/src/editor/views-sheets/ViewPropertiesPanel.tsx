'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight, Scan, Undo2 } from 'lucide-react'
import {
  DEFAULT_CUT_HEIGHT_MM,
  STANDARD_SCALES,
  builtinCategoryRegistry,
  firstPartyServiceRegistry,
  isViewCategory,
  VISUAL_STYLES,
  VIEW_PROJECTIONS,
  type Command,
  type CutPattern,
  type DetailLevel,
  type Rect,
  type ViewCategory,
  type ViewElement,
  type ViewPropsPatch,
  DRAFTING_CATEGORIES,
  type DraftingCategory,
  type VisualStyle,
  referenceSurfaceOf,
  withReferenceDisplay,
  type LinkedModelDiscipline,
  disciplineLabel,
  listDisciplines,
} from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Separator } from '../../ui/separator'
import { Spinner } from '../../ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { viewTypeLabel, type SubmitCommand } from './types'
import type { BackgroundNote, BackgroundState } from './view-backgrounds'
import { Crop3dFields, type Crop3dControls } from './Crop3dFields'
import { CircuitGraphicsFields } from './CircuitGraphicsFields'
import { LinkedModelDisplayFields } from '../linked-display/LinkedModelDisplayControls'
import { makeLinkedDisplay } from '../linked-display/use-linked-display'

import { CategoryGraphicsTable } from '../graphics/CategoryGraphicsTable'
import { useEditorTranslate, type Translate } from '../i18n/translate'
import { viewCategoryWord } from './category-labels'


const FT = 304.8

/** Category labels come from the category registry (one vocabulary with Visibility/Graphics and the agent). */
/**
 * A category's name at each place this panel draws it. The kernel's labels are English
 * data (Stage 5 owns the domain map); `viewCategoryWord` asks for the noun here so a
 * Turkish frame around it is not half English.
 */
const categoryWord = (category: ViewCategory, t: Translate): string => viewCategoryWord(category, t)

/**
 * Disciplines a view can be drawn for, from the registry (the model's add-ons and firm rows included); documentation and general draw nothing of their own.
 * A discipline the view already carries that this registry doesn't know (an add-on turned off since) stays listed, in its own words, so the field never reads blank.
 */

function viewDisciplineChoices(t: Translate, current?: string | null): ReadonlyArray<{ readonly value: string; readonly label: string }> {
  const rows = [
    { value: 'all', label: t('view.disciplineAllInk', 'All in ink', { ns: 'editor' }) },
    ...listDisciplines()
      .filter((d) => d.id !== 'documentation' && d.id !== 'general')
      .map((d) => ({ value: d.id, label: d.parent ? `${disciplineLabel(d.parent)} › ${d.label}` : d.label })),
  ]
  // A discipline this registry no longer knows stays listed, in its own words, so the field never reads blank.
  return current && !rows.some((r) => r.value === current)
    ? [...rows, { value: current, label: t('view.disciplineUnknown', '{{name}} (not in this model’s add-ons)', { ns: 'editor', name: disciplineLabel(current) }) }]
    : rows
}


const DETAIL_LEVELS: readonly DetailLevel[] = ['coarse', 'medium', 'fine']


function visualStyleLabel(style: VisualStyle, t: Translate): { label: string; hint: string } {
  switch (style) {
    case 'wireframe':
      return {
        label: t('view.style.wireframe', 'Wireframe', { ns: 'editor' }),
        hint: t('view.style.wireframeHint', 'Every edge, nothing hides anything.', { ns: 'editor' }),
      }
    case 'hidden_line':
      return {
        label: t('view.style.hiddenLine', 'Hidden line', { ns: 'editor' }),
        hint: t('view.style.hiddenLineHint', 'Edges behind nearer elements are hidden.', { ns: 'editor' }),
      }
    case 'shaded':
      return {
        label: t('view.style.shaded', 'Shaded', { ns: 'editor' }),
        hint: t('view.style.shadedHint', 'Surfaces filled grey, no edges.', { ns: 'editor' }),
      }
    case 'shaded_edges':
      return {
        label: t('view.style.shadedEdges', 'Shaded with edges', { ns: 'editor' }),
        hint: t('view.style.shadedEdgesHint', 'Surfaces filled grey with their edges.', { ns: 'editor' }),
      }
  }
}

/**
 * "Detail level" — §9/Ç6: the *view's* detail level is **detay seviyesi**, never
 * `kat` (that is a storey, §2.3) and never `seviye` alone (the glossary keeps the
 * whole term). The three values under it (coarse/medium/fine) are separate words.
 */
export function detailLevelLabel(t: Translate): string {
  return t('view.detailLevel', 'Detail level', { ns: 'editor' })
}

function detailHint(level: DetailLevel, t: Translate): string {
  switch (level) {
    case 'coarse':
      return t('view.detail.coarseHint', 'Duct and pipe as single lines; fittings as their centrelines.', { ns: 'editor' })
    case 'medium':
      return t('view.detail.mediumHint', 'Duct double-line with fitting outlines.', { ns: 'editor' })
    case 'fine':
      return t('view.detail.fineHint', 'Adds turning vanes and fitting joints.', { ns: 'editor' })
  }
}

function cutPatternLabel(pattern: CutPattern, t: Translate): string {
  switch (pattern) {
    case 'cross':
      return t('view.cutPattern.cross', 'Cross', { ns: 'editor' })
    case 'solid':
      return t('view.cutPattern.solid', 'Solid', { ns: 'editor' })
    case 'hatch':
      return t('view.cutPattern.hatch', 'Hatch', { ns: 'editor' })
  }
}


/** View categories with bodies (their hidden edges can draw dashed): the registry's view categories less annotation and room labels. */
const NO_HIDDEN_EDGES: ReadonlySet<ViewCategory> = new Set<ViewCategory>(['tags', 'dimensions', 'rooms', 'grids', 'doors_windows'])
const DASH_CATEGORIES: readonly ViewCategory[] = builtinCategoryRegistry()
  .list()
  .flatMap((c) => (isViewCategory(c.id) && !NO_HIDDEN_EDGES.has(c.id) ? [c.id] : []))

/** Size below which linked objects can be left out of drawings, inches across in plan. */
const SMALL_OBJECT_CHOICES_IN = [0, 3, 6, 12, 18] as const

export type ViewDisplay = 'model' | 'drawing'

interface Props {
  readonly view: ViewElement
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
  readonly references: ReadonlyArray<{ readonly id: string; readonly label: string; readonly discipline?: LinkedModelDiscipline }>
  readonly display: ViewDisplay
  readonly onDisplay: (display: ViewDisplay) => void
  readonly onRename: () => void
  /** The linked models cut for this view's drawing, when it has been drawn. */
  readonly background?: BackgroundState
  /** The model level this view stands on, where a linked level choice is kept; null when its level is only a name. */
  readonly hostLevelId?: string | null
  /** The level's name, also for a view that stored its level's id; absent: the view's level as stored. */
  readonly levelName?: string | null
  /** The view's Phase and Phase filter (organization/ViewPhaseFields). */
  readonly phaseFields?: ReactNode
  /** 3D views: their 3D crop box and camera. */
  readonly crop3d?: Crop3dControls
  /** Form schedules (panel, feeder…): their panel, code rules and template (electrical/schedules/ScheduleProperties). */
  readonly schedule?: ReactNode
  /** Live diagrams: their own properties (diagrams/DiagramProperties). */
  readonly diagram?: ReactNode
}

/** The open view's own properties. Each change saves on its own and can be undone. */

/** The kinds of drafting a view can hide, in the language on screen (§2.4). */
function draftingLabel(category: DraftingCategory, t: Translate): string {
  switch (category) {
    case 'detail_lines':
      return t('view.drafting.detailLines', 'Detail lines', { ns: 'editor' })
    case 'hatching':
      return t('view.drafting.hatching', 'Hatching and fills', { ns: 'editor' })
    case 'masking':
      return t('view.drafting.masking', 'Masking regions', { ns: 'editor' })
    case 'components':
      return t('view.drafting.components', 'Detail components', { ns: 'editor' })
    case 'insulation':
      return t('view.drafting.insulation', 'Insulation', { ns: 'editor' })
    case 'text':
      return t('view.drafting.text', 'Text and notes', { ns: 'editor' })
    case 'dimensions':
      return t('view.drafting.dimensions', 'Dimensions', { ns: 'editor' })
    case 'tags':
      return t('view.drafting.tags', 'Tags', { ns: 'editor' })
    case 'clouds':
      return t('view.drafting.clouds', 'Revision clouds', { ns: 'editor' })
  }
}


/** The on/off settings that tick at once: they show the new value before the view redraws. */
export type QuickProps = Partial<Pick<ViewPropsPatch, 'hiddenCategories' | 'hiddenDraftingCategories' | 'showHiddenLines' | 'hiddenLineCategories' | 'linkedHiddenLines' | 'cropView' | 'showCropBox' | 'annotationCrop'>>
type QuickKey = keyof QuickProps
type QuickSet = (patch: QuickProps, send: () => string | null) => void

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && [...a].map(String).sort().join('\u0000') === [...b].map(String).sort().join('\u0000')
  return (a ?? null) === (b ?? null)
}

/**
 * A checkbox ticks the moment it is clicked; the edit is sent on the next
 * task, after the tick has painted (a tick used to wait for the kernel's
 * prediction and the whole drawing's redraw, Electrical Demo 2 4:58). The
 * shown value is the view's own as soon as the view has caught up; a refusal
 * puts the box back and says why.
 */
export function useQuickViewProps(view: ViewElement, onRefused: (message: string) => void): { readonly view: ViewElement; readonly updating: boolean; readonly setQuick: QuickSet } {
  const [pending, setPending] = useState<QuickProps>({})
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const live = timers.current
    return () => {
      for (const t of live) clearTimeout(t)
    }
  }, [])
  // Drop a pending value once the view shows it (or another edit replaced it).
  useEffect(() => {
    setPending((prev) => {
      const keys = Object.keys(prev) as QuickKey[]
      const left = keys.filter((k) => !sameValue(view.props?.[k], prev[k]))
      if (left.length === keys.length) return prev
      const next: QuickProps = {}
      for (const k of left) Object.assign(next, { [k]: prev[k] })
      return next
    })
  }, [view])
  const setQuick = useCallback<QuickSet>(
    (patch, send) => {
      setPending((prev) => ({ ...prev, ...patch }))
      const timer = setTimeout(() => {
        timers.current.delete(timer)
        const refusal = send()
        if (!refusal) return
        setPending((prev) => {
          const next: QuickProps = { ...prev }
          for (const k of Object.keys(patch) as QuickKey[]) delete next[k]
          return next
        })
        onRefused(refusal)
      }, 0)
      timers.current.add(timer)
    },
    [onRefused],
  )
  const shown = useMemo<ViewElement>(() => (Object.keys(pending).length === 0 ? view : { ...view, props: { ...(view.props ?? {}), ...pending } }), [view, pending])
  return { view: shown, updating: Object.keys(pending).length > 0, setQuick }
}


export function ViewPropertiesPanel({ view: saved, canEdit, blockedReason, submit, references, display, onDisplay, onRename, background, hostLevelId = null, levelName = null, phaseFields, crop3d, schedule, diagram }: Props) {
  const t = useEditorTranslate()
  const [error, setError] = useState<string | null>(null)

  const quick = useQuickViewProps(saved, setError)
  const view = quick.view
  const props = view.props ?? {}
  const send = (patch: ViewPropsPatch, label: string): string | null => submit({ type: 'set_view_properties', viewId: view.id, props: patch }, label)
  const set = (patch: ViewPropsPatch, label: string) => setError(send(patch, label))

  const disciplineChoices = useMemo(() => viewDisciplineChoices(t, props.discipline), [t, props.discipline])

  const setQuick = (patch: QuickProps, label: string) => {
    setError(null)
    quick.setQuick(patch, () => send(patch, label))
  }
  const setCrop = (change: Omit<Extract<Command, { type: 'set_view_crop' }>, 'type' | 'viewId'>, label: string) => {
    setError(submit({ type: 'set_view_crop', viewId: view.id, ...change }, label))
  }
  const setQuickCrop = (patch: QuickProps, change: Omit<Extract<Command, { type: 'set_view_crop' }>, 'type' | 'viewId'>, label: string) => {
    setError(null)
    quick.setQuick(patch, () => submit({ type: 'set_view_crop', viewId: view.id, ...change }, label))
  }
  /** The linked-model simplification before the last change here, for Undo when it left nothing. */
  const [simplifyBefore, setSimplifyBefore] = useState<{ readonly linkedMinObjectMm: number } | null>(null)
  const hiddenDrafting = new Set<DraftingCategory>(props.hiddenDraftingCategories ?? [])
  const isPlan = view.viewType === 'floor_plan' || view.viewType === 'ceiling_plan'
  const disabledHint = canEdit ? undefined : blockedReason

  return (
    <div className="flex flex-col gap-3" data-testid="view-properties">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{viewTypeLabel(view.viewType, t)}</span>
          <span className="truncate text-sm font-medium">{view.name}</span>

          {props.level && view.viewType !== 'detail' && (
            <span className="text-xs text-muted-foreground" data-testid="view-properties-level">
              {t('view.levelNamed', 'Level {{name}}', { ns: 'editor', name: levelName ?? props.level })}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onRename} disabled={!canEdit}>
          {t('view.rename', 'Rename', { ns: 'editor' })}
        </Button>

      </div>
      {quick.updating && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="view-updating">

          <Spinner className="size-3" />
          {t('view.updating', 'Updating the view…', { ns: 'editor' })}

        </p>
      )}

      {schedule}
      {diagram}

      {view.viewType === 'section' && (
        <p className="text-xs text-muted-foreground">
          {t(
            'view.sectionOpens',
            'A section opens as its drawing: the cut at the line, what is beyond it, and its levels. Show the live model to edit in it.',
            { ns: 'editor' },
          )}
        </p>
      )}

      {view.viewType !== 'detail' && (
        <Field>

          <FieldLabel>{t('view.show', 'Show', { ns: 'editor' })}</FieldLabel>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={display}
            onValueChange={(v) => (v === 'model' || v === 'drawing') && onDisplay(v)}
            aria-label={t('view.showAria', 'Show the live model or the printed drawing', { ns: 'editor' })}
            data-testid="view-display"
          >
            <ToggleGroupItem value="model">
              {view.viewType === 'schedule' ? t('view.spreadsheet', 'Spreadsheet', { ns: 'editor' }) : t('view.liveModel', 'Live model', { ns: 'editor' })}
            </ToggleGroupItem>
            <ToggleGroupItem value="drawing">{t('view.printedDrawing', 'Printed drawing', { ns: 'editor' })}</ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription className="text-xs">
            {t('view.shownForYou', 'This view opens this way for you next time, on any computer.', { ns: 'editor' })}
          </FieldDescription>

        </Field>
      )}

      {/* A schedule is a table: it has no scale, crop, discipline, linked models or lines to set. */}
      {view.viewType === 'schedule' ? (
        error && (
          <p className="text-xs text-danger-600" role="alert">
            {error}
          </p>
        )
      ) : (
      <>
      {phaseFields && view.viewType !== 'detail' && (
        <>
          <Separator />
          {phaseFields}
        </>
      )}
      <Separator />
      <FieldGroup className="gap-3">

        {props.diagram && (
          <p className="text-xs text-muted-foreground">
            {t('view.diagramNoScale', 'Scale: none. A live diagram prints at its own size on any sheet, like a schedule.', { ns: 'editor' })}
          </p>
        )}

        {view.viewType !== 'three_d' && !props.diagram && (
          <Field>

            <FieldLabel htmlFor="vp-view-scale">{t('view.scale', 'Scale', { ns: 'editor' })}</FieldLabel>
            <Select
              value={String(props.scale ?? 48)}
              onValueChange={(v) => set({ scale: Number(v) }, t('view.changeScale', 'change the scale', { ns: 'editor' }))}
              disabled={!canEdit}
            >

              <SelectTrigger id="vp-view-scale" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STANDARD_SCALES.map((s) => (
                    <SelectItem key={s.scale} value={String(s.scale)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <FieldDescription>{disabledHint ?? t('view.scaleUsedOnSheet', 'Used when this view is placed on a sheet.', { ns: 'editor' })}</FieldDescription>

          </Field>
        )}

        {view.viewType === 'three_d' && (
          <Field>

            <FieldLabel>{t('view.projection', 'Projection', { ns: 'editor' })}</FieldLabel>

            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={props.projection ?? 'perspective'}
              disabled={!canEdit}

              aria-label={t('view.projection', 'Projection', { ns: 'editor' })}
              data-testid="view-projection"

              onValueChange={(v) => {
                const picked = VIEW_PROJECTIONS.find((p) => p === v)

                if (picked)
                  set(
                    { projection: picked },
                    picked === 'orthographic' ? t('view.toOrthographic', 'switch to orthographic', { ns: 'editor' }) : t('view.toPerspective', 'switch to perspective', { ns: 'editor' }),
                  )

              }}
            >

              <ToggleGroupItem value="perspective">{t('view.perspective', 'Perspective', { ns: 'editor' })}</ToggleGroupItem>
              <ToggleGroupItem value="orthographic">{t('view.orthographic', 'Orthographic', { ns: 'editor' })}</ToggleGroupItem>

            </ToggleGroup>
            <FieldDescription className="text-xs">
              {disabledHint ??

                ((props.projection ?? 'perspective') === 'orthographic'
                  ? t(
                      'view.orthographicHint',
                      'Parallel lines stay parallel: cube faces give true elevations and corners true isometrics. Prints the same way.',
                      { ns: 'editor' },
                    )
                  : t(
                      'view.perspectiveHint',
                      'Farther things look smaller, like a photo. On a sheet a 3D view still prints orthographic (isometric).',
                      { ns: 'editor' },
                    ))}

            </FieldDescription>
          </Field>
        )}

        {isPlan && <HeightRangeFields view={view} canEdit={canEdit} set={set} />}

        {view.viewType === 'section' && props.section && (
          <>
            <NumberField
              key={`vp-depth:${props.section.depthMm}`}
              id="vp-depth"

              label={t('view.farClip', 'Far clip depth (ft)', { ns: 'editor' })}
              value={props.section.depthMm / FT}
              disabled={!canEdit}
              description={t('view.farClipHint', 'How far past the cut line the section sees. Drag the depth grip on the plan, too.', { ns: 'editor' })}
              onCommit={(ft) => setCrop({ farClipMm: Math.max(1, ft) * FT }, t('view.changeFarClip', 'change how far the section sees', { ns: 'editor' }))}

            />
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!canEdit}

                    onClick={() =>
                      props.section && set({ section: { ...props.section, direction: props.section.direction === 1 ? -1 : 1 } }, t('view.flipSection', 'flip the section', { ns: 'editor' }))
                    }
                  >
                    <ArrowLeftRight data-icon="inline-start" />
                    {t('view.lookOtherWay', 'Look the other way', { ns: 'editor' })}

                  </Button>
                </span>
              </TooltipTrigger>

              <TooltipContent>{disabledHint ?? t('view.flipSectionHint', 'Flip which side of the cut line the section shows', { ns: 'editor' })}</TooltipContent>

            </Tooltip>
          </>
        )}

        {view.viewType !== 'three_d' && (
          <FieldSet>

            <FieldLegend variant="label">{t('view.draftingShown', 'Drafting shown', { ns: 'editor' })}</FieldLegend>

            <FieldGroup className="gap-1.5">
              {DRAFTING_CATEGORIES.map((c) => (
                <Field key={c} orientation="horizontal">
                  <Checkbox
                    id={`vp-draft-${c}`}
                    checked={!hiddenDrafting.has(c)}
                    disabled={!canEdit}
                    data-testid={`vp-draft-${c}`}
                    onCheckedChange={(v) => {
                      const next = new Set(hiddenDrafting)
                      if (v === true) next.delete(c)
                      else next.add(c)

                      setQuick(
                        { hiddenDraftingCategories: [...next] },
                        v === true
                          ? t('view.showCategory', 'show {{name}}', { ns: 'editor', name: draftingLabel(c, t).toLowerCase() })
                          : t('view.hideCategory', 'hide {{name}}', { ns: 'editor', name: draftingLabel(c, t).toLowerCase() }),
                      )

                    }}
                  />
                  <FieldLabel htmlFor={`vp-draft-${c}`} className="font-normal">

                    {draftingLabel(c, t)}

                  </FieldLabel>
                </Field>
              ))}
            </FieldGroup>

            <FieldDescription>
              {t('view.draftingHiddenStays', 'Hidden drafting stays in the view; it just doesn’t show or print here.', { ns: 'editor' })}
            </FieldDescription>

          </FieldSet>
        )}

        {view.viewType !== 'detail' && (
          <>
            <Field>

              <FieldLabel htmlFor="vp-disc">{t('view.discipline', 'Discipline', { ns: 'editor' })}</FieldLabel>

              <Select value={props.discipline ?? 'all'} onValueChange={(v) => {
                  const picked = disciplineChoices.find((d) => d.value === v)

                  if (picked)
                    set({ discipline: picked.value === 'all' ? null : picked.value }, t('view.changeDiscipline', 'change the discipline', { ns: 'editor' }))

                }} disabled={!canEdit}>
                <SelectTrigger id="vp-disc" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {disciplineChoices.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <FieldDescription>
                {props.discipline
                  ? t('view.disciplineOthersHalftone', 'Other disciplines print in halftone; plans leave out their runs.', { ns: 'editor' })
                  : t('view.disciplineAllInkWhy', 'Every discipline prints in ink.', { ns: 'editor' })}
              </FieldDescription>

            </Field>
            {isPlan && <CircuitGraphicsFields view={view} canEdit={canEdit} disabledHint={disabledHint} set={set} />}
            <LinesFields view={view} canEdit={canEdit} set={set} setQuick={setQuick}>
              {references.length > 0 && (
                <FieldSet data-testid="view-linked-models">

                  <FieldLegend variant="label">{t('panel.linkedModels', 'Linked models', { ns: 'editor' })}</FieldLegend>

                  <BackgroundStatus
                    background={background}
                    choice={{ canEdit, blockedReason, hostLevelId, submit }}
                    onUndo={
                      simplifyBefore && (props.linkedMinObjectMm ?? 0) !== simplifyBefore.linkedMinObjectMm
                        ? () => {

                            set(
                              { linkedMinObjectMm: simplifyBefore.linkedMinObjectMm },
                              simplifyBefore.linkedMinObjectMm === 0
                                ? t('view.drawEveryLinkedObject', 'draw every linked object', { ns: 'editor' })
                                : t('view.leaveOutLinkedUnder', 'leave out linked objects under {{inches}}″', {
                                    ns: 'editor',
                                    inches: Math.round(simplifyBefore.linkedMinObjectMm / 25.4),
                                  }),
                            )

                            setSimplifyBefore(null)
                          }
                        : null
                    }
                  />
                  {view.viewType !== 'three_d' && <LinkedSimplifyFields view={view} canEdit={canEdit} set={set} setQuick={setQuick} onChangeSmall={(previousMm) => setSimplifyBefore({ linkedMinObjectMm: previousMm })} />}
                  <LinkedModelDisplayFields
                    display={makeLinkedDisplay({

                      targetLabel: view.props?.workingFor
                        ? t('view.your3dView', 'your 3D view', { ns: 'editor' })
                        : t('view.thisView', 'this view', { ns: 'editor' }),

                      surface: referenceSurfaceOf(view),
                      stored: (id) => props.references?.[id],
                      discipline: (id) => references.find((r) => r.id === id)?.discipline ?? 'architecture',
                      save: (id, next, label) => set({ references: withReferenceDisplay(props.references, id, next) }, label),
                    })}
                    references={references}
                    canEdit={canEdit}
                    disabledHint={disabledHint ?? null}
                  />
                </FieldSet>
              )}
            </LinesFields>

            <CategoryGraphicsTable
              view={view}
              services={firstPartyServiceRegistry().rows}
              canEdit={canEdit}
              {...(disabledHint ? { disabledHint } : {})}
              onPatch={(patch, label) => {
                // Show/hide of a view category ticks at once, like every other checkbox here.
                if (patch.hiddenCategories && Object.keys(patch).length === 1) {
                  setQuick({ hiddenCategories: patch.hiddenCategories }, label)
                  return null
                }
                return send(patch, label)
              }}
            />
          </>
        )}
      </FieldGroup>
      <Separator />
      {view.viewType === 'three_d' && crop3d ? <Crop3dFields controls={crop3d} canEdit={canEdit} disabledHint={disabledHint} /> : <CropFields view={view} canEdit={canEdit} disabledHint={disabledHint} onCrop={setCrop} onQuickCrop={setQuickCrop} />}
      {error && (
        <p className="text-xs text-danger-600" role="alert">
          {error}
        </p>
      )}
      </>
      )}
    </div>
  )
}

interface LinkedLevelChoiceContext {
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly hostLevelId: string | null
  readonly submit: SubmitCommand
}

type ChoiceNote = BackgroundNote & { readonly levelChoice: NonNullable<BackgroundNote['levelChoice']> }

/** At most this many storeys as buttons; a linked model rarely has more near one level. */
const MAX_LEVEL_BUTTONS = 8

/**
 * "Which level of the architect's model is ROOF?": one button per linked
 * level, nearest first. The choice is kept on our level for that linked model,
 * so every plan of the level draws it; undo takes it back.
 */

function LinkedLevelChoice({ note, ctx }: { note: ChoiceNote; ctx: LinkedLevelChoiceContext }) {
  const t = useEditorTranslate()
  const [error, setError] = useState<string | null>(null)
  const why = !ctx.canEdit
    ? ctx.blockedReason
    : ctx.hostLevelId === null
      ? t(
          'view.levelNotOursYet',
          '{{name}} isn’t one of this model’s levels yet, so the choice has nowhere to be kept. Add it as a level first (Model › Add level), at its height.',
          { ns: 'editor', name: note.levelChoice.level },
        )
      : null

  const options = note.levelChoice.options.slice(0, MAX_LEVEL_BUTTONS)
  return (

    <div
      className="flex flex-col gap-1"
      data-testid="linked-level-choice"
      role="group"
      aria-label={t('view.whichLevelIs', 'Which level of {{model}} is {{level}}', { ns: 'editor', model: note.label, level: note.levelChoice.level })}
    >

      <FieldDescription className="text-xs text-warning-700">
        {note.label}: {note.reason}
      </FieldDescription>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {options.map((o) => (
            <Button
              key={o}
              size="sm"
              variant="outline"
              disabled={why !== null}

              title={why ?? t('view.drawLinkedOn', 'Draw {{model}}’s {{other}} on {{level}}', { ns: 'editor', model: note.label, other: o, level: note.levelChoice.level })}

              onClick={() => {
                if (ctx.hostLevelId === null) return

                setError(
                  ctx.submit(
                    { type: 'set_level_linked_storey', levelId: ctx.hostLevelId, linkId: note.levelChoice.linkId, storeyName: o },
                    t('view.levelDrawsLinked', '{{level}} draws {{model}}’s {{other}}', { ns: 'editor', level: note.levelChoice.level, model: note.label, other: o }),
                  ),
                )

              }}
            >
              {o}
            </Button>
          ))}
        </div>
      )}
      {why !== null && <FieldDescription className="text-xs">{why}</FieldDescription>}
      {error && (
        <p className="text-xs text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** What the linked models drew in this view's printed drawing, or why one drew nothing. */

function BackgroundStatus({ background, onUndo, choice }: { background: BackgroundState | undefined; onUndo: (() => void) | null; choice: LinkedLevelChoiceContext }) {
  const t = useEditorTranslate()
  if (!background) return null

  if (background.state === 'loading') {

    return (
      <FieldDescription className="text-xs" data-testid="view-background-status">
        {t('view.cuttingLinked', 'Cutting the linked models for this view…', { ns: 'editor' })}
      </FieldDescription>
    )

  }
  if (background.state === 'updating') {
    return (
      <FieldDescription className="flex items-center gap-1.5 text-xs" data-testid="view-background-status" data-state="updating">

        <Spinner className="size-3" />
        {t('view.redrawingLinked', 'Redrawing the linked models with the new settings. The old drawing stays until it’s ready.', { ns: 'editor' })}

      </FieldDescription>
    )
  }
  if (background.state === 'ready' && background.leftNothing) {
    return (
      <Alert data-testid="view-background-left-nothing">

        <AlertTitle>{t('view.linkedLeftNothingTitle', 'Nothing of the linked models is left in this view', { ns: 'editor' })}</AlertTitle>
        <AlertDescription>
          <p>{t('view.linkedLeftNothingBody', 'The last change leaves out every line they drew here. Undo it to bring them back.', { ns: 'editor' })}</p>

          {onUndo && (
            <Button size="sm" variant="outline" className="mt-2" onClick={onUndo} data-testid="view-background-undo">

              <Undo2 data-icon="inline-start" />
              {t('view.undo', 'Undo', { ns: 'editor' })}

            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }
  if (background.state === 'error') {
    return (
      <FieldDescription className="text-xs text-danger-600" data-testid="view-background-status" role="alert">

        {t('view.linkedCouldNotCut', 'The linked models couldn’t be cut for this drawing ({{message}}). It prints without them; reopen the view to try again.', {
          ns: 'editor',
          message: background.message,
        })}

      </FieldDescription>
    )
  }
  return (
    <div className="flex flex-col gap-0.5" data-testid="view-background-status">

      {background.drawn.length > 0 && (
        <FieldDescription className="text-xs">
          {t('view.drawnUnderThisView', 'Drawn under this view: {{names}}.', { ns: 'editor', names: background.drawn.join(', ') })}
        </FieldDescription>
      )}

      {background.notes.map((n) =>
        n.levelChoice ? (
          <LinkedLevelChoice key={n.referenceId} note={{ ...n, levelChoice: n.levelChoice }} ctx={choice} />
        ) : (
          <FieldDescription key={n.referenceId} className="text-xs text-warning-700">
            {n.label}: {n.reason}
          </FieldDescription>
        ),
      )}
    </div>
  )
}

/**
 * Lines and colours: how the view draws (visual style, detail, hidden lines,
 * cut fill), the pen for each category where it is cut and where it is seen
 * beyond, and the linked models' look. Always open: it is where a person
 * looks for line weights.
 */

function LinesFields({ view, canEdit, set, setQuick, children }: { view: ViewElement; canEdit: boolean; set: (patch: ViewPropsPatch, label: string) => void; setQuick: (patch: QuickProps, label: string) => void; children?: ReactNode }) {
  const t = useEditorTranslate()
  const props = view.props ?? {}

  const style = props.visualStyle ?? 'hidden_line'
  const detail = props.detailLevel ?? 'medium'
  const dashedCategories = new Set(props.hiddenLineCategories ?? [])
  return (
    <FieldSet id="view-lines" data-testid="view-graphics" className="scroll-mt-4">

      <FieldLegend variant="label">{t('view.linesAndColours', 'Lines and colours', { ns: 'editor' })}</FieldLegend>

      <FieldGroup className="gap-3">
        <Field>

          <FieldLabel htmlFor="vp-style">{t('view.visualStyle', 'Visual style', { ns: 'editor' })}</FieldLabel>

          <Select value={style} onValueChange={(v) => {
              const picked = VISUAL_STYLES.find((s) => s === v)

              if (picked) set({ visualStyle: picked }, t('view.changeVisualStyle', 'change the visual style', { ns: 'editor' }))

            }} disabled={!canEdit}>
            <SelectTrigger id="vp-style" size="sm" data-testid="view-visual-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {VISUAL_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>

                    {visualStyleLabel(s, t).label}

                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <FieldDescription className="text-xs">
            {visualStyleLabel(style, t).hint} {t('view.styleApplies', 'Applies to the drawing, the print and the 3D view.', { ns: 'editor' })}
          </FieldDescription>

        </Field>
        <Field>

          <FieldLabel>{detailLevelLabel(t)}</FieldLabel>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={detail}
            disabled={!canEdit}
            aria-label={detailLevelLabel(t)}
            data-testid="view-detail-level"
            onValueChange={(v) => {
              const level = DETAIL_LEVELS.find((d) => d === v)
              if (level) set({ detailLevel: level }, t('view.changeDetailLevel', 'change the detail level', { ns: 'editor' }))
            }}
          >
            <ToggleGroupItem value="coarse">{t('view.detail.coarse', 'Coarse', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="medium">{t('view.detail.medium', 'Medium', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="fine">{t('view.detail.fine', 'Fine', { ns: 'editor' })}</ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription className="text-xs">{detailHint(detail, t)}</FieldDescription>

        </Field>
        <Field orientation="horizontal">

          <Checkbox
            id="vp-hidden-lines"
            checked={props.showHiddenLines === true}
            disabled={!canEdit || style === 'wireframe' || style === 'shaded'}
            onCheckedChange={(v) =>
              setQuick(
                { showHiddenLines: v === true },
                v === true ? t('view.showHiddenLines', 'show hidden lines', { ns: 'editor' }) : t('view.removeHiddenLines', 'remove hidden lines', { ns: 'editor' }),
              )
            }
          />

          <FieldContent>

            <FieldLabel htmlFor="vp-hidden-lines" className="font-normal">
              {t('view.showHiddenLinesLabel', 'Show hidden lines', { ns: 'editor' })}
            </FieldLabel>
            <FieldDescription className="text-xs">
              {style === 'wireframe'
                ? t('view.wireframeEveryEdge', 'Wireframe already draws every edge.', { ns: 'editor' })
                : style === 'shaded'
                  ? t('view.shadedNoEdges', 'Shaded draws no edges; pick Shaded with edges or Hidden line.', { ns: 'editor' })
                  : t('view.hiddenEdgesDashed', 'Edges behind other elements draw dashed instead of disappearing.', { ns: 'editor' })}
            </FieldDescription>

          </FieldContent>
        </Field>
        {view.viewType === 'section' && (
          <Field>

            <FieldLabel>{t('view.cutDuctAndPipe', 'Cut duct and pipe', { ns: 'editor' })}</FieldLabel>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={props.cutPattern ?? 'cross'}
              disabled={!canEdit}
              aria-label={t('view.cutFillAria', 'How cut duct and pipe are filled', { ns: 'editor' })}
              onValueChange={(v) => {
                const picked = (['cross', 'solid', 'hatch'] as const).find((c) => c === v)
                if (picked) set({ cutPattern: picked }, t('view.changeCutFill', 'change the cut fill', { ns: 'editor' }))
              }}
            >
              {(['cross', 'solid', 'hatch'] as const).map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {cutPatternLabel(c, t)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

          </Field>
        )}
        <div className="flex flex-col gap-1" data-testid="view-line-weights">

          <span className="text-xs font-medium">{t('view.hiddenLinesByCategory', 'Hidden lines by category', { ns: 'editor' })}</span>

          <FieldDescription className="text-xs">

            {t('view.pensAreIn', 'Pens, halftone and line patterns for each category are in', { ns: 'editor' })}{' '}
            <a href="#view-visibility-graphics" className="underline underline-offset-2">
              {t('view.visibilityGraphics', 'Visibility/Graphics', { ns: 'editor' })}
            </a>{' '}
            {t('view.below', 'below.', { ns: 'editor' })}

          </FieldDescription>
          <Table className="text-xs">

            <TableCaption className="sr-only">
              {t('view.dashHiddenCaption', 'Whether each category’s hidden edges draw dashed', { ns: 'editor' })}
            </TableCaption>

            <TableHeader>
              <TableRow>

                <TableHead className="h-7 px-1">{t('view.category', 'Category', { ns: 'editor' })}</TableHead>
                <TableHead className="h-7 px-1 text-center">{t('view.dashHidden', 'Dash hidden', { ns: 'editor' })}</TableHead>

              </TableRow>
            </TableHeader>
            <TableBody>
              {DASH_CATEGORIES.map((c) => (
                <TableRow key={c}>
                  <TableCell className="px-1 py-1 font-medium">{categoryWord(c, t)}</TableCell>
                  <TableCell className="px-1 py-1 text-center">
                    <Checkbox
                      id={`vp-hidden-${c}`}

                      aria-label={t('view.dashHiddenNamed', 'Dash hidden {{name}}', { ns: 'editor', name: categoryWord(c, t).toLowerCase() })}

                      checked={props.showHiddenLines === true || dashedCategories.has(c)}
                      disabled={!canEdit || props.showHiddenLines === true}
                      onCheckedChange={(v) => {
                        const next = new Set(dashedCategories)
                        if (v === true) next.add(c)
                        else next.delete(c)

                        setQuick(
                          { hiddenLineCategories: [...next] },
                          v === true
                            ? t('view.dashHiddenOn', 'dash hidden {{name}}', { ns: 'editor', name: categoryWord(c, t).toLowerCase() })
                            : t('view.dashHiddenOff', 'hide hidden {{name}}', { ns: 'editor', name: categoryWord(c, t).toLowerCase() }),
                        )

                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {children}
      </FieldGroup>
    </FieldSet>
  )
}

/**
 * What a plan shows, top to bottom: the top of the view, where walls are cut,
 * the bottom, and how far below the bottom it still sees. Applies to our model
 * and to the linked models alike. Top and bottom are blank until set (no limit).
 */

function HeightRangeFields({ view, canEdit, set }: { view: ViewElement; canEdit: boolean; set: (patch: ViewPropsPatch, label: string) => void }) {
  const t = useEditorTranslate()
  const props = view.props ?? {}

  const cut = props.cutHeightMm ?? DEFAULT_CUT_HEIGHT_MM
  return (
    <FieldSet id="view-range" data-testid="view-range" className="scroll-mt-4">

      <FieldLegend variant="label">{t('view.whatThisViewShows', 'What this view shows', { ns: 'editor' })}</FieldLegend>
      <FieldDescription className="text-xs">
        {t('view.heightsAboveLevel', 'Heights above this level. Our model and the linked models both follow them.', { ns: 'editor' })}
      </FieldDescription>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          key={`vp-top:${props.viewTopMm ?? 'none'}`}
          id="vp-top"

          label={t('view.topFt', 'Top (ft)', { ns: 'editor' })}
          value={props.viewTopMm === undefined ? null : props.viewTopMm / FT}
          disabled={!canEdit}
          optional
          placeholder={t('view.noLimit', 'No limit', { ns: 'editor' })}
          description={t('view.aboveThisNothing', 'Above this, nothing shows.', { ns: 'editor' })}
          onCommit={(ft) => set({ viewTopMm: ft * FT }, t('view.changeTop', 'change the top of the view', { ns: 'editor' }))}
          onClear={() => set({ viewTopMm: null }, t('view.showEverythingAbove', 'show everything above the cut', { ns: 'editor' }))}

        />
        <NumberField
          key={`vp-cut:${cut}`}
          id="vp-cut"

          label={t('view.cutHeightFt', 'Cut height (ft)', { ns: 'editor' })}
          value={cut / FT}
          disabled={!canEdit}
          description={t('view.wallsCutHere', 'Walls are cut here.', { ns: 'editor' })}
          onCommit={(ft) => set({ cutHeightMm: ft * FT }, t('view.changeCutHeight', 'change the cut height', { ns: 'editor' }))}

        />
        <NumberField
          key={`vp-bottom:${props.viewBottomMm ?? 'none'}`}
          id="vp-bottom"

          label={t('view.bottomFt', 'Bottom (ft)', { ns: 'editor' })}
          value={props.viewBottomMm === undefined ? null : props.viewBottomMm / FT}
          disabled={!canEdit}
          optional
          allowNegative
          placeholder={t('view.noLimit', 'No limit', { ns: 'editor' })}
          description={t('view.belowThisDepth', 'Below this, only what the depth reaches.', { ns: 'editor' })}
          onCommit={(ft) => set({ viewBottomMm: ft * FT }, t('view.changeBottom', 'change the bottom of the view', { ns: 'editor' }))}
          onClear={() => set({ viewBottomMm: null }, t('view.showEverythingBelow', 'show everything below the cut', { ns: 'editor' }))}

        />
        <NumberField
          key={`vp-depth:${props.viewDepthMm ?? 0}`}
          id="vp-view-depth"

          label={t('view.depthBelowBottomFt', 'Depth below bottom (ft)', { ns: 'editor' })}
          value={(props.viewDepthMm ?? 0) / FT}
          disabled={!canEdit}
          description={
            props.viewBottomMm === undefined
              ? t('view.setsBottomToo', 'Sets the bottom at the level too.', { ns: 'editor' })
              : t('view.seenPastBottom', 'Seen past the bottom.', { ns: 'editor' })
          }
          onCommit={(ft) =>
            set(
              { viewDepthMm: ft * FT, ...(props.viewBottomMm === undefined ? { viewBottomMm: 0 } : {}) },
              t('view.changeDepthBelow', 'change how far below the bottom the view sees', { ns: 'editor' }),
            )
          }

        />
      </div>
    </FieldSet>
  )
}

/** How a view simplifies its linked models on paper: hidden lines removed, and small things left out. */
function LinkedSimplifyFields({
  view,
  canEdit,
  set,
  setQuick,
  onChangeSmall,
}: {
  view: ViewElement
  canEdit: boolean
  set: (patch: ViewPropsPatch, label: string) => void
  setQuick: (patch: QuickProps, label: string) => void
  /** The size it was before this change, mm (for Undo if the change leaves nothing). */
  onChangeSmall: (previousMm: number) => void

}) {
  const t = useEditorTranslate()
  const props = view.props ?? {}
  const hidden = props.linkedHiddenLines !== false

  const minIn = (props.linkedMinObjectMm ?? 0) / 25.4
  return (
    <FieldGroup className="gap-2" data-testid="linked-simplify">
      <Field orientation="horizontal">

        <Checkbox
          id="vp-linked-hidden"
          checked={hidden}
          disabled={!canEdit}
          onCheckedChange={(v) =>
            setQuick(
              { linkedHiddenLines: v === true },
              v === true
                ? t('view.hideLinkedLines', 'hide linked lines under nearer things', { ns: 'editor' })
                : t('view.drawEveryLinkedLine', 'draw every linked line', { ns: 'editor' }),
            )
          }
        />

        <FieldContent>

          <FieldLabel htmlFor="vp-linked-hidden" className="font-normal">
            {t('view.hideWhatIsUnderneath', 'Hide what is underneath', { ns: 'editor' })}
          </FieldLabel>
          <FieldDescription className="text-xs">
            {t(
              'view.hideWhatIsUnderneathWhy',
              'A chair under a table, a counter under a shelf: lines covered by something nearer are left out of the drawing.',
              { ns: 'editor' },
            )}
          </FieldDescription>

        </FieldContent>
      </Field>
      <Field>

        <FieldLabel htmlFor="vp-linked-small">{t('view.leaveOutSmallerThan', 'Leave out things smaller than', { ns: 'editor' })}</FieldLabel>

        <Select value={String(minIn)} disabled={!canEdit} onValueChange={(v) => {
            const inches = Number(v)
            if (!Number.isFinite(inches) || inches === minIn) return
            onChangeSmall(props.linkedMinObjectMm ?? 0)

            set(
              { linkedMinObjectMm: inches * 25.4 },
              inches === 0
                ? t('view.drawEveryLinkedObject', 'draw every linked object', { ns: 'editor' })
                : t('view.leaveOutLinkedUnder', 'leave out linked objects under {{inches}}″', { ns: 'editor', inches }),
            )

          }}>
          <SelectTrigger id="vp-linked-small" size="sm" data-testid="linked-min-object">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SMALL_OBJECT_CHOICES_IN.map((inches) => (
                <SelectItem key={inches} value={String(inches)}>

                  {inches === 0 ? t('view.drawEverything', 'Draw everything', { ns: 'editor' }) : t('view.inchesAcross', '{{inches}}″ across', { ns: 'editor', inches })}

                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <FieldDescription className="text-xs">
          {t(
            'view.simplifyWhy',
            'Simplifies a busy architect’s model: cups, outlets, small accessories. Walls and anything the cut passes through are always drawn, and your selection stays.',
            { ns: 'editor' },
          )}
        </FieldDescription>

      </Field>
    </FieldGroup>
  )
}

/** Crop box: on/off, whether editors see it, annotation crop, its edges in feet, and fit to content. */
function CropFields({
  view,
  canEdit,
  disabledHint,
  onCrop,
  onQuickCrop,
}: {
  view: ViewElement
  canEdit: boolean
  disabledHint: string | undefined
  onCrop: (change: Omit<Extract<Command, { type: 'set_view_crop' }>, 'type' | 'viewId'>, label: string) => void
  /** An on/off crop setting: ticks at once, saved right after. */
  onQuickCrop: (patch: QuickProps, change: Omit<Extract<Command, { type: 'set_view_crop' }>, 'type' | 'viewId'>, label: string) => void
}) {

  const t = useEditorTranslate()
  const props = view.props ?? {}
  const cropOn = props.cropView !== false

  const crop: Rect = { min: view.cropMin, max: view.cropMax }
  const section = view.viewType === 'section'
  const edge = (key: 'minX' | 'maxX' | 'minY' | 'maxY', ft: number) => {
    const mm = Math.round(ft * FT)
    const next: Rect = {
      min: { x: key === 'minX' ? mm : crop.min.x, y: key === 'minY' ? mm : crop.min.y },
      max: { x: key === 'maxX' ? mm : crop.max.x, y: key === 'maxY' ? mm : crop.max.y },
    }

    onCrop({ crop: next }, t('view.changeCropBox', 'change the crop box', { ns: 'editor' }))

  }

  const labels = section
    ? {
        minX: t('view.crop.startAlongCut', 'Start along cut (ft)', { ns: 'editor' }),
        maxX: t('view.crop.endAlongCut', 'End along cut (ft)', { ns: 'editor' }),
        minY: t('view.crop.bottomElevation', 'Bottom elevation (ft)', { ns: 'editor' }),
        maxY: t('view.crop.topElevation', 'Top elevation (ft)', { ns: 'editor' }),
      }
    : {
        minX: t('view.crop.leftEdge', 'Left edge (ft)', { ns: 'editor' }),
        maxX: t('view.crop.rightEdge', 'Right edge (ft)', { ns: 'editor' }),
        minY: t('view.crop.bottomEdge', 'Bottom edge (ft)', { ns: 'editor' }),
        maxY: t('view.crop.topEdge', 'Top edge (ft)', { ns: 'editor' }),
      }

  const fields: ReadonlyArray<{ key: 'minX' | 'maxX' | 'minY' | 'maxY'; value: number }> = [
    { key: 'minX', value: crop.min.x },
    { key: 'maxX', value: crop.max.x },
    { key: 'minY', value: crop.min.y },
    { key: 'maxY', value: crop.max.y },
  ]
  return (
    <FieldSet data-testid="crop-properties">

      <FieldLegend variant="label">{t('view.cropBox', 'Crop box', { ns: 'editor' })}</FieldLegend>

      <FieldGroup className="gap-2">
        <Field orientation="horizontal">

          <Checkbox
            id="vp-crop-on"
            checked={cropOn}
            disabled={!canEdit}
            onCheckedChange={(v) =>
              onQuickCrop(
                { cropView: v === true },
                { cropView: v === true },
                v === true ? t('view.cropTheView', 'crop the view', { ns: 'editor' }) : t('view.stopCropping', 'stop cropping the view', { ns: 'editor' }),
              )
            }
          />
          <FieldContent>
            <FieldLabel htmlFor="vp-crop-on" className="font-normal">
              {t('view.cropView', 'Crop view', { ns: 'editor' })}
            </FieldLabel>
            <FieldDescription className="text-xs">
              {cropOn
                ? t('view.croppedWhatDraws', 'Only what is inside the crop box draws and prints.', { ns: 'editor' })
                : t('view.showingEverything', 'Showing everything; the viewport on a sheet fits all of it.', { ns: 'editor' })}
            </FieldDescription>

          </FieldContent>
        </Field>
        <Field orientation="horizontal">

          <Checkbox
            id="vp-crop-show"
            checked={props.showCropBox !== false}
            disabled={!canEdit}
            onCheckedChange={(v) =>
              onQuickCrop(
                { showCropBox: v === true },
                { showCropBox: v === true },
                v === true ? t('view.showCropBox', 'show the crop box', { ns: 'editor' }) : t('view.hideCropBox', 'hide the crop box', { ns: 'editor' }),
              )
            }
          />
          <FieldContent>
            <FieldLabel htmlFor="vp-crop-show" className="font-normal">
              {t('view.showCropBoxLabel', 'Show crop box', { ns: 'editor' })}
            </FieldLabel>
            <FieldDescription className="text-xs">
              {t('view.cropBoxNeverPrints', 'Its boundary and grips show while editing. It never prints.', { ns: 'editor' })}
            </FieldDescription>

          </FieldContent>
        </Field>
        <Field orientation="horizontal">

          <Checkbox
            id="vp-crop-notes"
            checked={props.annotationCrop === true}
            disabled={!canEdit}
            onCheckedChange={(v) =>
              onQuickCrop(
                { annotationCrop: v === true },
                { annotationCrop: v === true },
                v === true
                  ? t('view.notesPastCrop', 'let notes reach past the crop', { ns: 'editor' })
                  : t('view.clipNotesAtCrop', 'clip notes at the crop', { ns: 'editor' }),
              )
            }
          />
          <FieldContent>
            <FieldLabel htmlFor="vp-crop-notes" className="font-normal">
              {t('view.annotationCrop', 'Annotation crop', { ns: 'editor' })}
            </FieldLabel>
            <FieldDescription className="text-xs">
              {t('view.annotationCropWhy', 'Notes, tags and dimensions may reach 1/4″ past the crop box instead of being cut at it.', { ns: 'editor' })}
            </FieldDescription>

          </FieldContent>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => (
            <NumberField
              key={`${f.key}:${f.value}`}
              id={`vp-crop-${f.key}`}
              label={labels[f.key]}
              value={f.value / FT}
              disabled={!canEdit}
              allowNegative
              description=""
              onCommit={(ft) => edge(f.key, ft)}
            />
          ))}
        </div>
        <FieldDescription className="text-xs">

          {disabledHint ??
            t('view.cropSize', '{{width}} × {{height}} ft. Drag its edges or corners in the view, or the viewport’s edges on a sheet.', {
              ns: 'editor',
              width: ((crop.max.x - crop.min.x) / FT).toFixed(1),
              height: ((crop.max.y - crop.min.y) / FT).toFixed(1),
            })}

        </FieldDescription>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={!canEdit}
                onClick={() => onCrop({ fit: true }, t('view.fitCropBox', 'fit the crop box', { ns: 'editor' }))}
              >
                <Scan data-icon="inline-start" />
                {view.viewType === 'detail'
                  ? t('view.fitCropToDrawing', 'Fit crop to the drawing', { ns: 'editor' })
                  : t('view.fitCropToContent', 'Fit crop to content', { ns: 'editor' })}
              </Button>

            </span>
          </TooltipTrigger>

          <TooltipContent>
            {disabledHint ??
              (view.viewType === 'detail'
                ? t('view.fitCropToDrawingHint', 'Size the crop box around the lines, text and dimensions drawn here', { ns: 'editor' })
                : t('view.fitCropToContentHint', 'Size the crop box around everything on this level', { ns: 'editor' }))}
          </TooltipContent>

        </Tooltip>
      </FieldGroup>
    </FieldSet>
  )
}

function NumberField({
  id,
  label,
  value,
  disabled,
  description,
  allowNegative = false,
  optional = false,
  placeholder,
  onCommit,
  onClear,
}: {
  id: string
  label: string
  /** Null shows the field blank (optional fields: no value set). */
  value: number | null
  disabled: boolean
  description: string
  allowNegative?: boolean
  /** Blank is allowed and means "no value": `onClear` runs. */
  optional?: boolean
  placeholder?: string
  onCommit: (value: number) => void
  onClear?: () => void
}) {

  const t = useEditorTranslate()
  const [text, setText] = useState(value === null ? '' : value.toFixed(2).replace(/\.?0+$/, ''))
  const [error, setError] = useState<string | null>(null)

  const commit = () => {
    if (text.trim() === '' && optional) {
      setError(null)
      if (value !== null) onClear?.()
      return
    }
    const n = Number(text)
    if (text.trim() === '' || !Number.isFinite(n) || (!allowNegative && n < 0)) {

      setError(
        optional
          ? t('view.enterFeetOrBlank', 'Enter a number of feet, like 4 or 4.5, or leave it blank for no limit.', { ns: 'editor' })
          : t('view.enterFeet', 'Enter a number of feet, like 4 or 4.5.', { ns: 'editor' }),
      )

      return
    }
    setError(null)
    if (value === null || Math.abs(n - value) > 1e-6) onCommit(n)
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        className="h-8"
      />
      {(error || description) && <FieldDescription className={error ? 'text-danger-600' : undefined}>{error ?? description}</FieldDescription>}
    </Field>
  )
}
