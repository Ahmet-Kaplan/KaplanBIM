'use client'

import { useMemo, useState } from 'react'
import { CircleAlert, Layers, ListOrdered, Save, Trash2 } from 'lucide-react'
import { type ModelState } from '@permitzip/bim-kernel'
import { checksCommand, draftOf, inchText, nameAllStacksCommand, saveStackCommand, stackBaseClearanceDiameters, stackSummary, stacksOf, type StackDraft, type StackView } from '@permitzip/bim-pack-plumbing'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Switch } from '../../ui/switch'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { useEditorTranslate } from '../i18n/translate'
import { newId, type SubmitCommand } from '../views-sheets/types'

interface Props {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly model: ModelState
  /** Null when this person may edit; otherwise why not, in words. */
  readonly editBlocked: string | null
  readonly submit: SubmitCommand
}

/**
 * Systems › Stacks (ROADMAP P6): every sanitary, vent and storm
 * stack drawn in the model, read from the pipe (floors, size, running DFU,
 * offsets, rooms served), with the number and name a person gives it and the
 * tag it prints (`4"//S/K/L//19`). Also where the base-of-stack check is turned
 * on (STATUS decision 10: off until confirmed as code).
 */
export function StacksDialog({ open, onOpenChange, model, editBlocked, submit }: Props) {
  const t = useEditorTranslate()
  const list = useMemo(() => stacksOf(model.elements), [model])
  const checkOn = stackBaseClearanceDiameters(model.elements) !== null
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = list.stacks.find((s) => s.key === selectedKey) ?? list.stacks[0] ?? null
  const [draft, setDraft] = useState<{ readonly key: string; readonly value: StackDraft } | null>(null)
  const fields = selected ? (draft?.key === selected.key ? draft.value : draftOf(selected)) : null
  const [notice, setNotice] = useState<{ readonly kind: 'error' | 'info'; readonly text: string } | null>(null)
  const unnamed = list.stacks.filter((s) => !s.record).length

  const send = (command: Parameters<SubmitCommand>[0], label: string, done: string): boolean => {
    const refused = submit(command, label)
    if (refused) {
      console.error('[StacksDialog] the model refused the edit', { label, refused })
      setNotice({ kind: 'error', text: refused })
      return false
    }
    setNotice({ kind: 'info', text: done })
    return true
  }

  const nameAll = () => {
    const command = nameAllStacksCommand(model, list.stacks, newId)
    if (!command) return
    // §8: a count takes no plural suffix, so the two English shapes are two keys.
    const label = unnamed === 1
      ? t('plumbing.numberStacksUndoOne', 'number {{count}} stack', { ns: 'editor', count: unnamed })
      : t('plumbing.numberStacksUndoMany', 'number {{count}} stacks', { ns: 'editor', count: unnamed })
    const done = unnamed === 1
      ? t('plumbing.numberedStacksOne', 'Numbered {{count}} stack. Undo takes it back.', { ns: 'editor', count: unnamed })
      : t('plumbing.numberedStacksMany', 'Numbered {{count}} stacks. Undo takes it back.', { ns: 'editor', count: unnamed })
    send(command, label, done)
  }

  const save = (s: StackView) => {
    if (!fields) return
    const r = saveStackCommand(s, fields, newId)
    if ('refused' in r) {
      setNotice({ kind: 'error', text: r.refused })
      return
    }
    const label = s.record
      ? t('plumbing.changeStack', 'change stack {{number}}', { ns: 'editor', number: s.number ?? '' })
      : t('plumbing.nameAStack', 'name a stack', { ns: 'editor' })
    if (send(r.command, label, t('plumbing.saved', 'Saved.', { ns: 'editor' }))) setDraft(null)
  }

  const removeName = (s: StackView) => {
    if (!s.record) return
    send(
      { type: 'delete_stacks', stackIds: [s.record.id] },
      t('plumbing.removeTheNameOfStack', 'remove the name of stack {{number}}', { ns: 'editor', number: s.number ?? '' }),
      t('plumbing.stackHasNoNumberNow', 'Stack {{number}} has no number now; its pipe is unchanged.', { ns: 'editor', number: s.number ?? '' }),
    )
  }

  const setField = (key: keyof StackDraft, value: string) => {
    if (!selected || !fields) return
    setDraft({ key: selected.key, value: { ...fields, [key]: value } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl" data-testid="stacks-dialog">
        <DialogHeader>
          <DialogTitle>{t('plumbing.stacks', 'Stacks', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('plumbing.stacksDialogWhy', 'Sanitary, vent and storm stacks drawn in the model. Floors, sizes, fixture units, offsets and rooms are read from the pipe; you give each stack its number. The tag prints size // system / rooms // number.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        {editBlocked && (
          <Alert data-testid="stacks-denied">
            <CircleAlert />
            <AlertTitle>{t('plumbing.stacksReadOnly', 'You can read the stacks but not change them', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{editBlocked}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Switch
            id="bm-stack-base-check"
            checked={checkOn}
            disabled={editBlocked !== null}
            title={editBlocked ?? undefined}
            onCheckedChange={(on) =>
              send(
                checksCommand(on),
                on
                  ? t('plumbing.stackBaseCheckOn', 'turn the base-of-stack check on', { ns: 'editor' })
                  : t('plumbing.stackBaseCheckOff', 'turn the base-of-stack check off', { ns: 'editor' }),
                on
                  ? t('plumbing.stackBaseCheckOnDone', 'Branches within 3 pipe diameters of a stack’s base or offset bend now show in Coordination.', { ns: 'editor' })
                  : t('plumbing.stackBaseCheckOffDone', 'The base-of-stack check is off.', { ns: 'editor' }),
              )
            }
            data-testid="stacks-base-check"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="bm-stack-base-check">{t('plumbing.checkBranchesNearAStackBaseBend', 'Check branches near a stack’s base bend', { ns: 'editor' })}</Label>
            <p className="text-xs text-muted-foreground">{t('plumbing.stackBaseRule', 'No branch within 3 pipe diameters of the bend where a stack turns into the main or an offset. A firm rule, not a code section, so it is off until you turn it on.', { ns: 'editor' })}</p>
          </div>
        </div>
        {list.lost.map((l) => (
          <Alert key={l.record.id} variant="destructive" data-testid="stacks-lost">
            <CircleAlert />
            <AlertTitle>{t('plumbing.stackLostPipe', 'Stack {{number}} has lost its pipe', { ns: 'editor', number: l.record.number ?? '' })}</AlertTitle>
            <AlertDescription>{l.reason}</AlertDescription>
          </Alert>
        ))}
        {list.stacks.length === 0 ? (
          <Empty className="border" data-testid="stacks-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers />
              </EmptyMedia>
              <EmptyTitle>{t('plumbing.noStacksYet', 'No stacks drawn yet', { ns: 'editor' })}</EmptyTitle>
              <EmptyDescription>{t('plumbing.noStacksYetWhy', 'Draw sanitary, vent or storm pipe that runs up through a floor (Plumbing › Route pipe), and it shows here as a stack to number.', { ns: 'editor' })}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
            <Table data-testid="stacks-table">
              <TableCaption className="sr-only">{t('plumbing.stacksInTheModel', 'Stacks in the model', { ns: 'editor' })}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('plumbing.number', 'Number', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('plumbing.tag', 'Tag', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('plumbing.system', 'System', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('plumbing.runs', 'Runs', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('plumbing.rooms', 'Rooms', { ns: 'editor' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.stacks.map((s) => (
                  <TableRow key={s.key} data-testid="stacks-row" data-state={s.key === selected?.key ? 'selected' : undefined} className="cursor-pointer" onClick={() => setSelectedKey(s.key)}>
                    <TableCell>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => setSelectedKey(s.key)}
                        aria-label={t('plumbing.showStack', 'Show stack {{stack}}', { ns: 'editor', stack: s.number ?? t('plumbing.withoutANumber', 'without a number', { ns: 'editor' }) })}
                      >
                        {s.number ?? <Badge variant="outline">{t('plumbing.noNumber', 'No number', { ns: 'editor' })}</Badge>}
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-xs" data-testid="stacks-tag">
                      {s.tag}
                    </TableCell>
                    <TableCell>{s.systemName}</TableCell>
                    <TableCell className="text-xs">{stackSummary(s)}</TableCell>
                    <TableCell className="text-xs">{s.rooms.length > 0 ? s.rooms.join(', ') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {selected && fields && (
              <section className="flex flex-col gap-3" data-testid="stacks-detail" aria-label={t('plumbing.stackAria', 'Stack {{number}}', { ns: 'editor', number: selected.number ?? '' })}>
                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel htmlFor="bm-stack-number">{t('plumbing.number', 'Number', { ns: 'editor' })}</FieldLabel>
                    <Input id="bm-stack-number" value={fields.number} placeholder="19" onChange={(e) => setField('number', e.target.value)} disabled={editBlocked !== null} data-testid="stacks-number" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bm-stack-name">{t('plumbing.name', 'Name', { ns: 'editor' })}</FieldLabel>
                    <Input id="bm-stack-name" value={fields.name} placeholder={t('plumbing.kitchenStack', 'Kitchen stack', { ns: 'editor' })} onChange={(e) => setField('name', e.target.value)} disabled={editBlocked !== null} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bm-stack-system">{t('plumbing.systemLetter', 'System letter', { ns: 'editor' })}</FieldLabel>
                    <Input id="bm-stack-system" value={fields.systemCode} placeholder={selected.systemCodeTyped ? '' : selected.systemCode} onChange={(e) => setField('systemCode', e.target.value)} disabled={editBlocked !== null} />
                    <FieldDescription>
                      {t('plumbing.blankSystemCode', 'Blank: {{value}}.', {
                        ns: 'editor',
                        value: selected.systemCodeTyped
                          ? t('plumbing.backToThePipeSystems', 'back to the pipe system’s', { ns: 'editor' })
                          : t('plumbing.fromThePipeSystem', '{{code}}, from the pipe system', { ns: 'editor', code: selected.systemCode || t('plumbing.noneLower', 'none', { ns: 'editor' }) }),
                      })}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bm-stack-serves">{t('plumbing.roomsCode', 'Rooms code', { ns: 'editor' })}</FieldLabel>
                    <Input id="bm-stack-serves" value={fields.serves} placeholder={selected.servesTyped ? '' : selected.servesCode} onChange={(e) => setField('serves', e.target.value)} disabled={editBlocked !== null} data-testid="stacks-serves" />
                    <FieldDescription>
                      {t('plumbing.blankRoomsCode', 'Blank: {{value}}.', {
                        ns: 'editor',
                        value: selected.servesTyped
                          ? t('plumbing.backToTheRoomsItsBranchesReach', 'back to the rooms its branches reach', { ns: 'editor' })
                          : selected.servesCode
                            ? t('plumbing.fromTheRoomsItsBranchesReach', '{{code}}, from the rooms its branches reach', { ns: 'editor', code: selected.servesCode })
                            : t('plumbing.noRoomsFoundOnItsBranches', 'no rooms found on its branches', { ns: 'editor' }),
                      })}
                    </FieldDescription>
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => save(selected)} disabled={editBlocked !== null} title={editBlocked ?? undefined} data-testid="stacks-save">
                    <Save data-icon="inline-start" />
                    {selected.record ? t('plumbing.save', 'Save', { ns: 'editor' }) : t('plumbing.nameThisStack', 'Name this stack', { ns: 'editor' })}
                  </Button>
                  {selected.record && (
                    <Button size="sm" variant="outline" onClick={() => removeName(selected)} disabled={editBlocked !== null} title={editBlocked ?? undefined} data-testid="stacks-remove-name">
                      <Trash2 data-icon="inline-start" />
                      {t('plumbing.removeName', 'Remove name', { ns: 'editor' })}
                    </Button>
                  )}
                </div>
                <Table data-testid="stacks-floors">
                  <TableCaption>{t('plumbing.floorByFloor', 'Floor by floor, bottom up', { ns: 'editor' })}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('plumbing.floor', 'Floor', { ns: 'editor' })}</TableHead>
                      <TableHead className="text-right">{t('plumbing.size', 'Size', { ns: 'editor' })}</TableHead>
                      <TableHead className="text-right">DFU</TableHead>
                      <TableHead>{t('plumbing.offsets', 'Offsets', { ns: 'editor' })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.floors.map((f) => (
                      <TableRow key={f.levelId}>
                        <TableCell>{f.levelName || '—'}</TableCell>
                        <TableCell className="text-right">{f.sizeIn !== null ? inchText(f.sizeIn) : '—'}</TableCell>
                        <TableCell className="text-right">{f.dfu ?? '—'}</TableCell>
                        <TableCell className="text-xs">{f.offsets.length > 0 ? f.offsets.map((o) => o.text).join('; ') : t('plumbing.noneCell', 'None', { ns: 'editor' })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}
          </div>
        )}
        {notice && (
          <Alert variant={notice.kind === 'error' ? 'destructive' : 'default'} data-testid="stacks-notice">
            <CircleAlert />
            <AlertTitle>{notice.kind === 'error' ? t('plumbing.nothingWasChanged', 'Nothing was changed', { ns: 'editor' }) : t('plumbing.done', 'Done', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="stacks-close">
            {t('plumbing.close', 'Close', { ns: 'editor' })}
          </Button>
          <Button
            onClick={nameAll}
            disabled={editBlocked !== null || unnamed === 0}
            title={editBlocked ?? (unnamed === 0 ? t('plumbing.everyStackHasANumberDot', 'Every stack has a number.', { ns: 'editor' }) : undefined)}
            data-testid="stacks-name-all"
          >
            <ListOrdered data-icon="inline-start" />
            {unnamed > 0
              ? unnamed === 1
                ? t('plumbing.numberStacksButtonOne', 'Number {{count}} stack', { ns: 'editor', count: unnamed })
                : t('plumbing.numberStacksButtonMany', 'Number {{count}} stacks', { ns: 'editor', count: unnamed })
              : t('plumbing.everyStackHasANumber', 'Every stack has a number', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
