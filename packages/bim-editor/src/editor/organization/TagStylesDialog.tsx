'use client'

import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  fieldPaths,
  TAG_FIELDS,
  TAG_LEADER_ENDS,
  TAG_STYLE_BOXES,
  TAG_STYLE_CATEGORIES,
  TAG_STYLE_UNITS,
  createTagStyleFromPreset,
  documentIndex,
  organizationOf,
  renderTagStyleLines,
  tagFieldNames,
  tagStyleCategoryOf,
  tagStylePreset,
  tagStylePresets,
  type BimElement,
  type ModelState,
  type TagStyleCategory,
  type TagStyleEntry,
  elementValues,
} from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Switch } from '../../ui/switch'
import { Textarea } from '../../ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'
import { newId, type SubmitCommand } from '../views-sheets/types'

/**
 * Tag styles: named looks for tags. Each line says what a tag prints, with
 * fields in braces read from the tagged element ({size}, {insulation}, a
 * part's own parameters). A tag that uses a style follows it, so changing a
 * style here changes every tag that uses it. A style can be the default for
 * a kind of element: new tags on it (one at a time or Tag all) take it.
 *
 * Every word below is an **accessor taking a translator**, never a table of
 * English: the style editor draws its kinds, shapes, units and leader ends inside
 * keyed frames, and a table of strings is how English shipped under them.
 */

/** The kinds of element a tag style can label (§2.3: room is oda, space mekan). */
export function tagStyleKindLabel(kind: TagStyleCategory, t: Translate = englishOnly): string {
  switch (kind) {
    case 'duct':
      return t('org.tagStyle.kind.duct', 'Duct', { ns: 'editor' })
    case 'pipe':
      return t('org.tagStyle.kind.pipe', 'Pipe', { ns: 'editor' })
    case 'air_terminal':
      return t('org.tagStyle.kind.airTerminal', 'Air terminals', { ns: 'editor' })
    case 'equipment':
      return t('org.tagStyle.kind.equipment', 'Equipment', { ns: 'editor' })
    case 'fixture':
      return t('org.tagStyle.kind.fixture', 'Plumbing fixtures', { ns: 'editor' })
    case 'part':
      return t('org.tagStyle.kind.part', 'Other parts', { ns: 'editor' })
    case 'room':
      return t('org.tagStyle.kind.room', 'Rooms', { ns: 'editor' })
    case 'space':
      return t('org.tagStyle.kind.space', 'Spaces', { ns: 'editor' })
  }
}

/** The outline a tag's words sit in. */
function shapeLabel(shape: (typeof TAG_STYLE_BOXES)[number], t: Translate = englishOnly): string {
  switch (shape) {
    case 'none':
      return t('org.tagStyle.shape.none', 'No outline', { ns: 'editor' })
    case 'box':
      return t('org.tagStyle.shape.box', 'Box', { ns: 'editor' })
    case 'rounded':
      return t('org.tagStyle.shape.rounded', 'Rounded box', { ns: 'editor' })
    case 'circle':
      return t('org.tagStyle.shape.circle', 'Circle', { ns: 'editor' })
    case 'hexagon':
      return t('org.tagStyle.shape.hexagon', 'Hexagon', { ns: 'editor' })
    case 'diamond':
      return t('org.tagStyle.shape.diamond', 'Diamond', { ns: 'editor' })
  }
}

/** How a tag prints lengths (§7: the spelled-out unit names travel, the symbols do not). */
function unitsLabel(units: (typeof TAG_STYLE_UNITS)[number], t: Translate = englishOnly): string {
  switch (units) {
    case 'ft_in':
      return t('org.tagStyle.units.feetAndInches', "Feet and inches (12'-6\")", { ns: 'editor' })
    case 'ft':
      return t('org.tagStyle.units.feet', "Decimal feet (12.5')", { ns: 'editor' })
    case 'in':
      return t('org.tagStyle.units.inches', 'Inches (150")', { ns: 'editor' })
    case 'mm':
      return t('org.tagStyle.units.millimetres', 'Millimetres (3810)', { ns: 'editor' })
    case 'm':
      return t('org.tagStyle.units.metres', 'Metres (3.81)', { ns: 'editor' })
  }
}

/** What a leader ends in (§5.2: arrowhead dot / arrow / tick / none). */
function leaderEndLabel(end: (typeof TAG_LEADER_ENDS)[number], t: Translate = englishOnly): string {
  switch (end) {
    case 'dot':
      return t('org.tagStyle.leaderEnd.dot', 'Dot', { ns: 'editor' })
    case 'arrow':
      return t('org.tagStyle.leaderEnd.arrow', 'Arrow', { ns: 'editor' })
    case 'tick':
      return t('org.tagStyle.leaderEnd.tick', 'Tick', { ns: 'editor' })
    case 'none':
      return t('org.tagStyle.leaderEnd.none', 'Nothing', { ns: 'editor' })
  }
}

/** "Start from" value for a blank style. */
const BLANK = 'blank'

/** Cap heights a tag can print at, mm, with how they read on paper. */
export const TAG_TEXT_SIZES: ReadonlyArray<{ readonly mm: number; readonly label: (t: Translate) => string }> = [
  { mm: 1.6, label: (t) => t('org.tagStyle.textSize.small', '1/16" (small)', { ns: 'editor' }) },
  { mm: 2.4, label: (t) => t('org.tagStyle.textSize.standard', '3/32" (standard)', { ns: 'editor' }) },
  { mm: 3.2, label: (t) => t('org.tagStyle.textSize.eighth', '1/8"', { ns: 'editor' }) },
  { mm: 4.8, label: (t) => t('org.tagStyle.textSize.large', '3/16" (large)', { ns: 'editor' }) },
]

interface Props {
  readonly model: ModelState
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
  readonly onClose: () => void
  /** Start on this style (e.g. "Edit style" from a selected tag). */
  readonly initialStyleId?: string | null
  /** An element to preview the words on (the selected tag's). */
  readonly sampleElementId?: string | null
}

export function TagStylesDialog({ model, canEdit, blockedReason, submit, onClose, initialStyleId = null, sampleElementId = null }: Props) {
  const t = useEditorTranslate()
  const org = organizationOf(model)
  const [selectedId, setSelectedId] = useState<string | null>(initialStyleId ?? org.tagStyles[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [startFrom, setStartFrom] = useState<string>(BLANK)
  const presets = tagStylePresets()
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const selected = org.tagStyles.find((s) => s.id === selectedId) ?? null
  const run = (refusal: string | null) => {
    setError(refusal)
    return refusal
  }
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const items of documentIndex(model).itemsByOwner.values()) {
      for (const it of items) if (!it.deleted && it.tag?.styleId) counts.set(it.tag.styleId, (counts.get(it.tag.styleId) ?? 0) + 1)
    }
    return counts
  }, [model])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="tag-styles-dialog">
        <DialogHeader>
          <DialogTitle>{t('org.tagStyles.title', 'Tag styles', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {t('org.tagStyles.description', 'What a tag says, how big, with or without a box and leader. Every tag that uses a style changes when you change it here.', { ns: 'editor' })}
          </DialogDescription>
        </DialogHeader>
        {!canEdit && (
          <Alert>
            <AlertDescription>{blockedReason}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
          <div className="flex flex-col gap-3">
            <ItemGroup className="gap-1" aria-label={t('org.tagStyles.listAria', 'Tag styles', { ns: 'editor' })}>
              {org.tagStyles.map((s) => (
                <Item key={s.id} asChild size="sm" variant={s.id === selectedId ? 'muted' : 'outline'}>
                  <Button variant="ghost" className="h-auto justify-start text-left whitespace-normal" onClick={() => setSelectedId(s.id)} data-testid={`tag-style-${s.id}`} aria-pressed={s.id === selectedId}>
                    <ItemContent>
                      <ItemTitle>{s.entry.name}</ItemTitle>
                      <ItemDescription>
                        {usage.get(s.id)
                          ? usage.get(s.id) === 1
                            ? t('org.tagStyles.usedByOne', '{{n}} tag', { ns: 'editor', n: usage.get(s.id) })
                            : t('org.tagStyles.usedByMany', '{{n}} tags', { ns: 'editor', n: usage.get(s.id) })
                          : t('org.tagStyles.notUsedYet', 'Not used yet', { ns: 'editor' })}
                        {s.entry.defaultFor.length > 0
                          ? t('org.tagStyles.defaultFor', ' · default for {{kinds}}', {
                              ns: 'editor',
                              kinds: s.entry.defaultFor.map((k) => tagStyleKindLabel(k, t).toLowerCase()).join(', '),
                            })
                          : ''}
                      </ItemDescription>
                    </ItemContent>
                  </Button>
                </Item>
              ))}
            </ItemGroup>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const name = draftName.trim()
                const preset = startFrom === BLANK ? null : tagStylePreset(startFrom)
                if (!name && !preset) return
                const styleId = newId('tst')
                const command = preset
                  ? { ...createTagStyleFromPreset(preset, styleId, org.tagStyles.map((t) => t.entry.name)), ...(name ? { name } : {}) }
                  : { type: 'create_tag_style' as const, styleId, name, lines: ['{size}'] }
                const refusal = run(submit(command, t('org.undo.addTagStyle', 'add tag style {{name}}', { ns: 'editor', name: command.name })))
                if (!refusal) {
                  setDraftName('')
                  setStartFrom(BLANK)
                  setSelectedId(styleId)
                }
              }}
            >
              <Field>
                <FieldLabel htmlFor="new-tag-style-from">{t('org.tagStyles.startFrom', 'Start from', { ns: 'editor' })}</FieldLabel>
                <Select value={startFrom} disabled={!canEdit} onValueChange={setStartFrom}>
                  <SelectTrigger id="new-tag-style-from" size="sm" data-testid="tag-style-start-from">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={BLANK}>{t('org.tagStyles.blank', 'A blank style', { ns: 'editor' })}</SelectItem>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {startFrom !== BLANK && <FieldDescription className="text-xs">{tagStylePreset(startFrom)?.description}</FieldDescription>}
              </Field>
              <Field>
                <FieldLabel htmlFor="new-tag-style-name">{t('org.tagStyles.newName', 'New style name', { ns: 'editor' })}</FieldLabel>
                <Input
                  id="new-tag-style-name"
                  value={draftName}
                  placeholder={
                    startFrom === BLANK
                      ? t('org.tagStyles.newNamePlaceholder', 'e.g. Duct size + CFM', { ns: 'editor' })
                      : (tagStylePreset(startFrom)?.name ?? '')
                  }
                  disabled={!canEdit}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </Field>
              <Button
                type="submit"
                size="sm"
                disabled={!canEdit || (draftName.trim() === '' && startFrom === BLANK)}
                title={
                  !canEdit
                    ? blockedReason
                    : draftName.trim() === '' && startFrom === BLANK
                      ? t('org.tagStyles.nameOrPick', 'Name the style, or start from a ready-made one', { ns: 'editor' })
                      : undefined
                }
                data-testid="tag-style-add"
              >
                <Plus data-icon="inline-start" />
                {t('org.tagStyles.add', 'Add style', { ns: 'editor' })}
              </Button>
            </form>
          </div>
          {selected ? (
            <StyleEditor
              key={selected.id}
              model={model}
              styleId={selected.id}
              entry={selected.entry}
              canEdit={canEdit}
              run={run}
              submit={submit}
              sampleElementId={sampleElementId}
              onDelete={() => setConfirmDelete({ id: selected.id, name: selected.entry.name })}
              usedBy={usage.get(selected.id) ?? 0}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('org.tagStyles.addToStart', 'Add a style to start.', { ns: 'editor' })}</p>
          )}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('org.done', 'Done', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('org.tagStyles.deleteTitle', 'Delete the tag style "{{name}}"?', { ns: 'editor', name: confirmDelete?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('org.tagStyles.deleteWhy', 'Tags that use it must be given another style first. Ctrl+Z brings it back.', { ns: 'editor' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('org.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDelete) return
                const refusal = run(submit({ type: 'delete_tag_style', styleId: confirmDelete.id }, t('org.undo.deleteTagStyle', 'delete tag style {{name}}', { ns: 'editor', name: confirmDelete.name })))
                if (!refusal) setSelectedId(org.tagStyles.find((s) => s.id !== confirmDelete.id)?.id ?? null)
                setConfirmDelete(null)
              }}
            >
              {t('org.tagStyles.delete', 'Delete style', { ns: 'editor' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

function sampleFor(model: ModelState, entry: TagStyleEntry, sampleElementId: string | null): BimElement | null {
  const chosen = sampleElementId ? model.elements[sampleElementId] : undefined
  if (chosen && !('deleted' in chosen && chosen.deleted)) return chosen
  const kinds = new Set(entry.defaultFor.length > 0 ? entry.defaultFor : entry.appliesTo?.length ? entry.appliesTo : TAG_STYLE_CATEGORIES)
  for (const el of elementValues(model.elements)) {
    if ('deleted' in el && el.deleted) continue
    const kind = tagStyleCategoryOf(model, el)
    if (kind && kinds.has(kind)) return el
  }
  return null
}

function StyleEditor({
  model,
  styleId,
  entry,
  canEdit,
  run,
  submit,
  sampleElementId,
  onDelete,
  usedBy,
}: {
  model: ModelState
  styleId: string
  entry: TagStyleEntry
  canEdit: boolean
  run: (refusal: string | null) => string | null
  submit: SubmitCommand
  sampleElementId: string | null
  onDelete: () => void
  usedBy: number
}) {
  const t = useEditorTranslate()
  const [linesText, setLinesText] = useState(entry.lines.join('\n'))
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const fields = useMemo(() => tagFieldNames(model), [model])
  const labelOf = (name: string) => TAG_FIELDS.find((f) => f.name === name)?.label ?? fieldPaths().find((f) => f.path === name)?.label ?? name
  const sample = sampleFor(model, entry, sampleElementId)
  const draftLines = linesText.split('\n').map((l) => l.trim()).filter(Boolean)
  const preview = sample ? renderTagStyleLines(model, sample, draftLines, { units: entry.units, prefix: entry.prefix, suffix: entry.suffix }) : []
  const update = (patch: Partial<Omit<TagStyleEntry, 'type' | 'order' | 'arrow'>> & { readonly arrow?: TagStyleEntry['arrow'] | 'none' }, label: string) => run(submit({ type: 'update_tag_style', styleId, ...patch }, label))
  const saveLines = () => {
    if (draftLines.length === 0) {
      run(t('org.tagStyle.needsALine', 'A tag style needs at least one line. Type what it should say, like {{token}}.', { ns: 'editor', token: '{size}' }))
      return
    }
    if (draftLines.join('\n') !== entry.lines.join('\n')) update({ lines: draftLines }, t('org.undo.changeWhatSays', 'change what "{{name}}" says', { ns: 'editor', name: entry.name }))
  }
  const insert = (name: string) => {
    const el = textRef.current
    const token = `{${name}}`
    if (!el) {
      setLinesText((text) => `${text}${token}`)
      return
    }
    const start = el.selectionStart ?? linesText.length
    const end = el.selectionEnd ?? linesText.length
    setLinesText(`${linesText.slice(0, start)}${token}${linesText.slice(end)}`)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }
  const kinds = new Set(entry.defaultFor)
  const applies = new Set(entry.appliesTo ?? [])

  return (
    <FieldGroup className="gap-3" data-testid="tag-style-editor">
      <Field>
        <FieldLabel htmlFor="tag-style-name">{t('org.tagStyle.name', 'Name', { ns: 'editor' })}</FieldLabel>
        <Input
          key={entry.name}
          id="tag-style-name"
          defaultValue={entry.name}
          disabled={!canEdit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== entry.name) update({ name }, t('org.undo.renameTagStyle', 'rename tag style {{from}} to {{to}}', { ns: 'editor', from: entry.name, to: name }))
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="tag-style-lines">{t('org.tagStyle.says', 'What it says (one line per row)', { ns: 'editor' })}</FieldLabel>
        <Textarea id="tag-style-lines" ref={textRef} rows={3} value={linesText} disabled={!canEdit} onChange={(e) => setLinesText(e.target.value)} onBlur={saveLines} className="font-mono text-xs" data-testid="tag-style-lines" />
        <FieldDescription className="text-xs">
          {t(
            'org.tagStyle.saysWhy',
            "Words print as typed; a field in braces prints the element's value. A row whose fields are all empty is left out.",
            { ns: 'editor' },
          )}
        </FieldDescription>
        <div className="flex flex-wrap gap-1" aria-label={t('org.tagStyle.insertAField', 'Insert a field', { ns: 'editor' })}>
          {fields.map((name) => (
            <Button
              key={name}
              type="button"
              size="xs"
              variant="outline"
              disabled={!canEdit}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(name)}
              title={t('org.tagStyle.insertToken', 'Insert {{field}}', { ns: 'editor', field: `{${name}}` })}
            >
              {labelOf(name)}
            </Button>
          ))}
        </div>
      </Field>
      <div className="rounded-md border bg-muted/40 p-2 text-center font-mono text-xs" data-testid="tag-style-preview">
        {sample ? (
          preview.length > 0 ? (
            preview.map((l, i) => <div key={i}>{l}</div>)
          ) : (
            <span className="text-muted-foreground">{t('org.tagStyle.nothingToPrint', 'Nothing to print on this element', { ns: 'editor' })}</span>
          )
        ) : (
          <span className="text-muted-foreground">{t('org.tagStyle.placeOrSelect', 'Place or select something to preview', { ns: 'editor' })}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="tag-style-size">{t('org.tagStyle.textSizeOnPaper', 'Text size on paper', { ns: 'editor' })}</FieldLabel>
          <Select value={String(entry.textSizeMm)} disabled={!canEdit} onValueChange={(v) => {
              const mm = Number(v)
              if (Number.isFinite(mm) && mm !== entry.textSizeMm) update({ textSizeMm: mm }, t('org.undo.resizeText', 'resize "{{name}}" text', { ns: 'editor', name: entry.name }))
            }}>
            <SelectTrigger id="tag-style-size" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {[...TAG_TEXT_SIZES, ...(TAG_TEXT_SIZES.some((s) => s.mm === entry.textSizeMm) ? [] : [{ mm: entry.textSizeMm, label: () => `${entry.textSizeMm} mm` }])].map((s) => (
                  <SelectItem key={s.mm} value={String(s.mm)}>
                    {s.label(t)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="tag-style-shape">{t('org.tagStyle.outline', 'Outline', { ns: 'editor' })}</FieldLabel>
          <Select value={entry.box} disabled={!canEdit} onValueChange={(v) => {
              const shape = TAG_STYLE_BOXES.find((b) => b === v)
              if (shape && shape !== entry.box)
                update(
                  { box: shape },
                  t('org.undo.giveShape', 'give "{{name}}" a {{shape}}', { ns: 'editor', name: entry.name, shape: shapeLabel(shape, t).toLowerCase() }),
                )
            }}>
            <SelectTrigger id="tag-style-shape" size="sm" data-testid="tag-style-shape">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TAG_STYLE_BOXES.map((b) => (
                  <SelectItem key={b} value={b}>
                    {shapeLabel(b, t)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field>
        <FieldLabel>{t('org.tagStyle.wordsRead', 'Words read', { ns: 'editor' })}</FieldLabel>
        <ToggleGroup type="single" size="sm" variant="outline" value={entry.orientation ?? 'horizontal'} disabled={!canEdit} aria-label={t('org.tagStyle.whichWayWords', 'Which way the words read', { ns: 'editor' })} data-testid="tag-style-orientation" onValueChange={(v) => (v === 'horizontal' || v === 'along') && v !== (entry.orientation ?? 'horizontal') && update({ orientation: v }, v === 'along' ? t('org.undo.turnAlong', 'turn "{{name}}" along what it labels', { ns: 'editor', name: entry.name }) : t('org.undo.keepLevel', 'keep "{{name}}" level', { ns: 'editor', name: entry.name }))}>
          <ToggleGroupItem value="horizontal">{t('org.tagStyle.levelOnTheSheet', 'Level on the sheet', { ns: 'editor' })}</ToggleGroupItem>
          <ToggleGroupItem value="along">{t('org.tagStyle.alongTheRun', 'Along the duct or pipe', { ns: 'editor' })}</ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription className="text-xs">{t('org.tagStyle.alongWhy', 'Along turns the words with the run, never upside down.', { ns: 'editor' })}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>{t('org.tagStyle.arrowAlong', 'Arrow along the run', { ns: 'editor' })}</FieldLabel>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={entry.arrow ?? 'none'}
          disabled={!canEdit}
          aria-label={t('org.tagStyle.arrowAlong', 'Arrow along the run', { ns: 'editor' })}
          data-testid="tag-style-arrow"
          onValueChange={(v) => {
            if (v !== 'none' && v !== 'down_slope' && v !== 'up_slope') return
            if (v === (entry.arrow ?? 'none')) return
            update(
              { arrow: v },
              v === 'none'
                ? t('org.undo.takeTheArrowOff', 'take the arrow off "{{name}}"', { ns: 'editor', name: entry.name })
                : v === 'down_slope'
                  ? t('org.undo.pointDownhill', 'point "{{name}}" downhill', { ns: 'editor', name: entry.name })
                  : t('org.undo.pointUphill', 'point "{{name}}" uphill', { ns: 'editor', name: entry.name }),
            )
          }}
        >
          <ToggleGroupItem value="none">{t('org.tagStyle.arrowNone', 'None', { ns: 'editor' })}</ToggleGroupItem>
          <ToggleGroupItem value="down_slope">{t('org.tagStyle.downhill', 'Downhill', { ns: 'editor' })}</ToggleGroupItem>
          <ToggleGroupItem value="up_slope">{t('org.tagStyle.uphill', 'Uphill', { ns: 'editor' })}</ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription className="text-xs">
          {t(
            'org.tagStyle.arrowWhy',
            "An arrow under the words points to the run's lower (or higher) end, the right way on a turned plan. Level runs show none.",
            { ns: 'editor' },
          )}
        </FieldDescription>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field>
          <FieldLabel htmlFor="tag-style-prefix">{t('org.tagStyle.before', 'Before', { ns: 'editor' })}</FieldLabel>
          <Input key={`p:${entry.prefix ?? ''}`} id="tag-style-prefix" defaultValue={entry.prefix ?? ''} placeholder="(N) " maxLength={20} disabled={!canEdit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} onBlur={(e) => e.target.value !== (entry.prefix ?? '') && update({ prefix: e.target.value }, t('org.undo.changeStart', 'change what "{{name}}" starts with', { ns: 'editor', name: entry.name }))} />
        </Field>
        <Field>
          <FieldLabel htmlFor="tag-style-suffix">{t('org.tagStyle.after', 'After', { ns: 'editor' })}</FieldLabel>
          <Input
            key={`s:${entry.suffix ?? ''}`}
            id="tag-style-suffix"
            defaultValue={entry.suffix ?? ''}
            placeholder={` ${t('org.tagStyle.suffixExample', 'TYP.', { ns: 'editor' })}`}
            maxLength={20}
            disabled={!canEdit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onBlur={(e) => e.target.value !== (entry.suffix ?? '') && update({ suffix: e.target.value }, t('org.undo.changeEnd', 'change what "{{name}}" ends with', { ns: 'editor', name: entry.name }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="tag-style-units">{t('org.tagStyle.lengthsAndHeights', 'Lengths and heights', { ns: 'editor' })}</FieldLabel>
          <Select value={entry.units ?? 'ft_in'} disabled={!canEdit} onValueChange={(v) => {
              const units = TAG_STYLE_UNITS.find((u) => u === v)
              if (units && units !== (entry.units ?? 'ft_in'))
                update({ units }, t('org.undo.printLengthsIn', 'print "{{name}}" lengths in {{units}}', { ns: 'editor', name: entry.name, units: unitsLabel(units, t).toLowerCase() }))
            }}>
            <SelectTrigger id="tag-style-units" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TAG_STYLE_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {unitsLabel(u, t)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field orientation="horizontal" className="w-auto">
          <Switch id="tag-style-leader" checked={entry.leader} disabled={!canEdit} onCheckedChange={(checked) => update({ leader: checked }, checked ? t('org.undo.addLeaders', 'add leaders to "{{name}}"', { ns: 'editor', name: entry.name }) : t('org.undo.removeLeaders', 'remove leaders from "{{name}}"', { ns: 'editor', name: entry.name }))} />
          <FieldLabel htmlFor="tag-style-leader">{t('org.tagStyle.leaderToElement', 'Leader to the element', { ns: 'editor' })}</FieldLabel>
        </Field>
        {entry.leader && (
          <Field className="w-40">
            <FieldLabel htmlFor="tag-style-leader-end">{t('org.tagStyle.leaderEndsIn', 'Leader ends in', { ns: 'editor' })}</FieldLabel>
            <Select value={entry.leaderEnd ?? 'dot'} disabled={!canEdit} onValueChange={(v) => {
                const end = TAG_LEADER_ENDS.find((x) => x === v)
                if (end && end !== (entry.leaderEnd ?? 'dot'))
                  update(
                    { leaderEnd: end },
                    t('org.undo.endLeadersIn', 'end "{{name}}" leaders in {{end}}', { ns: 'editor', name: entry.name, end: leaderEndLabel(end, t).toLowerCase() }),
                  )
              }}>
              <SelectTrigger id="tag-style-leader-end" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {TAG_LEADER_ENDS.map((x) => (
                    <SelectItem key={x} value={x}>
                      {leaderEndLabel(x, t)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      <FieldSet>
        <FieldLegend variant="label">{t('org.tagStyle.itLabels', 'It labels', { ns: 'editor' })}</FieldLegend>
        <FieldGroup className="grid grid-cols-2 gap-1.5">
          {TAG_STYLE_CATEGORIES.map((k) => (
            <Field key={k} orientation="horizontal">
              <Checkbox
                id={`tag-style-applies-${k}`}
                checked={applies.size === 0 || applies.has(k)}
                disabled={!canEdit || (kinds.has(k) && applies.size > 0)}
                data-testid={`tag-style-applies-${k}`}
                onCheckedChange={(v) => {
                  const all = applies.size === 0 ? new Set(TAG_STYLE_CATEGORIES) : new Set(applies)
                  if (v === true) all.add(k)
                  else all.delete(k)
                  if (all.size === 0) {
                    run(t('org.tagStyle.hasToLabelSomething', 'A tag style has to label something. Tick at least one kind.', { ns: 'editor' }))
                    return
                  }
                  const next = all.size === TAG_STYLE_CATEGORIES.length ? [] : TAG_STYLE_CATEGORIES.filter((x) => all.has(x))
                  update(
                    { appliesTo: next },
                    v === true
                      ? t('org.undo.letLabel', 'let "{{name}}" label {{kind}}', { ns: 'editor', name: entry.name, kind: tagStyleKindLabel(k, t).toLowerCase() })
                      : t('org.undo.stopLabelling', 'stop "{{name}}" labelling {{kind}}', { ns: 'editor', name: entry.name, kind: tagStyleKindLabel(k, t).toLowerCase() }),
                  )
                }}
              />
              <FieldContent>
                <FieldLabel htmlFor={`tag-style-applies-${k}`} className="font-normal">
                  {tagStyleKindLabel(k, t)}
                </FieldLabel>
              </FieldContent>
            </Field>
          ))}
        </FieldGroup>
        <FieldDescription className="text-xs">
          {t('org.tagStyle.appliesWhy', 'Only these kinds can take it. A kind it is the default for stays ticked; untick the default first.', { ns: 'editor' })}
        </FieldDescription>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">{t('org.tagStyle.newTagsOnThese', 'New tags on these use it', { ns: 'editor' })}</FieldLegend>
        <FieldGroup className="grid grid-cols-2 gap-1.5">
          {TAG_STYLE_CATEGORIES.map((k) => (
            <Field key={k} orientation="horizontal">
              <Checkbox
                id={`tag-style-default-${k}`}
                checked={kinds.has(k)}
                disabled={!canEdit}
                data-testid={`tag-style-default-${k}`}
                onCheckedChange={(v) => {
                  const next = TAG_STYLE_CATEGORIES.filter((x) => (x === k ? v === true : kinds.has(x)))
                  update(
                    { defaultFor: next },
                    v === true
                      ? t('org.undo.makeDefaultFor', 'make "{{name}}" the default for {{kind}}', { ns: 'editor', name: entry.name, kind: tagStyleKindLabel(k, t).toLowerCase() })
                      : t('org.undo.stopBeingDefaultFor', 'stop "{{name}}" being the default for {{kind}}', { ns: 'editor', name: entry.name, kind: tagStyleKindLabel(k, t).toLowerCase() }),
                  )
                }}
              />
              <FieldContent>
                <FieldLabel htmlFor={`tag-style-default-${k}`} className="font-normal">
                  {tagStyleKindLabel(k, t)}
                </FieldLabel>
              </FieldContent>
            </Field>
          ))}
        </FieldGroup>
        <FieldDescription className="text-xs">
          {t('org.tagStyle.defaultsWhy', 'Tag and Tag all use it for these. Another style that was the default for one of them stops being it.', { ns: 'editor' })}
        </FieldDescription>
      </FieldSet>
      <Button
        variant="outline"
        size="sm"
        className="w-fit text-danger-600"
        disabled={!canEdit || usedBy > 0}
        onClick={onDelete}
        title={
          usedBy > 0
            ? usedBy === 1
              ? t('org.tagStyle.usedByTitleOne', '{{n}} tag use this style; give them another style first', { ns: 'editor', n: usedBy })
              : t('org.tagStyle.usedByTitleMany', '{{n}} tags use this style; give them another style first', { ns: 'editor', n: usedBy })
            : undefined
        }
      >
        <Trash2 data-icon="inline-start" />
        {t('org.tagStyles.delete', 'Delete style', { ns: 'editor' })}
      </Button>
      {usedBy > 0 && (
        <FieldDescription className="text-xs">
          {usedBy === 1
            ? t('org.tagStyle.usedByOne', "Used by {{n}} tag, so it can't be deleted until they use another style.", { ns: 'editor', n: usedBy })
            : t('org.tagStyle.usedByMany', "Used by {{n}} tags, so it can't be deleted until they use another style.", { ns: 'editor', n: usedBy })}
        </FieldDescription>
      )}
    </FieldGroup>
  )
}
