'use client'

import { useMemo, useState } from 'react'
import { DIMENSION_UNITS, TAG_TEMPLATES, TERMINATORS, clearSpotForTag, dimensionLabels, documentIndex, organizationOf, styleOf, tagHasLeader, tagLines, tagSituation, tagStyleCategoryOf, tagStyleName, type DimSpec, type DrawingItem, type ModelState, type TagSpec, type Vec2, type ViewElement } from '@permitzip/bim-kernel'
import { CopyPlus } from 'lucide-react'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Switch } from '../../ui/switch'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { withLeader } from './annotation-tools'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/**
 * Properties of a selected dimension or tag. Every change is one kernel
 * command (update_drawing_item), the same one agents send, so it saves, undoes
 * and conflicts like any other edit.
 */

/** What a tag can show, in the language on screen. */
function templateLabel(id: (typeof TAG_TEMPLATES)[number], t: Translate): string {
  switch (id) {
    case 'auto':
      return t('tag.template.auto', 'Automatic (by what it is)', { ns: 'editor' })
    case 'duct_size':
      return t('tag.template.ductSize', 'Duct size', { ns: 'editor' })
    case 'duct_size_insulation':
      return t('tag.template.ductSizeInsulation', 'Duct size with insulation', { ns: 'editor' })
    case 'pipe_size':
      return t('tag.template.pipeSize', 'Pipe size', { ns: 'editor' })
    case 'pipe_size_insulation':
      return t('tag.template.pipeSizeInsulation', 'Pipe size with insulation', { ns: 'editor' })
    case 'mark':
      return t('tag.template.mark', 'Mark', { ns: 'editor' })
    case 'air_terminal':
      return t('tag.template.airTerminal', 'Air terminal: mark and CFM', { ns: 'editor' })
    case 'equipment':
      return t('tag.template.equipment', 'Equipment mark', { ns: 'editor' })
    case 'fixture':
      return t('tag.template.fixture', 'Fixture mark', { ns: 'editor' })
    case 'fields':
      return t('tag.template.fields', 'Chosen fields', { ns: 'editor' })
    case 'gas_pipe':
      return t('tag.template.gasPipe', 'Gas pipe: size and length', { ns: 'editor' })
    case 'name_number':
      return t('tag.template.nameNumber', 'Room or space: name and number', { ns: 'editor' })
  }
}

/** The unit a dimension prints in (§7: the unit marks stay exactly as they are). */
function unitLabel(id: (typeof DIMENSION_UNITS)[number], t: Translate): string {
  switch (id) {
    case 'ft_in':
      return t('dimension.unit.ftIn', `Feet and inches (1'-6")`, { ns: 'editor' })
    case 'in':
      return t('dimension.unit.inches', 'Inches (18")', { ns: 'editor' })
    case 'mm':
      return t('dimension.unit.millimetres', 'Millimetres', { ns: 'editor' })
    case 'm':
      return t('dimension.unit.metres', 'Metres', { ns: 'editor' })
  }
}

/** What kind of dimension this is. */
function kindLabel(kind: DimSpec['kind'], t: Translate): string {
  switch (kind) {
    case 'linear':
      return t('dimension.kind.linear', 'Linear dimension', { ns: 'editor' })
    case 'aligned':
      return t('dimension.kind.aligned', 'Aligned dimension', { ns: 'editor' })
    case 'angular':
      return t('dimension.kind.angular', 'Angular dimension', { ns: 'editor' })
    case 'radial':
      return t('dimension.kind.radius', 'Radius', { ns: 'editor' })
    case 'diameter':
      return t('dimension.kind.diameter', 'Diameter', { ns: 'editor' })
    case 'arc_length':
      return t('dimension.kind.arcLength', 'Arc length', { ns: 'editor' })
    case 'spot_elevation':
      return t('dimension.kind.spotElevation', 'Spot elevation', { ns: 'editor' })
    case 'spot_coordinate':
      return t('dimension.kind.spotCoordinate', 'Spot coordinate', { ns: 'editor' })
  }
}

/** A text field that saves on Enter or when it loses focus, and only when the words changed. Keyed by its saved value, so a new value starts a fresh draft. */
function SavedInput(props: { id: string; value: string; placeholder: string; disabled: boolean; onSave: (v: string) => void }) {
  return <DraftInput key={props.value} {...props} />
}

function DraftInput({ id, value, placeholder, disabled, onSave }: { id: string; value: string; placeholder: string; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    if (draft !== value) onSave(draft)
  }
  return (
    <Input
      id={id}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setDraft(value)
      }}
    />
  )
}

export function AnnotationProperties({
  item,
  model,
  view,
  canEdit,
  blockedReason,
  onDim,
  onTag,
  onMoveTag,
  onDelete,
  onTagsBatch,
  onOpenTagStyles,
  onCreateSimilar,
}: {
  item: DrawingItem
  model: ModelState
  view: ViewElement | null
  canEdit: boolean
  blockedReason: string
  onDim: (dim: DimSpec) => void
  onTag: (tag: TagSpec) => void
  /** Put the tag's head here (view frame), e.g. the first clear spot beside its element. */
  onMoveTag?: (at: Vec2) => void
  onDelete: () => void
  /** Many tags in one edit (giving tags a style). */
  onTagsBatch?: (updates: ReadonlyArray<{ readonly itemId: string; readonly tag: TagSpec }>, label: string) => void
  /** Open Tag styles, on this style when given. */
  onOpenTagStyles?: (styleId: string | null) => void
  /** Start the Tag tool set to tag the next element like this one (C S). */
  onCreateSimilar?: () => void
}) {
  const t = useEditorTranslate()
  const dim = item.dim
  const tag = item.tag
  if (!dim && !tag) return null
  return (
    <div className="flex flex-col gap-3" data-testid="annotation-properties">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {dim ? kindLabel(dim.kind, t) : t('tag.tag', 'Tag', { ns: 'editor' })}
      </span>
      {!canEdit && <span className="text-xs text-muted-foreground">{blockedReason}</span>}
      {dim && <DimensionFields dim={dim} prints={dimensionLabels(model, view, item)} canEdit={canEdit} onDim={onDim} />}
      {tag && <TagFields item={item} model={model} tag={tag} prints={tagLines(model, tag)} canEdit={canEdit} onTag={onTag} onTagsBatch={onTagsBatch} onOpenTagStyles={onOpenTagStyles} />}
      {tag && <TagLook model={model} tag={tag} canEdit={canEdit} onTag={onTag} onCreateSimilar={onCreateSimilar} />}
      {tag && view && onMoveTag && <TagPlacement item={item} model={model} view={view} canEdit={canEdit} onMoveTag={onMoveTag} />}
      <Button variant="outline" size="sm" className="text-danger-600" disabled={!canEdit} onClick={onDelete} data-testid="annotation-delete">
        {t('tag.delete', 'Delete', { ns: 'editor' })}
      </Button>
      <span className="text-xs text-muted-foreground">
        {t('tag.deleteHint', 'Delete key also removes it. Ctrl+Z brings it back.', { ns: 'editor' })}
      </span>
    </div>
  )
}

function DimensionFields({ dim, prints, canEdit, onDim }: { dim: DimSpec; prints: readonly string[]; canEdit: boolean; onDim: (dim: DimSpec) => void }) {
  const t = useEditorTranslate()
  const style = styleOf(dim)
  const follows = (dim.refs ?? []).filter((r) => r).length
  const set = (patch: Partial<DimSpec>) => onDim({ ...dim, ...patch })
  const without = (key: 'textOverride' | 'prefix' | 'suffix', value: string) => {
    const { [key]: _gone, ...rest } = dim
    return value.trim() ? { ...rest, [key]: value } : rest
  }
  return (
    <>
      <span className="text-sm" data-testid="dimension-prints">
        {prints.join('  ·  ') || '—'}
      </span>
      <span className="text-xs text-muted-foreground">
        {follows > 0
          ? t('dimension.follows', 'Follows {{n}} point(s) on the model: it updates when they move.', { ns: 'editor', n: follows })
          : t('dimension.fixedPoints', 'Measures fixed points (it does not follow the model).', { ns: 'editor' })}
      </span>
      <Field>
        <FieldLabel htmlFor="dim-override">{t('dimension.textOverride', 'Text instead of the value', { ns: 'editor' })}</FieldLabel>
        <SavedInput id="dim-override" value={dim.textOverride ?? ''} placeholder={t('dimension.textOverrideExample', 'e.g. EQ or VERIFY', { ns: 'editor' })} disabled={!canEdit} onSave={(v) => onDim(without('textOverride', v))} />
      </Field>
      <div className="flex gap-2">
        <Field>
          <FieldLabel htmlFor="dim-prefix">{t('dimension.before', 'Before', { ns: 'editor' })}</FieldLabel>
          <SavedInput id="dim-prefix" value={dim.prefix ?? ''} placeholder="MIN. " disabled={!canEdit} onSave={(v) => onDim(without('prefix', v))} />
        </Field>
        <Field>
          <FieldLabel htmlFor="dim-suffix">{t('dimension.after', 'After', { ns: 'editor' })}</FieldLabel>
          <SavedInput id="dim-suffix" value={dim.suffix ?? ''} placeholder=" CLR" disabled={!canEdit} onSave={(v) => onDim(without('suffix', v))} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="dim-units">{t('dimension.units', 'Units', { ns: 'editor' })}</FieldLabel>
        <Select value={style.units} onValueChange={(v) => set({ style: { ...dim.style, units: DIMENSION_UNITS.find((u) => u === v) ?? style.units } })} disabled={!canEdit}>
          <SelectTrigger id="dim-units" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {DIMENSION_UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {unitLabel(u, t)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>{t('dimension.ends', 'Ends', { ns: 'editor' })}</FieldLabel>
        <ToggleGroup type="single" size="sm" variant="outline" value={style.terminator} disabled={!canEdit} onValueChange={(v) => v && set({ style: { ...dim.style, terminator: TERMINATORS.find((t) => t === v) ?? style.terminator } })}>
          {TERMINATORS.map((terminator) => (
            <ToggleGroupItem
              key={terminator}
              value={terminator}
              aria-label={t('dimension.endsNamed', '{{name}} ends', { ns: 'editor', name: terminatorLabel(terminator, t) })}
            >
              {terminatorLabel(terminator, t)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <FieldDescription>
          {t('dimension.textHeightOnPaper', 'Text is {{height}}″ tall on paper at any view scale.', {
            ns: 'editor',
            height: (style.textSizeMm / 25.4).toFixed(3),
          })}
        </FieldDescription>
      </Field>
    </>
  )
}

/** What a dimension's end mark looks like, in the language on screen. */
function terminatorLabel(terminator: (typeof TERMINATORS)[number], t: Translate): string {
  switch (terminator) {
    case 'tick':
      return t('dimension.terminator.tick', 'Tick', { ns: 'editor' })
    case 'arrow':
      return t('dimension.terminator.arrow', 'Arrow', { ns: 'editor' })
    case 'dot':
      return t('dimension.terminator.dot', 'Dot', { ns: 'editor' })
  }
}

const NO_STYLE = 'none'

/** Where the tag sits: whether it runs into other annotations or lines, and a button that moves it to the first clear spot. */
function TagPlacement({ item, model, view, canEdit, onMoveTag }: { item: DrawingItem; model: ModelState; view: ViewElement; canEdit: boolean; onMoveTag: (at: Vec2) => void }) {
  const t = useEditorTranslate()
  const showsModel = view.viewType === 'floor_plan' || view.viewType === 'ceiling_plan' || view.viewType === 'section'
  const situation = useMemo(() => (showsModel ? tagSituation(model, view.id, item) : null), [model, view, item, showsModel])
  const spot = useMemo(() => (showsModel && situation && !situation.clear ? clearSpotForTag(model, view.id, item.id) : null), [model, view, item, showsModel, situation])
  if (!situation) return null
  const crowded = [
    situation.overlaps.length > 0
      ? t('tag.overlaps', 'overlaps {{n}} other annotations', { ns: 'editor', n: situation.overlaps.length })
      : null,
    situation.crossesLines > 0 ? t('tag.crosses', 'crosses {{n}} lines', { ns: 'editor', n: situation.crossesLines }) : null,
  ]
    .filter(Boolean)
    .join(` ${t('tag.and', 'and', { ns: 'editor' })} `)
  const why = !canEdit
    ? t('tag.cannotEditView', 'You can’t edit this view', { ns: 'editor' })
    : situation.clear
      ? t('tag.alreadyClear', 'It already sits clear of everything', { ns: 'editor' })
      : !spot
        ? t('tag.noClearSpot', 'No clear spot beside its element; drag it by hand or crop the view less tightly', { ns: 'editor' })
        : undefined
  return (
    <div className="flex flex-col gap-1.5" data-testid="tag-placement">
      <span className={situation.clear ? 'text-xs text-muted-foreground' : 'text-xs text-warning-700'} data-testid="tag-placement-state">
        {situation.clear
          ? t('tag.sitsClear', 'Sits clear of other tags, notes and lines.', { ns: 'editor' })
          : t('tag.thisTagCrowded', 'This tag {{what}}.', { ns: 'editor', what: crowded })}
      </span>
      <Button variant="outline" size="sm" className="self-start" disabled={why !== undefined} title={why} data-testid="tag-move-clear" onClick={() => spot && onMoveTag(spot.at)}>
        {t('tag.moveClear', 'Move clear of others', { ns: 'editor' })}
      </Button>
      <span className="text-xs text-muted-foreground">
        {t('tag.dragItsHead', 'Or drag its head; its words stay with the element. Ctrl+Z puts it back.', { ns: 'editor' })}
      </span>
    </div>
  )
}

/** Tags in the same view on the same kind of element as this one (what "use on all" reaches). */
function siblingTags(model: ModelState, item: DrawingItem): DrawingItem[] {
  const own = item.tag ? model.elements[item.tag.elementId] : undefined
  const kind = own ? tagStyleCategoryOf(model, own) : null
  if (!kind) return []
  return (documentIndex(model).itemsByOwner.get(item.ownerId) ?? []).filter((it) => {
    if (it.deleted || !it.tag) return false
    const el = model.elements[it.tag.elementId]
    return el !== undefined && tagStyleCategoryOf(model, el) === kind
  })
}

function TagFields({
  item,
  model,
  tag,
  prints,
  canEdit,
  onTag,
  onTagsBatch,
  onOpenTagStyles,
}: {
  item: DrawingItem
  model: ModelState
  tag: TagSpec
  prints: readonly string[] | null
  canEdit: boolean
  onTag: (tag: TagSpec) => void
  onTagsBatch?: (updates: ReadonlyArray<{ readonly itemId: string; readonly tag: TagSpec }>, label: string) => void
  onOpenTagStyles?: (styleId: string | null) => void
}) {
  const t = useEditorTranslate()
  const styles = organizationOf(model).tagStyles
  const styleName = tagStyleName(model, tag)
  const siblings = siblingTags(model, item)
  const kindEl = model.elements[tag.elementId]
  const kind = kindEl ? tagStyleCategoryOf(model, kindEl) : null
  const pending = tag.styleId ? siblings.filter((s) => s.tag?.styleId !== tag.styleId) : []
  return (
    <>
      <span className="text-sm" data-testid="tag-prints">
        {prints ? prints.join(' / ') : t('tag.elementGone', 'The element this tag labelled is gone.', { ns: 'editor' })}
      </span>
      <Field>
        <FieldLabel htmlFor="tag-style">{t('tag.style', 'Style', { ns: 'editor' })}</FieldLabel>
        <Select
          value={tag.styleId && styleName ? tag.styleId : NO_STYLE}
          disabled={!canEdit}
          onValueChange={(v) => {
            if (v === NO_STYLE) {
              const { styleId: _gone, ...rest } = tag
              onTag(rest)
            } else if (v !== tag.styleId) onTag({ ...tag, styleId: v })
          }}
        >
          <SelectTrigger id="tag-style" size="sm" data-testid="tag-style-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={NO_STYLE}>{t('tag.noStyle', 'No style (pick what it shows below)', { ns: 'editor' })}</SelectItem>
              {styles.filter((s) => !s.entry.appliesTo?.length || (kind !== null && s.entry.appliesTo.includes(kind)) || s.id === tag.styleId).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.entry.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>
          {styleName
            ? t('tag.styleWhy', 'Its words, size, box and leader come from “{{name}}”. Change the style to change every tag that uses it.', { ns: 'editor', name: styleName })
            : t('tag.styleWhat', 'A style is a named tag look you can reuse on many tags.', { ns: 'editor' })}
        </FieldDescription>
      </Field>
      <div className="flex flex-wrap gap-2">
        {onOpenTagStyles && (
          <Button variant="outline" size="sm" onClick={() => onOpenTagStyles(tag.styleId ?? null)} data-testid="tag-edit-styles">
            {styleName ? t('tag.editThisStyle', 'Edit this style', { ns: 'editor' }) : t('tag.tagStyles', 'Tag styles…', { ns: 'editor' })}
          </Button>
        )}
        {onTagsBatch && tag.styleId && styleName && kind && (
          <Button
            variant="outline"
            size="sm"
            disabled={!canEdit || pending.length === 0}
            data-testid="tag-style-apply-all"
            title={
              pending.length === 0
                ? t('tag.everyTagUsesIt', 'Every {{kind}} tag in this view already uses “{{name}}”', { ns: 'editor', kind: kind.replace(/_/g, ' '), name: styleName })
                : undefined
            }
            onClick={() =>
              onTagsBatch(
                pending.flatMap((s) => (s.tag ? [{ itemId: s.id, tag: { ...s.tag, styleId: tag.styleId } }] : [])),
                pending.length === 1
                  ? t('tag.undo.useStyleOne', 'use “{{name}}” on 1 tag', { ns: 'editor', name: styleName })
                  : t('tag.undo.useStyleSome', 'use “{{name}}” on {{n}} tags', { ns: 'editor', name: styleName, n: pending.length }),
              )
            }
          >
            {pending.length === 0
              ? t('tag.allTagsUseIt', 'All tags of this kind use it', { ns: 'editor' })
              : t('tag.useOnMore', 'Use on {{n}} more {{kind}} tags here', { ns: 'editor', n: pending.length, kind: kind.replace(/_/g, ' ') })}
          </Button>
        )}
      </div>
      {!styleName && (
      <Field>
        <FieldLabel htmlFor="tag-template">{t('tag.shows', 'Shows', { ns: 'editor' })}</FieldLabel>
        <Select value={tag.template} onValueChange={(v) => onTag({ ...tag, template: TAG_TEMPLATES.find((t) => t === v) ?? tag.template })} disabled={!canEdit}>
          <SelectTrigger id="tag-template" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {TAG_TEMPLATES.filter((template) => template !== 'fields').map((template) => (
                <SelectItem key={template} value={template}>
                  {templateLabel(template, t)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>{t('tag.wordsFromElement', 'The words come from the element and change when it does.', { ns: 'editor' })}</FieldDescription>
      </Field>
      )}
    </>
  )
}

/** The tag's leader, its bend and its background, and Create similar: what a person reaches for on a single tag whatever its style. */
function TagLook({ model, tag, canEdit, onTag, onCreateSimilar }: { model: ModelState; tag: TagSpec; canEdit: boolean; onTag: (tag: TagSpec) => void; onCreateSimilar?: () => void }) {
  const t = useEditorTranslate()
  const leader = tagHasLeader(model, tag)
  const styled = tag.styleId !== undefined && tagStyleName(model, tag) !== null
  return (
    <div className="flex flex-col gap-2" data-testid="tag-look">
      <Field orientation="horizontal">
        <Switch id="tag-leader" checked={leader} disabled={!canEdit} onCheckedChange={(checked) => onTag(withLeader(model, tag, checked))} data-testid="tag-leader" />
        <FieldLabel htmlFor="tag-leader">{t('tag.leaderToElement', 'Leader to the element', { ns: 'editor' })}</FieldLabel>
      </Field>
      {styled && tag.leaderOverride !== undefined && (
        <FieldDescription>
          {tag.leaderOverride
            ? t('tag.leaderShownAnyway', 'This tag shows its leader whatever its style says.', { ns: 'editor' })
            : t('tag.leaderHiddenAnyway', 'This tag hides its leader whatever its style says.', { ns: 'editor' })}
        </FieldDescription>
      )}
      <Field orientation="horizontal">
        <Switch
          id="tag-elbow"
          checked={tag.elbow !== undefined}
          disabled={!canEdit || !leader}
          onCheckedChange={(checked) => {
            const { elbow: _bend, ...rest } = tag
            onTag(checked ? { ...rest, elbow: 'auto' } : rest)
          }}
          data-testid="tag-elbow"
        />
        <FieldLabel htmlFor="tag-elbow">{t('tag.bendLeader', 'Bend the leader (elbow)', { ns: 'editor' })}</FieldLabel>
      </Field>
      {!leader && (
        <FieldDescription>
          {t('tag.bendLeaderWhy', 'Turn the leader on to bend it. Drag its bend on the drawing to move it.', { ns: 'editor' })}
        </FieldDescription>
      )}
      <Field orientation="horizontal">
        <Switch
          id="tag-mask"
          checked={tag.mask === true}
          disabled={!canEdit}
          onCheckedChange={(checked) => {
            const { mask: _was, ...rest } = tag
            onTag(checked ? { ...rest, mask: true } : rest)
          }}
          data-testid="tag-mask"
        />
        <FieldLabel htmlFor="tag-mask">{t('tag.opaqueBackground', 'Opaque background', { ns: 'editor' })}</FieldLabel>
      </Field>
      <FieldDescription>
        {t('tag.opaqueWhy', 'Hides the lines behind the tag’s words, on screen and in print.', { ns: 'editor' })}
      </FieldDescription>
      {onCreateSimilar && (
        <Button variant="outline" size="sm" className="self-start" disabled={!canEdit} onClick={onCreateSimilar} data-testid="tag-create-similar">
          <CopyPlus data-icon="inline-start" />
          {t('tag.createSimilar', 'Create similar (C S)', { ns: 'editor' })}
        </Button>
      )}
    </div>
  )
}
