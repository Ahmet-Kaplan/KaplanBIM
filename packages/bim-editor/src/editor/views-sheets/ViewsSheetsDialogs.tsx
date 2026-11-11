'use client'

import { useEffect, useState } from 'react'
import { STANDARD_SCALES, TITLE_BLOCK_TYPES, formatParameterValue, sheetPaperSize, standardProjectParameter, type ProjectParameterDef, type Sheet, type TitleBlockRow, type TitleBlockType, type ViewElement } from '@permitzip/bim-kernel'
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
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../ui/select'
import { Spinner } from '../../ui/spinner'
import { viewTypeLabel, type CreatableViewType } from './types'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { loadTitleBlocksFrom, type TitleBlockChoice } from './title-blocks-client'
import { ParameterInput } from './ParameterInput'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/** The two built-in title blocks, with the paper each is drawn for (§2.4: antet, pafta). */
function titleBlockLabel(type: TitleBlockType, t: Translate): string {
  return type === 'arch_d_mutinybim'
    ? t('sheetDialog.titleBlockArchD', 'ARCH D, 36" x 24"', { ns: 'editor' })
    : t('sheetDialog.titleBlockAnsiB', 'ANSI B, 17" x 11"', { ns: 'editor' });
}

/** The title block's own fields, in the language on screen. */
function sheetFields(t: Translate): ReadonlyArray<{ key: string; label: string; hint?: string }> {
  return [
    { key: 'project_name', label: t('sheetDialog.field.project', 'Project', { ns: 'editor' }) },
    { key: 'project_number', label: t('sheetDialog.field.projectNo', 'Project no.', { ns: 'editor' }) },
    { key: 'client', label: t('sheetDialog.field.client', 'Client', { ns: 'editor' }) },
    { key: 'address', label: t('sheetDialog.field.address', 'Project address', { ns: 'editor' }) },
    { key: 'drawn_by', label: t('sheetDialog.field.drawnBy', 'Drawn by', { ns: 'editor' }) },
    { key: 'checked_by', label: t('sheetDialog.field.checkedBy', 'Checked by', { ns: 'editor' }) },
    { key: 'date', label: t('sheetDialog.field.date', 'Date', { ns: 'editor' }) },
    { key: 'status', label: t('sheetDialog.field.status', 'Status', { ns: 'editor' }) },
  ];
}

/** What a firm (library) title block adds to the strip: owner and consultants, the seal, the issue purpose. */
function librarySheetFields(t: Translate): ReadonlyArray<{ key: string; label: string; hint?: string }> {
  const city = t('sheetDialog.hint.nameCity', 'Name, city', { ns: 'editor' });
  return [
    {
      key: 'project_state',
      label: t('sheetDialog.field.projectState', 'Project state', { ns: 'editor' }),
      hint: t('sheetDialog.hint.projectState', "Two letters (VA); prints the firm's registration number for it", { ns: 'editor' }),
    },
    { key: 'owner', label: t('sheetDialog.field.owner', 'Owner', { ns: 'editor' }), hint: city },
    { key: 'architect', label: t('sheetDialog.field.architect', 'Architect', { ns: 'editor' }), hint: city },
    { key: 'structural', label: t('sheetDialog.field.structural', 'Structural', { ns: 'editor' }), hint: city },
    { key: 'civil', label: t('sheetDialog.field.civil', 'Civil', { ns: 'editor' }), hint: city },
    { key: 'engineer_name', label: t('sheetDialog.field.engineerName', 'Engineer of record', { ns: 'editor' }) },
    { key: 'engineer_license', label: t('sheetDialog.field.engineerLicense', 'Licence no.', { ns: 'editor' }) },
    { key: 'engineer_state', label: t('sheetDialog.field.engineerState', 'Licence state', { ns: 'editor' }) },
    { key: 'issue_purpose', label: t('sheetDialog.field.issuePurpose', 'Issue purpose', { ns: 'editor' }), hint: t('sheetDialog.hint.blankStatus', 'Blank: the status', { ns: 'editor' }) },
  ];
}

/** A sheet field's type: the project parameter of the same key (a date picker for Date, a list for Status), else text. */
function fieldDef(f: { key: string; label: string; hint?: string }): ProjectParameterDef {
  const standard = standardProjectParameter(f.key)
  return { ...(standard ?? { key: f.key, valueType: 'text', group: 'project' }), label: f.label, ...(f.hint ? { hint: f.hint } : {}) }
}

/** Paper as a person says it: 42" x 30". */
const paperWords = (paper: { readonly x: number; readonly y: number }) => `${Math.round(paper.x / 25.4)}" x ${Math.round(paper.y / 25.4)}"`

const BUILT_IN = 'builtin:'
const LIBRARY = 'library:'

/** The title blocks a sheet can take: the built-in ones, then the firm library's (default first). */
function useLibraryTitleBlocks(): { readonly choices: readonly TitleBlockChoice[]; readonly note: string | null; readonly loading: boolean } {
  const t = useEditorTranslate()
  const titleBlocks = useEditorHost().data.titleBlocks
  const [state, setState] = useState<{ choices: readonly TitleBlockChoice[]; note: string | null; loading: boolean }>({ choices: [], note: null, loading: true })
  useEffect(() => {
    let live = true
    loadTitleBlocksFrom(titleBlocks)
      .then((list) => live && setState({ choices: list.choices, note: null, loading: false }))
      .catch((err: unknown) => {
        console.error('[SheetDialog] library title blocks failed to load', err)
        if (live)
          setState({
            choices: [],
            note: t('sheetDialog.titleBlocksFailed', 'The firm’s title blocks couldn’t be loaded ({{reason}}); the built-in ones still work.', {
              ns: 'editor',
              reason: err instanceof Error ? err.message : t('titleBlock.unknownError', 'unknown error', { ns: 'editor' }),
            }),
            loading: false,
          })
      })
    return () => {
      live = false
    }
  }, [titleBlocks])
  return state
}

/** Runs a save; a returned string is the refusal shown in the form (the form stays filled in). */
type Save = () => string | null | Promise<string | null>

function useSave(onDone: () => void) {
  const t = useEditorTranslate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (save: Save) => {
    setBusy(true)
    setError(null)
    try {
      const refusal = await save()
      if (refusal) setError(refusal)
      else onDone()
    } catch (err) {
      console.error('[ViewsSheetsDialogs] save failed', err)
      setError(err instanceof Error ? err.message : t('sheetDialog.couldNotSave', 'That couldn’t be saved. Try again.', { ns: 'editor' }))
    } finally {
      setBusy(false)
    }
  }
  return { error, busy, run, setError }
}

function ScaleSelect({ id, value, onChange }: { id: string; value: number; onChange: (scale: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id}>
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
  )
}

export function NewViewDialog({
  viewType,
  levels,
  onCancel,
  onCreate,
}: {
  viewType: Exclude<CreatableViewType, 'section'>
  levels: readonly string[]
  onCancel: () => void
  onCreate: (input: { name: string; level: string | null; scale: number }) => string | null | Promise<string | null>
}) {
  const t = useEditorTranslate()
  const needsLevel = viewType === 'floor_plan' || viewType === 'ceiling_plan'
  const [level, setLevel] = useState(levels[0] ?? '')
  // A suggested name for a new view: the level's name in front of what kind of view it is (§2.3 kat, §2.4 görünüm).
  const suggested = (lvl: string) => {
    const level = lvl || t('sheetDialog.levelFallback', 'Level', { ns: 'editor' })
    if (viewType === 'floor_plan') return t('sheetDialog.suggestFloorPlan', '{{level}} Mechanical plan', { ns: 'editor', level })
    if (viewType === 'ceiling_plan') return t('sheetDialog.suggestCeilingPlan', '{{level}} Ceiling plan', { ns: 'editor', level })
    if (viewType === 'three_d') return t('sheetDialog.suggestThreeD', '3D - Mechanical', { ns: 'editor' })
    return t('view.type.detail', 'Detail view (drawing-only)', { ns: 'editor' })
  }
  const [name, setName] = useState(suggested(levels[0] ?? ''))
  const [nameTouched, setNameTouched] = useState(false)
  const [scale, setScale] = useState(viewType === 'detail' ? 8 : 48)
  const { error, busy, run } = useSave(onCancel)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (needsLevel && !level.trim()) return
    void run(() => onCreate({ name: name.trim(), level: needsLevel ? level.trim() : null, scale }))
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('sheetDialog.newViewTitle', 'New {{kind}}', { ns: 'editor', kind: viewTypeLabel(viewType, t).toLowerCase() })}</DialogTitle>
            <DialogDescription>
              {viewType === 'detail'
                ? t('sheetDialog.newDetailWhy', 'A drawing-only view: draw lines, text and dimensions, then place it on a sheet.', { ns: 'editor' })
                : viewType === 'three_d'
                  ? t('sheetDialog.new3dWhy', 'A saved 3D view of the work. On a sheet it prints as an isometric outline.', { ns: 'editor' })
                  : t('sheetDialog.newPlanWhy', 'Shows one level, cut at the height you set, with the linked models underneath.', { ns: 'editor' })}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {needsLevel && (
              <Field>
                <FieldLabel htmlFor="nv-level">{t('sheetDialog.level', 'Level', { ns: 'editor' })}</FieldLabel>
                {levels.length > 0 ? (
                  <Select
                    value={level}
                    onValueChange={(v) => {
                      setLevel(v)
                      if (!nameTouched) setName(suggested(v))
                    }}
                  >
                    <SelectTrigger id="nv-level">
                      <SelectValue placeholder={t('sheetDialog.pickALevel', 'Pick a level', { ns: 'editor' })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {levels.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="nv-level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="L1" required />
                )}
                <FieldDescription>
                  {levels.length > 0
                    ? t('sheetDialog.levelsFromLinked', 'Levels come from the linked architect’s model.', { ns: 'editor' })
                    : t('sheetDialog.noLinkedLevels', 'No linked model levels yet; type the level name your ductwork uses (L1).', { ns: 'editor' })}
                </FieldDescription>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="nv-name">{t('sheetDialog.name', 'Name', { ns: 'editor' })}</FieldLabel>
              <Input
                id="nv-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameTouched(true)
                }}
                required
                maxLength={120}
                autoFocus
              />
            </Field>
            {viewType !== 'three_d' && (
              <Field>
                <FieldLabel htmlFor="nv-scale">{t('sheetDialog.scale', 'Scale', { ns: 'editor' })}</FieldLabel>
                <ScaleSelect id="nv-scale" value={scale} onChange={setScale} />
              </Field>
            )}
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('sheetDialog.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
            <Button type="submit" disabled={busy || !name.trim() || (needsLevel && !level.trim())}>
              {busy && <Spinner data-icon="inline-start" />}
              {t('sheetDialog.createAndOpen', 'Create and open', { ns: 'editor' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SheetDialog({
  sheet,
  suggestedNumber,
  projectValues = {},
  onProjectInfo,
  onCancel,
  onSave,
}: {
  /** Absent: a new sheet. */
  sheet: Sheet | null
  suggestedNumber: string
  /** The project's facts (Sheets › Project info), stored form: a blank field prints these. */
  projectValues?: Readonly<Record<string, string>>
  /** Open Project info, where the facts every sheet prints are filled in once. */
  onProjectInfo?: () => void
  onCancel: () => void
  /** `titleBlockRow`: a firm title block copied onto the sheet; null: the built-in `titleBlock`. */
  onSave: (input: { number: string; name: string; titleBlock: TitleBlockType; titleBlockRow: TitleBlockRow | null; fields: Record<string, string> }) => string | null | Promise<string | null>
}) {
  const t = useEditorTranslate()
  const [number, setNumber] = useState(sheet?.number ?? suggestedNumber)
  const [name, setName] = useState(sheet?.title ?? t('sheetDialog.defaultSheetName', 'Mechanical plan', { ns: 'editor' }))
  const [titleBlock, setTitleBlock] = useState<TitleBlockType>(sheet?.props?.titleBlock ?? 'arch_d_mutinybim')
  const library = useLibraryTitleBlocks()
  const keptRow = sheet?.props?.titleBlockRow ?? null
  // Absent: not picked yet — a new sheet starts on the firm default once the library answers.
  const [picked, setPicked] = useState<string | null>(sheet ? (keptRow ? `${LIBRARY}${keptRow.id}` : `${BUILT_IN}${sheet.props?.titleBlock ?? 'arch_d_mutinybim'}`) : null)
  const firmDefault = library.choices.find((c) => c.isDefault)
  const choice = picked ?? (firmDefault ? `${LIBRARY}${firmDefault.id}` : library.loading ? null : `${BUILT_IN}arch_d_mutinybim`)
  const libraryChoice = choice?.startsWith(LIBRARY) ? library.choices.find((c) => `${LIBRARY}${c.id}` === choice) : undefined
  // The sheet's own copy stays as it was unless another title block is picked.
  const row: TitleBlockRow | null = choice?.startsWith(LIBRARY) ? (keptRow && choice === `${LIBRARY}${keptRow.id}` ? keptRow : (libraryChoice?.row ?? null)) : null
  const [fields, setFields] = useState<Record<string, string>>(() => ({ ...(sheet?.props?.fields ?? {}) }))
  const { error, busy, run } = useSave(onCancel)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void run(() => onSave({ number: number.trim(), name: name.trim(), titleBlock, titleBlockRow: row, fields }))
  }
  const pick = (value: string) => {
    // In a form, the dropdown reports an empty pick when its value moves to an option that has not rendered
    // yet (the firm default, as the library answers). Nobody can pick "nothing" here.
    if (value === '') return
    setPicked(value)
    const builtIn = TITLE_BLOCK_TYPES.find((t) => `${BUILT_IN}${t}` === value)
    if (builtIn) setTitleBlock(builtIn)
  }
  const allFields = sheetFields(t)
  const shownFields = row ? [...allFields.filter((f) => f.key !== 'client' && f.key !== 'status'), ...librarySheetFields(t)] : allFields
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {sheet ? t('sheetDialog.sheetNumbered', 'Sheet {{number}}', { ns: 'editor', number: sheet.number }) : t('sheetDialog.newSheet', 'New sheet', { ns: 'editor' })}
            </DialogTitle>
            <DialogDescription>
              {sheet
                ? t('sheetDialog.editSheetWhy', 'Number, name and title block text.', { ns: 'editor' })
                : t('sheetDialog.newSheetWhy', 'After it opens, drag views from the panel onto it.', { ns: 'editor' })}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel htmlFor="sh-number">{t('sheetDialog.number', 'Number', { ns: 'editor' })}</FieldLabel>
                <Input id="sh-number" value={number} onChange={(e) => setNumber(e.target.value)} required maxLength={40} autoFocus={!sheet} />
              </Field>
              <Field className="col-span-2">
                <FieldLabel htmlFor="sh-name">{t('sheetDialog.name', 'Name', { ns: 'editor' })}</FieldLabel>
                <Input id="sh-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="sh-tb">{t('sheetDialog.titleBlock', 'Title block', { ns: 'editor' })}</FieldLabel>
              <Select value={choice ?? undefined} onValueChange={pick} disabled={choice === null}>
                <SelectTrigger id="sh-tb">
                  <SelectValue placeholder={t('sheetDialog.loadingTitleBlocks', 'Loading the firm’s title blocks…', { ns: 'editor' })} />
                </SelectTrigger>
                <SelectContent>
                  {library.choices.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t('sheetDialog.firmLibrary', 'Firm library', { ns: 'editor' })}</SelectLabel>
                      {library.choices.map((c) => (
                        <SelectItem key={c.id} value={`${LIBRARY}${c.id}`}>
                          {c.name}
                          {c.isDefault ? ` ${t('sheetDialog.isDefault', '(default)', { ns: 'editor' })}` : ''}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {keptRow && !library.choices.some((c) => c.id === keptRow.id) && (
                    <SelectGroup>
                      <SelectLabel>{t('sheetDialog.onThisSheet', 'On this sheet', { ns: 'editor' })}</SelectLabel>
                      <SelectItem value={`${LIBRARY}${keptRow.id}`}>{keptRow.name}</SelectItem>
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>{t('sheetDialog.builtIn', 'Built in', { ns: 'editor' })}</SelectLabel>
                    {TITLE_BLOCK_TYPES.map((type) => (
                      <SelectItem key={type} value={`${BUILT_IN}${type}`}>
                        {titleBlockLabel(type, t)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {library.note ? (
                <FieldDescription>{library.note}</FieldDescription>
              ) : (
                <FieldDescription>
                  {t('sheetDialog.firmBlocksWhere', 'Firm title blocks and the default: Settings › MutinyBIM library › Title blocks.', { ns: 'editor' })}
                </FieldDescription>
              )}
            </Field>
            <FieldDescription>
              {t('sheetDialog.blankPrintsProject', 'A blank field prints the project’s information, filled in once for every sheet', { ns: 'editor' })}
              {onProjectInfo ? (
                <>
                  {' '}
                  in{' '}
                  <Button type="button" variant="link" className="h-auto p-0" onClick={onProjectInfo} data-testid="sheet-dialog-project-info">
                    {t('sheetDialog.projectInformation', 'Project information', { ns: 'editor' })}
                  </Button>
                </>
              ) : null}
              .
            </FieldDescription>
            <div className="grid grid-cols-2 gap-3">
              {shownFields.map((f) => {
                const def = fieldDef(f)
                // A blank issue purpose prints the status (the title block's rule), so it says so.
                const fromProject = projectValues[f.key] || (f.key === 'issue_purpose' ? fields.status || projectValues.status : undefined)
                return (
                  <Field key={f.key}>
                    <FieldLabel htmlFor={`sh-f-${f.key}`}>{f.label}</FieldLabel>
                    <ParameterInput def={def} id={`sh-f-${f.key}`} value={fields[f.key] ?? ''} fallback={fromProject ? formatParameterValue(def, fromProject) : undefined} onChange={(v) => setFields((prev) => ({ ...prev, [f.key]: v }))} />
                    {f.hint && <FieldDescription>{f.hint}</FieldDescription>}
                  </Field>
                )
              })}
            </div>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('sheetDialog.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
            <Button
              type="submit"
              disabled={busy || !number.trim() || !name.trim() || choice === null}
              title={choice === null ? t('sheetDialog.waitingTitleBlocks', 'Waiting for the firm’s title blocks to load', { ns: 'editor' }) : undefined}
            >
              {busy && <Spinner data-icon="inline-start" />}
              {sheet ? t('sheetDialog.save', 'Save', { ns: 'editor' }) : t('sheetDialog.createAndOpen', 'Create and open', { ns: 'editor' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RenameViewDialog({ view, onCancel, onRename }: { view: ViewElement; onCancel: () => void; onRename: (name: string) => string | null }) {
  const t = useEditorTranslate()
  const [name, setName] = useState(view.name)
  const { error, busy, run } = useSave(onCancel)
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => onRename(name.trim()))
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('sheetDialog.renameView', 'Rename view', { ns: 'editor' })}</DialogTitle>
            <DialogDescription>
              {t('sheetDialog.renameViewWhy', 'The new name shows on every sheet this view is placed on.', { ns: 'editor' })}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="rv-name">{t('sheetDialog.name', 'Name', { ns: 'editor' })}</FieldLabel>
            <Input id="rv-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('sheetDialog.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
            <Button type="submit" disabled={busy || !name.trim() || name.trim() === view.name}>
              {t('sheetDialog.rename', 'Rename', { ns: 'editor' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => string | null
}) {
  const t = useEditorTranslate()
  const [error, setError] = useState<string | null>(null)
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-danger-600" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('sheetDialog.cancel', 'Cancel', { ns: 'editor' })}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault()
              const refusal = onConfirm()
              if (refusal) setError(refusal)
              else onCancel()
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export type PrintChoice = 'saved' | 'wait'

/**
 * Print a sheet. When your own unsaved edits touch this sheet (its views, the
 * levels they show, its notes), choose explicitly: print what is saved now, or
 * wait for those edits to save first.
 */
export function PrintDialog({
  sheet,
  savedRevision,
  pendingOnSheet,
  onCancel,
  onPrint,
}: {
  sheet: Sheet
  savedRevision: number
  pendingOnSheet: number
  onCancel: () => void
  onPrint: (choice: PrintChoice) => Promise<string | null>
}) {
  const t = useEditorTranslate()
  const [choice, setChoice] = useState<PrintChoice>(pendingOnSheet > 0 ? 'wait' : 'saved')
  const { error, busy, run } = useSave(onCancel)
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('print.printToPdf', 'Print {{number}} to PDF', { ns: 'editor', number: sheet.number })}</DialogTitle>
          <DialogDescription>
            {t('print.vectorPdf', 'A vector PDF at true scale, {{paper}}. Printing doesn’t issue the sheet.', {
              ns: 'editor',
              paper: paperWords(sheetPaperSize(sheet)),
            })}
          </DialogDescription>
        </DialogHeader>
        {pendingOnSheet > 0 ? (
          <RadioGroup value={choice} onValueChange={(v) => setChoice(v === 'saved' ? 'saved' : 'wait')} className="gap-3">
            <div className="flex items-start gap-2">
              <RadioGroupItem id="pr-wait" value="wait" />
              <Label htmlFor="pr-wait" className="flex flex-col items-start gap-0.5 font-normal">
                <span className="font-medium">{t('print.waitForEdits', 'Wait for my pending edits, then print', { ns: 'editor' })}</span>
                <span className="text-xs text-muted-foreground">
                  {pendingOnSheet === 1
                    ? t('print.oneUnsaved', '1 of your changes on this sheet isn’t saved yet. If it is refused, nothing prints and you’ll see why.', { ns: 'editor' })
                    : t('print.someUnsaved', '{{n}} of your changes on this sheet aren’t saved yet. If one is refused, nothing prints and you’ll see why.', {
                        ns: 'editor',
                        n: pendingOnSheet,
                      })}
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem id="pr-saved" value="saved" />
              <Label htmlFor="pr-saved" className="flex flex-col items-start gap-0.5 font-normal">
                <span className="font-medium">
                  {t('print.printLastSaved', 'Print the last saved revision (Rev {{revision}})', { ns: 'editor', revision: savedRevision })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('print.leavesOutYours', 'Leaves out your changes still on their way.', { ns: 'editor' })}
                </span>
              </Label>
            </div>
          </RadioGroup>
        ) : (
          <p className="text-sm">
            {t('print.allSaved', 'Everything on this sheet is saved. It prints from Rev {{revision}}.', { ns: 'editor', revision: savedRevision })}
          </p>
        )}
        {error && <p className="text-sm text-danger-600" role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t('print.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button onClick={() => void run(() => onPrint(choice))} disabled={busy} data-testid="print-pdf-confirm">
            {busy && <Spinner data-icon="inline-start" />}
            {busy
              ? choice === 'wait' && pendingOnSheet > 0
                ? t('print.waitingForEdits', 'Waiting for edits to save…', { ns: 'editor' })
                : t('print.drawingPdf', 'Drawing the PDF…', { ns: 'editor' })
              : t('print.printPdf', 'Print PDF', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
