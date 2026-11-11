'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DETAIL_LINE_STYLES, detailComponent, detailLineStyleOf, documentIndex, lineStyleFor, type BatchCommand, type DetailLineStyleId, type DrawingItem, type ModelState, type ViewCommand } from '@permitzip/bim-kernel'
import { Button } from '../../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../../ui/field'
import { Input } from '../../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select'
import { newId } from '../types'
import { useEditorTranslate, type Translate } from '../../i18n/translate'

/**
 * Drawn items selected in a drawing (one, or several with Shift+click): line
 * style, a region's Edit Boundary, detail group, copy into another view or
 * sheet, delete. Each is one kernel command (a batch for several), the same
 * agents send.
 */

/** What a drawn item is, in the language on screen (§2.4: açıklama, ölçü, etiket, detay çizgisi). */
function shapeWord(shape: string, t: Translate): string {
  switch (shape) {
    case 'line':
      return t('draft.shape.detailLine', 'detail line', { ns: 'editor' })
    case 'rect':
      return t('draft.shape.rectangle', 'rectangle', { ns: 'editor' })
    case 'cloud':
      return t('draft.shape.revisionCloud', 'revision cloud', { ns: 'editor' })
    case 'arc':
      return t('draft.shape.arc', 'arc', { ns: 'editor' })
    case 'circle':
      return t('draft.shape.circle', 'circle', { ns: 'editor' })
    case 'polyline':
      return t('draft.shape.polyline', 'polyline', { ns: 'editor' })
    case 'spline':
      return t('draft.shape.spline', 'spline', { ns: 'editor' })
    case 'region':
      return t('draft.shape.region', 'region', { ns: 'editor' })
    case 'component':
      return t('draft.shape.component', 'component', { ns: 'editor' })
    case 'repeat':
      return t('draft.shape.repeat', 'repeating detail', { ns: 'editor' })
    case 'batt':
      return t('draft.shape.batt', 'insulation run', { ns: 'editor' })
    case 'dimension':
      return t('draft.shape.dimension', 'dimension', { ns: 'editor' })
    case 'tag':
      return t('draft.shape.tag', 'tag', { ns: 'editor' })
    case 'text':
      return t('draft.shape.note', 'note', { ns: 'editor' })
    default:
      return shape
  }
}
const STYLED = new Set(['line', 'rect', 'arc', 'circle', 'polyline', 'spline', 'region'])

function batch(commands: ViewCommand[], label: string): ViewCommand | BatchCommand | null {
  if (commands.length === 0) return null
  return commands.length === 1 && commands[0] ? commands[0] : { type: 'batch_documents', label, commands }
}

export function DetailSelectionProperties({
  items,
  model,
  ownerId,
  canEdit,
  blockedReason,
  send,
  onCleared,
  editingBoundary = false,
  onEditBoundary,
}: {
  items: readonly DrawingItem[]
  model: ModelState
  ownerId: string
  canEdit: boolean
  blockedReason: string
  send: (command: ViewCommand | BatchCommand, label: string) => boolean
  onCleared: () => void
  /** A region's boundary is being sketched right now. */
  editingBoundary?: boolean
  /** Start Edit Boundary on this region. */
  onEditBoundary?: (itemId: string) => void
}) {
  const t = useEditorTranslate()
  const [groupName, setGroupName] = useState('')
  const n = items.length
  const first = items[0]
  if (!first) return null
  const what =
    n === 1
      ? first.component
        ? (detailComponent(first.component.symbolId)?.name ?? shapeWord('component', t))
        : shapeWord(first.shape, t)
      : t('draft.someDrawnItems', '{{n}} drawn items', { ns: 'editor', n })
  const styled = items.filter((i) => STYLED.has(i.shape) && !i.fill?.masking)
  const styleIds = new Set(styled.map((i) => detailLineStyleOf(i.lineStyle) ?? 'custom'))
  const styleId = styleIds.size === 1 ? [...styleIds][0] : undefined
  const pinned = items.filter((i) => i.pinned).length
  const groups = [...new Set(items.flatMap((i) => (i.detailGroup ? [i.detailGroup] : [])))]
  const index = documentIndex(model)
  const targets = [
    ...index.views.filter((v) => !v.deleted && v.id !== ownerId && v.viewType !== 'three_d' && v.viewType !== 'schedule').map((v) => ({ id: v.id as string, label: v.name })),
    ...index.sheets
      .filter((sh) => !sh.deleted && sh.id !== ownerId)
      .map((sh) => ({ id: sh.id as string, label: t('draft.sheetAndTitle', 'Sheet {{number}} {{title}}', { ns: 'editor', number: sh.number, title: sh.title }) })),
  ]
  const restyle = (id: DetailLineStyleId) => {
    const lineStyle = lineStyleFor(id)
    const command = batch(
      styled.map((i) => ({ type: 'update_drawing_item', itemId: i.id, lineStyle })),
      t('draft.restyleWhat', 'restyle {{n}} items', { ns: 'editor', n: styled.length }),
    )
    if (command) send(command, t('draft.changeLineStyle', 'change the line style', { ns: 'editor' }))
  }
  const regroup = (group: string | null) => {
    const command = batch(
      items.map((i) => ({ type: 'update_drawing_item', itemId: i.id, detailGroup: group })),
      group
        ? t('draft.groupWhat', 'group {{n}} items', { ns: 'editor', n })
        : t('draft.ungroupWhat', 'ungroup {{n}} items', { ns: 'editor', n }),
    )
    if (command) send(command, group ? t('draft.groupAsWhat', 'group as {{name}}', { ns: 'editor', name: group }) : t('draft.ungroup', 'ungroup', { ns: 'editor' }))
  }
  return (
    <div className="flex flex-col gap-3" data-testid="detail-selection">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{what}</span>
      {!canEdit && <span className="text-xs text-muted-foreground">{blockedReason}</span>}
      {n > 1 && (
        <span className="text-xs text-muted-foreground">
          {t('draft.shiftClick', 'Shift+click adds or removes items. The Modify tools work on all of them.', { ns: 'editor' })}
        </span>
      )}
      {pinned > 0 && (
        <span className="text-xs text-muted-foreground" data-testid="detail-pinned">
          {pinned === n
            ? n === 1
              ? t('draft.pinnedOne', 'Pinned: Move, trims, splits and Delete refuse it. Modify › Unpin frees it.', { ns: 'editor' })
              : t('draft.pinnedAll', 'All pinned: Move, trims, splits and Delete refuse them. Modify › Unpin frees them.', { ns: 'editor' })
            : pinned === 1
              ? t('draft.pinnedOf', '{{pinned}} of {{n}} pinned: Move, trims, splits and Delete refuse it. Modify › Unpin frees it.', { ns: 'editor', pinned, n })
              : t('draft.pinnedOfMany', '{{pinned}} of {{n}} pinned: Move, trims, splits and Delete refuse them. Modify › Unpin frees them.', {
                  ns: 'editor',
                  pinned,
                  n,
                })}
        </span>
      )}
      {styled.length > 0 && (
        <Field>
          <FieldLabel htmlFor="detail-line-style">{t('draft.lineStyle', 'Line style', { ns: 'editor' })}</FieldLabel>
          <Select value={styleId === 'custom' || !styleId ? '' : styleId} onValueChange={(v) => { const style = DETAIL_LINE_STYLES.find((x) => x.id === v); if (style) restyle(style.id) }} disabled={!canEdit}>
            <SelectTrigger id="detail-line-style" size="sm" data-testid="detail-line-style">
              <SelectValue
                placeholder={styleId === 'custom' ? t('draft.custom', 'Custom', { ns: 'editor' }) : t('draft.mixed', 'Mixed', { ns: 'editor' })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {DETAIL_LINE_STYLES.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      )}
      {n === 1 && first.shape === 'region' && onEditBoundary && (
        <Field>
          <Button variant="outline" size="sm" disabled={!canEdit || editingBoundary || first.pinned === true} onClick={() => onEditBoundary(first.id)} data-testid="detail-edit-boundary">
            {t('draft.editBoundary', 'Edit boundary', { ns: 'editor' })}
          </Button>
          <FieldDescription>
            {!canEdit
              ? blockedReason
              : first.pinned
                ? t('draft.unpinFirst', 'Unpin it first (Modify › Unpin).', { ns: 'editor' })
                : editingBoundary
                  ? t('draft.finishOrCancel', 'Finish or cancel the edit in the bar over the drawing.', { ns: 'editor' })
                  : t('draft.editBoundaryWhy', 'Drag its corners, add or remove corners, then Finish (Enter) or Cancel (Esc).', { ns: 'editor' })}
          </FieldDescription>
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="detail-group">{t('draft.detailGroup', 'Detail group', { ns: 'editor' })}</FieldLabel>
        {groups.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm" data-testid="detail-group-name">
              {groups.join(', ')}
            </span>
            <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => regroup(null)} data-testid="detail-ungroup">
              {t('draft.ungroupButton', 'Ungroup', { ns: 'editor' })}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              id="detail-group"
              value={groupName}
              placeholder={t('draft.groupPlaceholder', 'e.g. Hanger', { ns: 'editor' })}
              onChange={(e) => setGroupName(e.target.value)}
              className="h-8"
              disabled={!canEdit}
            />
            <Button variant="outline" size="sm" disabled={!canEdit || !groupName.trim()} onClick={() => regroup(groupName.trim())} data-testid="detail-group-apply">
              {t('draft.groupButton', 'Group', { ns: 'editor' })}
            </Button>
          </div>
        )}
        <FieldDescription>{t('draft.groupedWhy', 'Grouped items select, move and copy together.', { ns: 'editor' })}</FieldDescription>
      </Field>
      {targets.length > 0 && (
        <Field>
          <FieldLabel htmlFor="detail-copy-to">{t('draft.copyInto', 'Copy into', { ns: 'editor' })}</FieldLabel>
          <Select
            value=""
            disabled={!canEdit}
            onValueChange={(to) => {
              const target = targets.find((t) => t.id === to)
              if (
                target &&
                send(
                  { type: 'copy_drawing_items', itemIds: items.map((i) => i.id), toOwnerId: to, offset: { x: 0, y: 0 }, idPrefix: newId('cp') },
                  t('draft.copyIntoWhat', 'copy into {{name}}', { ns: 'editor', name: target.label }),
                )
              )
                toastCopied(t, target.label, n)
            }}
          >
            <SelectTrigger id="detail-copy-to" size="sm" data-testid="detail-copy-to">
              <SelectValue placeholder={t('draft.anotherViewOrSheet', 'Another view or sheet…', { ns: 'editor' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {targets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            {t('draft.copiesKeepPlace', 'Copies keep their place; dimensions between copied items follow the copies.', { ns: 'editor' })}
          </FieldDescription>
        </Field>
      )}
      <Button
        variant="outline"
        size="sm"
        className="text-danger-600"
        disabled={!canEdit}
        onClick={() => {
          const command = batch(
            items.map((i) => ({ type: 'delete_drawing_item', itemId: i.id })),
            t('draft.deleteWhat', 'delete {{n}} items', { ns: 'editor', n }),
          )
          if (command && send(command, t('draft.delete', 'delete', { ns: 'editor' }))) onCleared()
        }}
        data-testid="detail-delete"
      >
        {t('draft.deleteButton', 'Delete', { ns: 'editor' })}
      </Button>
      <span className="text-xs text-muted-foreground">
        {t('draft.deleteHint', 'Delete key also removes them. Ctrl+Z brings them back.', { ns: 'editor' })}
      </span>
    </div>
  )
}

function toastCopied(t: Translate, label: string, n: number) {
  toast.success(
    n === 1
      ? t('draft.copiedOne', 'Copied 1 item into {{name}}. Open it from the Views and sheets panel.', { ns: 'editor', name: label })
      : t('draft.copiedMany', 'Copied {{n}} items into {{name}}. Open it from the Views and sheets panel.', { ns: 'editor', n, name: label }),
  )
}
