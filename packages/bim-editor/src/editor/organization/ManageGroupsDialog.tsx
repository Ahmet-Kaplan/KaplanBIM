'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { DEFAULT_GROUP_ID, GROUP_VISIBILITIES, elementValues, groupIdOf, isOrganized, organizationOf, typicalCapStatus, type GroupVisibility, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemActions, ItemContent, ItemGroup } from '../../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Switch } from '../../ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { useEditorTranslate } from '../i18n/translate'
import { newId, type SubmitCommand } from '../views-sheets/types'
import { groupVisibilityLabel } from './labels'
import { TypicalCapNotice } from './TypicalCapNotice'
import { TypicalDialog } from './TypicalDialog'

interface Props {
  readonly model: ModelState
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
  readonly onClose: () => void
}

/** Elements per group; one pass, only while the dialog is open. */
function memberCounts(model: ModelState): ReadonlyMap<string, number> {
  const org = organizationOf(model)
  const counts = new Map<string, number>()
  for (const el of elementValues(model.elements)) {
    if (!isOrganized(el)) continue
    const id = groupIdOf(org, el)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** Create, rename, colour, lock and delete the model's groups. */
export function ManageGroupsDialog({ model, canEdit, blockedReason, submit, onClose }: Props) {
  const t = useEditorTranslate()
  const org = organizationOf(model)
  const counts = useMemo(() => memberCounts(model), [model])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [deleting, setDeleting] = useState<{ id: string; name: string; count: number } | null>(null)
  const [moveTo, setMoveTo] = useState<string>(DEFAULT_GROUP_ID)
  const [typicalFor, setTypicalFor] = useState<string | null>(null)
  const typicalGroup = typicalFor ? org.groupById.get(typicalFor) : undefined
  const run = (refusal: string | null) => {
    setError(refusal)
    return refusal
  }
  const add = () => {
    const name = draft.trim()
    if (!name) return
    if (!run(submit({ type: 'create_group', groupId: newId('grp'), name }, t('org.undo.addGroup', 'add group {{name}}', { ns: 'editor', name })))) setDraft('')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl" data-testid="manage-groups-dialog">
        <DialogHeader>
          <DialogTitle>{t('org.groups.title', 'Groups', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {t(
              'org.groups.description',
              "Every duct, pipe and part is in one group. Views show, halftone or hide a group, and a locked group can't be changed by anyone, including agents.",
              { ns: 'editor' },
            )}
          </DialogDescription>
        </DialogHeader>
        {!canEdit && (
          <Alert>
            <AlertDescription>{blockedReason}</AlertDescription>
          </Alert>
        )}
        <TypicalCapNotice model={model} canEdit={canEdit} blockedReason={blockedReason} submit={(c, label) => run(submit(c, label))} />
        <ItemGroup className="max-h-[50vh] overflow-y-auto">
          {org.groups.map((g) => {
            const count = counts.get(g.id) ?? 0
            const active = org.activeGroupId === g.id
            return (
              <Item key={g.id} variant="outline" size="sm" data-testid={`manage-group-${g.id}`}>
                <Input
                  type="color"
                  aria-label={t('org.group.colour', '{{name}} colour', { ns: 'editor', name: g.entry.name })}
                  className="h-8 w-10 shrink-0 p-1"
                  defaultValue={g.entry.color}
                  disabled={!canEdit}
                  onBlur={(e) =>
                    e.target.value !== g.entry.color &&
                    run(submit({ type: 'update_group', groupId: g.id, color: e.target.value }, t('org.undo.recolour', 'recolour {{name}}', { ns: 'editor', name: g.entry.name })))
                  }
                />
                <ItemContent className="min-w-0">
                  <Input
                    key={`${g.id}:${g.entry.name}`}
                    aria-label={t('org.group.name', 'Group name', { ns: 'editor' })}
                    defaultValue={g.entry.name}
                    disabled={!canEdit}
                    className="h-8"
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    onBlur={(e) => {
                      const name = e.target.value.trim()
                      if (name && name !== g.entry.name) run(submit({ type: 'update_group', groupId: g.id, name }, t('org.undo.renameTo', 'rename {{from}} to {{to}}', { ns: 'editor', from: g.entry.name, to: name })))
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {count === 1
                      ? t('org.group.elementOne', '{{n}} element', { ns: 'editor', n: count.toLocaleString() })
                      : t('org.group.elementMany', '{{n}} elements', { ns: 'editor', n: count.toLocaleString() })}
                    {active ? t('org.group.newWorkGoesHere', ' · new work goes here', { ns: 'editor' }) : ''}
                    {g.entry.typical
                      ? t('org.group.typicalNote', ' · typical {{label}}, {{n}} in all', {
                          ns: 'editor',
                          label: g.entry.typical.label.toLowerCase(),
                          n: g.entry.typical.copies.length + 1,
                        })
                      : ''}
                  </span>
                </ItemContent>
                <ItemActions className="gap-2">
                  {g.id !== DEFAULT_GROUP_ID && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTypicalFor(g.id)}
                      data-testid={`typical-group-${g.id}`}
                      title={t('org.group.repeatTitle', 'Repeat this group (a typical unit or bay): copies draw on plans and count their loads', { ns: 'editor' })}
                    >
                      {g.entry.typical ? t('org.typical.short', 'Typical ×{{n}}', { ns: 'editor', n: g.entry.typical.copies.length + 1 }) : t('org.typical.shortNone', 'Typical…', { ns: 'editor' })}
                    </Button>
                  )}
                  {active ? (
                    <Badge variant="secondary">{t('org.active', 'Active', { ns: 'editor' })}</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canEdit || g.entry.locked}
                      onClick={() => run(submit({ type: 'set_active_group', groupId: g.id }, t('org.undo.makeActive', 'make {{name}} active', { ns: 'editor', name: g.entry.name })))}
                    >
                      {t('org.makeActive', 'Make active', { ns: 'editor' })}
                    </Button>
                  )}
                  <Select value={g.entry.defaultVisibility} disabled={!canEdit} onValueChange={(v) => {
                    const next = GROUP_VISIBILITIES.find((x) => x === v)
                    if (next)
                      run(
                        submit(
                          { type: 'update_group', groupId: g.id, defaultVisibility: next },
                          t('org.undo.showByDefault', 'show {{name}} as {{visibility}} by default', { ns: 'editor', name: g.entry.name, visibility: groupVisibilityLabel(next, t).toLowerCase() }),
                        ),
                      )
                  }}>
                    <SelectTrigger size="sm" className="w-28" aria-label={t('org.group.defaultVisibilityAria', "{{name}} in views that don't set it", { ns: 'editor', name: g.entry.name })}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {GROUP_VISIBILITIES.map((v: GroupVisibility) => (
                          <SelectItem key={v} value={v}>
                            {groupVisibilityLabel(v, t)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Field orientation="horizontal" className="w-auto">
                    <Switch
                      id={`lock-${g.id}`}
                      checked={g.entry.locked}
                      disabled={!canEdit}
                      data-testid={`lock-group-${g.id}`}
                      onCheckedChange={(locked) =>
                        run(
                          submit(
                            { type: 'lock_group', groupId: g.id, locked },
                            locked
                              ? t('org.undo.lock', 'lock {{name}}', { ns: 'editor', name: g.entry.name })
                              : t('org.undo.unlock', 'unlock {{name}}', { ns: 'editor', name: g.entry.name }),
                          ),
                        )
                      }
                    />
                    <FieldLabel htmlFor={`lock-${g.id}`} className="font-normal">
                      {t('org.group.locked', 'Locked', { ns: 'editor' })}
                    </FieldLabel>
                  </Field>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('org.deleteNamed', 'Delete {{name}}', { ns: 'editor', name: g.entry.name })}
                          disabled={!canEdit || g.id === DEFAULT_GROUP_ID || g.entry.locked}
                          onClick={() => {
                            setMoveTo(DEFAULT_GROUP_ID)
                            setDeleting({ id: g.id, name: g.entry.name, count })
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {g.id === DEFAULT_GROUP_ID
                        ? t('org.groups.defaultHolds', '{{name}} holds everything not in another group, so it stays. Rename it instead.', { ns: 'editor', name: g.entry.name })
                        : g.entry.locked
                          ? t('org.groups.unlockFirst', 'Unlock it before deleting it.', { ns: 'editor' })
                          : t('org.deleteNamed', 'Delete {{name}}', { ns: 'editor', name: g.entry.name })}
                    </TooltipContent>
                  </Tooltip>
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Field className="flex-1">
            <FieldLabel htmlFor="new-group-name">{t('org.groups.new', 'New group', { ns: 'editor' })}</FieldLabel>
            <Input
              id="new-group-name"
              value={draft}
              placeholder={t('org.groups.newPlaceholder', 'e.g. Phase 2 tenant fit-out', { ns: 'editor' })}
              disabled={!canEdit}
              onChange={(e) => setDraft(e.target.value)}
              data-testid="new-group-name"
            />
          </Field>
          <Button type="submit" disabled={!canEdit || draft.trim() === ''} data-testid="add-group">
            <Plus data-icon="inline-start" />
            {t('org.groups.add', 'Add group', { ns: 'editor' })}
          </Button>
        </form>
        {error && (
          <Alert variant="destructive" data-testid="manage-groups-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('org.done', 'Done', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('org.groups.deleteTitle', 'Delete {{name}}?', { ns: 'editor', name: deleting?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-3">
                {deleting && deleting.count > 0 ? (
                  <>
                    <p>
                      {deleting.count === 1
                        ? t('org.groups.deleteOne', '1 element is in it. They move to the group you pick. You can undo this.', { ns: 'editor' })
                        : t('org.groups.deleteMany', '{{n}} elements are in it. They move to the group you pick. You can undo this.', { ns: 'editor', n: deleting.count.toLocaleString() })}
                    </p>
                    <Select value={moveTo} onValueChange={setMoveTo}>
                      <SelectTrigger size="sm" aria-label={t('org.groups.moveTo', 'Move its elements to', { ns: 'editor' })}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {org.groups
                            .filter((g) => g.id !== deleting.id && !g.entry.locked)
                            .map((g) => (
                              <SelectItem key={g.id} value={g.id}>
                                {g.entry.name}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <p>{t('org.groups.deleteEmpty', 'Nothing is in it. You can undo this.', { ns: 'editor' })}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('org.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deleting) return
                run(
                  submit(
                    { type: 'delete_group', groupId: deleting.id, ...(deleting.count > 0 ? { moveTo } : {}) },
                    t('org.undo.deleteGroup', 'delete group {{name}}', { ns: 'editor', name: deleting.name }),
                  ),
                )
                setDeleting(null)
              }}
            >
              {t('org.groups.delete', 'Delete group', { ns: 'editor' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {typicalGroup && <TypicalDialog group={typicalGroup} elementCount={counts.get(typicalGroup.id) ?? 0} capStatus={typicalCapStatus(model)} canEdit={canEdit} blockedReason={blockedReason} submit={submit} onClose={() => setTypicalFor(null)} />}
    </Dialog>
  )
}
