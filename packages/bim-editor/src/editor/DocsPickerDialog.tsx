'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Box, ChevronDown, ChevronRight, Cloud, FileBox, FileX, Folder, FolderOpen, Search, X } from 'lucide-react'
import { Alert, AlertDescription } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty'
import { Field, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui/input-group'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '../ui/item'
import { ScrollArea } from '../ui/scroll-area'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Spinner } from '../ui/spinner'
import type { PackSet } from '@permitzip/bim-kernel/packs'
import { LinkedDisciplineSelectItems } from './linked-display/LinkedDisciplineSelectItems'
import { LinkedContributorFields } from './linked-display/LinkedDisciplinesField'
import {
  isLinkedDiscipline,
  linkedDisciplineChoices,
  linkedDisciplineLabel,
  MAX_LINKED_DISCIPLINES,
  formatBytes,
  guessDiscipline,
  type DocsBrowseResponse,
  type DocsFileKind,
  type DocsFileView,
  type DocsFolderView,
  type LinkedDiscipline,
} from '../contracts/building-model/linked-contract'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { useEditorTranslate, type Translate } from './i18n/translate'
import { addDocsItemsFrom, browseDocsFrom } from './linked-api'

interface Props {
  projectId: string
  open: boolean
  onOpenChange(open: boolean): void
  /** The connected Revit model, whose Autodesk Docs project is browsed. */
  revitModelName: string | null
  /** Called after files were queued, so the panel shows their progress now. */
  onQueued(): void
  /** The open model's discipline registry (its add-ons and firm rows); built-in and first-party when absent. */
  disciplineSet?: PackSet
}

const ROOT = '__root__'
const MAX_PICK = 25
type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded'; data: DocsBrowseResponse }

interface Picked {
  readonly file: DocsFileView
  readonly label: string
  readonly discipline: LinkedDiscipline
  /** Other disciplines the same file shows (one firm's model may carry several). */
  readonly more: readonly LinkedDiscipline[]
}

/** What kind of file a row is, each as a literal `t()` call: a key behind a variable is invisible to `i18n:review`. */
function kindWord(kind: DocsFileKind, t: Translate): string {
  switch (kind) {
    case 'rvt':
      return t('docsPicker.kindRvt', 'Revit', { ns: 'editor' })
    case 'ifc':
      return t('docsPicker.kindIfc', 'IFC', { ns: 'editor' })
    case 'nwc':
      return t('docsPicker.kindNwc', 'Navisworks', { ns: 'editor' })
    case 'other':
      return t('docsPicker.kindFile', 'File', { ns: 'editor' })
  }
}

function FileIcon({ kind }: { kind: DocsFileKind }) {
  if (kind === 'rvt') return <FileBox className="text-primary" aria-hidden />
  if (kind === 'ifc') return <Box className="text-primary" aria-hidden />
  return <FileX className="text-muted-foreground" aria-hidden />
}

const stripExtension = (name: string) => name.replace(/\.[a-z0-9]+$/i, '')

export function DocsPickerDialog({ projectId, open, onOpenChange, revitModelName, onQueued, disciplineSet }: Props) {
  const t = useEditorTranslate()
  const linked = useEditorHost().data.linkedModels
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [current, setCurrent] = useState<string | null>(null)
  const [queryText, setQueryText] = useState('')
  const [search, setSearch] = useState<{ query: string; scope: string | null; result: Loaded } | null>(null)
  const [picked, setPicked] = useState<ReadonlyMap<string, Picked>>(new Map())
  const [contributor, setContributor] = useState({ organization: '', contact: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (folderId: string | null) => {
      const key = folderId ?? ROOT
      setLoaded((prev) => ({ ...prev, [key]: { status: 'loading' } }))
      try {
        const data = await browseDocsFrom(linked, projectId, { folderId })
        setLoaded((prev) => ({ ...prev, [key]: { status: 'loaded', data } }))
        setNames((prev) => ({ ...prev, ...Object.fromEntries(data.folders.map((f) => [f.id, f.name])) }))
        return data
      } catch (err) {
        console.error('[DocsPickerDialog] browsing Autodesk Docs failed', { folderId, err })
        setLoaded((prev) => ({ ...prev, [key]: { status: 'error', message: err instanceof Error ? err.message : t('docsPicker.couldNotOpen', "Couldn't open Autodesk Docs.", { ns: 'editor' }) } }))
        return null
      }
    },
    [linked, projectId, t],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void load(null).then((root) => {
      if (cancelled || !root) return
      const start = root.folders.find((f) => /^project files$/i.test(f.name)) ?? root.folders[0]
      if (!start) return
      setCurrent(start.id)
      setExpanded(new Set([start.id]))
      void load(start.id)
    })
    return () => {
      cancelled = true
    }
  }, [open, load])

  function openFolder(folder: DocsFolderView) {
    setCurrent(folder.id)
    setSearch(null)
    setExpanded((prev) => new Set(prev).add(folder.id))
    if (!loaded[folder.id] || loaded[folder.id]?.status === 'error') void load(folder.id)
  }

  function toggleFolder(folder: DocsFolderView) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(folder.id)) next.delete(folder.id)
      else next.add(folder.id)
      return next
    })
    if (!loaded[folder.id]) void load(folder.id)
  }

  async function runSearch() {
    const query = queryText.trim()
    if (!query) {
      setSearch(null)
      return
    }
    const scope = current
    setSearch({ query, scope, result: { status: 'loading' } })
    try {
      const data = await browseDocsFrom(linked, projectId, { folderId: scope, query })
      setSearch((prev) => (prev && prev.query === query ? { query, scope, result: { status: 'loaded', data } } : prev))
    } catch (err) {
      console.error('[DocsPickerDialog] searching Autodesk Docs failed', { query, err })
      setSearch((prev) => (prev && prev.query === query ? { query, scope, result: { status: 'error', message: err instanceof Error ? err.message : t('docsPicker.searchFailed', 'The search failed.', { ns: 'editor' }) } } : prev))
    }
  }

  function togglePick(file: DocsFileView, on: boolean) {
    setPicked((prev) => {
      const next = new Map(prev)
      if (!on) next.delete(file.itemId)
      else if (next.size < MAX_PICK) next.set(file.itemId, { file, label: file.linked?.label ?? stripExtension(file.name), discipline: guessDiscipline(file.name), more: [] })
      return next
    })
  }

  function updatePick(itemId: string, patch: Partial<Pick<Picked, 'label' | 'discipline' | 'more'>>) {
    setPicked((prev) => {
      const entry = prev.get(itemId)
      if (!entry) return prev
      return new Map(prev).set(itemId, { ...entry, ...patch })
    })
  }

  async function add() {
    setError(null)
    setAdding(true)
    try {
      const company = { organization: contributor.organization.trim(), contact: contributor.contact.trim() }
      const items = [...picked.values()].map((p) => ({
        itemId: p.file.itemId,
        label: p.label.trim(),
        discipline: p.discipline,
        ...(p.more.length > 0 ? { disciplines: [p.discipline, ...p.more.filter((d) => d !== p.discipline)] } : {}),
        ...(company.organization || company.contact ? { contributor: company } : {}),
      }))
      const results = await addDocsItemsFrom(linked, projectId, items)
      const queued = results.filter((r) => r.outcome === 'queued').length
      const running = results.length - queued
      const coming =
        queued === 1
          ? t('docsPicker.oneComingIn', '1 model is coming in from Autodesk Docs. Each shows its progress under Linked models.', { ns: 'editor' })
          : t('docsPicker.manyComingIn', '{{count}} models are coming in from Autodesk Docs. Each shows its progress under Linked models.', { ns: 'editor', count: queued })
      const onTheWay =
        running === 0
          ? ''
          : running === 1
            ? t('docsPicker.oneAlreadyOnTheWay', '{{count}} was already on the way.', { ns: 'editor', count: running })
            : t('docsPicker.manyAlreadyOnTheWay', '{{count}} were already on the way.', { ns: 'editor', count: running })
      toast.success(onTheWay === '' ? coming : `${coming} ${onTheWay}`)
      onQueued()
      setPicked(new Map())
      onOpenChange(false)
    } catch (err) {
      console.error('[DocsPickerDialog] adding models failed', err)
      setError(err instanceof Error ? err.message : t('docsPicker.notAdded', "The models weren't added.", { ns: 'editor' }))
    } finally {
      setAdding(false)
    }
  }

  const shown: Loaded | undefined = search ? search.result : current ? loaded[current] : undefined
  const root = loaded[ROOT]
  const pickedList = useMemo(() => [...picked.values()], [picked])
  const badLabel = pickedList.some((p) => p.label.trim().length === 0)
  const addBlockedReason =
    pickedList.length === 0
      ? t('docsPicker.pickAtLeastOne', 'Pick at least one Revit or IFC file', { ns: 'editor' })
      : badLabel
        ? t('docsPicker.nameEveryModel', 'Give every model a name', { ns: 'editor' })
        : null

  function renderTree(folders: readonly DocsFolderView[], depth: number) {
    return folders.map((folder) => {
      const isOpen = expanded.has(folder.id)
      const children = loaded[folder.id]
      return (
        <div key={folder.id} className="flex flex-col">
          <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
            <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={isOpen ? t('docsPicker.collapse', 'Collapse {{name}}', { ns: 'editor', name: folder.name }) : t('docsPicker.expand', 'Expand {{name}}', { ns: 'editor', name: folder.name })} onClick={() => toggleFolder(folder)}>
              {isOpen ? <ChevronDown /> : <ChevronRight />}
            </Button>
            <Button
              variant={current === folder.id && !search ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 min-w-0 flex-1 justify-start px-1.5 font-normal"
              onClick={() => openFolder(folder)}
              data-testid="docs-folder"
            >
              {current === folder.id ? <FolderOpen data-icon="inline-start" /> : <Folder data-icon="inline-start" />}
              <span className="truncate">{folder.name}</span>
            </Button>
          </div>
          {isOpen && children?.status === 'loading' && (
            <span className="flex items-center gap-1 py-1 text-xs text-muted-foreground" style={{ paddingLeft: depth * 12 + 30 }}>
              <Spinner className="size-3" /> {t('docsPicker.opening', 'Opening…', { ns: 'editor' })}
            </span>
          )}
          {isOpen && children?.status === 'error' && (
            <span className="py-1 text-xs text-destructive" style={{ paddingLeft: depth * 12 + 30 }}>
              {children.message}
            </span>
          )}
          {isOpen && children?.status === 'loaded' && renderTree(children.data.folders, depth + 1)}
        </div>
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !adding && onOpenChange(next)}>
      <DialogContent className="sm:max-w-4xl" data-testid="docs-picker-dialog">
        <DialogHeader>
          <DialogTitle>{t('docsPicker.title', 'Add models from Autodesk Docs', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {t('docsPicker.description', "Pick Revit or IFC files in {{project}}, such as the architect's model. Each comes in as its own linked model. Revit files are opened read-only; nothing in Docs or Revit changes.", {
              ns: 'editor',
              project: revitModelName
                ? t('docsPicker.projectOfModel', 'the Autodesk Docs project of {{name}}', { ns: 'editor', name: revitModelName })
                : t('docsPicker.thisProject', "this project's Autodesk Docs project", { ns: 'editor' }),
            })}
          </DialogDescription>
        </DialogHeader>

        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={current && names[current] ? t('docsPicker.searchIn', 'Search in {{folder}}', { ns: 'editor', folder: names[current] }) : t('docsPicker.searchAllFolders', 'Search all folders', { ns: 'editor' })}
            aria-label={t('docsPicker.searchByFileName', 'Search Autodesk Docs by file name', { ns: 'editor' })}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void runSearch()
              }
            }}
            maxLength={100}
          />
          <InputGroupAddon align="inline-end">
            {search ? (
              <InputGroupButton
                aria-label={t('docsPicker.clearTheSearch', 'Clear the search', { ns: 'editor' })}
                onClick={() => {
                  setSearch(null)
                  setQueryText('')
                }}
              >
                <X />
              </InputGroupButton>
            ) : (
              <InputGroupButton onClick={() => void runSearch()} disabled={!queryText.trim()}>
                {t('docsPicker.search', 'Search', { ns: 'editor' })}
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>

        <div className="grid min-h-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ScrollArea className="h-72 rounded-md border p-1" aria-label={t('docsPicker.folders', 'Folders', { ns: 'editor' })}>
            {(!root || root.status === 'loading') && (
              <span className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                <Spinner className="size-3" /> {t('docsPicker.openingDocs', 'Opening Autodesk Docs…', { ns: 'editor' })}
              </span>
            )}
            {root?.status === 'error' && (
              <Alert variant="destructive" className="m-1">
                <AlertDescription className="text-xs">
                  {root.message}{' '}
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void load(null)}>
                    {t('docsPicker.tryAgain', 'Try again', { ns: 'editor' })}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {root?.status === 'loaded' && root.data.folders.length === 0 && <span className="block p-2 text-xs text-muted-foreground">{t('docsPicker.noFolders', 'No folders you can open.', { ns: 'editor' })}</span>}
            {root?.status === 'loaded' && renderTree(root.data.folders, 0)}
          </ScrollArea>

          <ScrollArea className="h-72 rounded-md border p-1" aria-label={t('docsPicker.files', 'Files', { ns: 'editor' })}>
            {search && (
              <span className="block px-2 pb-1 text-xs text-muted-foreground">
                {t('docsPicker.filesNamedLike', 'Files named like “{{query}}” {{where}}', {
                  ns: 'editor',
                  query: search.query,
                  where:
                    search.scope && names[search.scope]
                      ? t('docsPicker.inFolderAndBelow', 'in {{folder}} and below', { ns: 'editor', folder: names[search.scope] })
                      : t('docsPicker.inEveryFolder', 'in every folder', { ns: 'editor' }),
                })}
              </span>
            )}
            {!shown && <span className="block p-2 text-xs text-muted-foreground">{t('docsPicker.openAFolder', 'Open a folder to see its Revit and IFC files.', { ns: 'editor' })}</span>}
            {shown?.status === 'loading' && (
              <span className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                <Spinner className="size-3" /> {search ? t('docsPicker.searching', 'Searching…', { ns: 'editor' }) : t('docsPicker.openingTheFolder', 'Opening the folder…', { ns: 'editor' })}
              </span>
            )}
            {shown?.status === 'error' && (
              <Alert variant="destructive" className="m-1">
                <AlertDescription className="text-xs">{shown.message}</AlertDescription>
              </Alert>
            )}
            {shown?.status === 'loaded' && shown.data.files.length === 0 && (
              <Empty className="py-6">
                <EmptyHeader>
                  <EmptyTitle className="text-sm">
                    {search ? t('docsPicker.noFilesMatch', 'No Revit or IFC files match', { ns: 'editor' }) : t('docsPicker.noFilesHere', 'No Revit or IFC files here', { ns: 'editor' })}
                  </EmptyTitle>
                  <EmptyDescription className="text-xs">
                    {search
                      ? t('docsPicker.tryPartOfTheName', 'Try part of the file name, or search a higher folder.', { ns: 'editor' })
                      : t('docsPicker.openASubfolder', 'Open a subfolder on the left, or search.', { ns: 'editor' })}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {shown?.status === 'loaded' && shown.data.files.length > 0 && (
              <ItemGroup className="gap-1">
                {shown.data.files.map((file) => {
                  const isPicked = picked.has(file.itemId)
                  const full = !isPicked && picked.size >= MAX_PICK
                  const disabledReason = file.blockedReason ?? (full ? t('docsPicker.upToAtATime', 'You can add up to {{count}} at a time.', { ns: 'editor', count: MAX_PICK }) : null)
                  return (
                    <Item key={file.itemId} size="xs" variant={isPicked ? 'muted' : 'default'} data-testid="docs-file" data-blocked={file.blockedReason ? 'true' : 'false'}>
                      <ItemMedia>
                        <Checkbox
                          checked={isPicked}
                          disabled={disabledReason !== null && !isPicked}
                          onCheckedChange={(checked) => togglePick(file, checked === true)}
                          aria-label={t('docsPicker.addFile', 'Add {{name}}', { ns: 'editor', name: file.name })}
                        />
                      </ItemMedia>
                      <ItemMedia variant="icon">
                        <FileIcon kind={file.kind} />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="text-xs">{file.name}</ItemTitle>
                        <ItemDescription className="text-xs">
                          {kindWord(file.kind, t)}
                          {file.versionNumber !== null ? t('docsPicker.versionNumber', ' · version {{version}}', { ns: 'editor', version: file.versionNumber }) : ''}
                          {file.bytes !== null ? ` · ${formatBytes(file.bytes)}` : ''}
                          {file.lastModified ? ` · ${new Date(file.lastModified).toLocaleDateString()}` : ''}
                          {disabledReason && !isPicked && <span className="block">{disabledReason}</span>}
                          {file.linked && (
                            <span className="block">
                              {t('docsPicker.alreadyLinkedAs', 'Already linked as {{label}}. Adding it again brings in its newest version.', { ns: 'editor', label: file.linked.label })}
                            </span>
                          )}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        {file.revitYear !== null && (
                          <Badge variant="outline" className="text-[10px]" data-testid="docs-file-revit-year">
                            {t('docsPicker.revitYear', 'Revit {{year}}', { ns: 'editor', year: file.revitYear })}
                          </Badge>
                        )}
                        {file.isCloudModel && (
                          <Badge variant="outline" className="text-[10px]">
                            <Cloud data-icon="inline-start" />
                            {t('docsPicker.cloudModel', 'Cloud model', { ns: 'editor' })}
                          </Badge>
                        )}
                        {file.linked && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t('docsPicker.linked', 'Linked', { ns: 'editor' })}
                          </Badge>
                        )}
                      </ItemActions>
                    </Item>
                  )
                })}
              </ItemGroup>
            )}
          </ScrollArea>
        </div>

        {pickedList.length > 0 && (
          <div className="flex flex-col gap-2" data-testid="docs-picked">
            <span className="text-sm font-medium">
              {t('docsPicker.pickedSummary', '{{count}} picked · name each one and say what it shows', { ns: 'editor', count: pickedList.length })}
            </span>
            <ScrollArea className="max-h-40">
              <div className="flex flex-col gap-2 pr-2">
                {pickedList.map((p) => (
                  <div key={p.file.itemId} className="grid grid-cols-[minmax(0,1fr)_10rem_auto] items-end gap-2">
                    <Field>
                      <FieldLabel htmlFor={`docs-label-${p.file.itemId}`} className="truncate text-xs">
                        {p.file.name}
                      </FieldLabel>
                      <Input
                        id={`docs-label-${p.file.itemId}`}
                        value={p.label}
                        maxLength={200}
                        aria-invalid={p.label.trim().length === 0 ? true : undefined}
                        disabled={p.file.linked !== null}
                        title={p.file.linked ? t('docsPicker.linkedKeepsName', 'Already linked: the new version keeps its name', { ns: 'editor' }) : undefined}
                        onChange={(e) => updatePick(p.file.itemId, { label: e.target.value })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`docs-discipline-${p.file.itemId}`} className="text-xs">
                        {t('docsPicker.shows', 'Shows', { ns: 'editor' })}
                      </FieldLabel>
                      <Select
                        value={p.discipline}
                        disabled={p.file.linked !== null}
                        onValueChange={(v) => isLinkedDiscipline(v) && updatePick(p.file.itemId, { discipline: v, more: p.more.filter((d) => d !== v) })}
                      >
                        <SelectTrigger id={`docs-discipline-${p.file.itemId}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <LinkedDisciplineSelectItems set={disciplineSet} current={p.discipline} />
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button variant="ghost" size="icon" aria-label={t('docsPicker.dontAdd', "Don't add {{name}}", { ns: 'editor', name: p.file.name })} onClick={() => togglePick(p.file, false)}>
                      <X />
                    </Button>
                    {p.file.linked === null && <AlsoShows pick={p} set={disciplineSet} onChange={(more) => updatePick(p.file.itemId, { more })} />}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <LinkedContributorFields id="docs-contributor" organization={contributor.organization} contact={contributor.contact} onChange={setContributor} disabled={adding} />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adding}>
            {t('docsPicker.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button onClick={() => void add()} disabled={adding || addBlockedReason !== null} title={addBlockedReason ?? undefined} data-testid="docs-add">
            {adding && <Spinner data-icon="inline-start" />}
            {addBlockedReason ??
              (pickedList.length === 1
                ? t('docsPicker.addOne', 'Add {{count}} model', { ns: 'editor', count: pickedList.length })
                : t('docsPicker.addMany', 'Add {{count}} models', { ns: 'editor', count: pickedList.length }))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The other disciplines one picked file shows, as chips with Remove, and a picker to add one. */
function AlsoShows({ pick, set, onChange }: { readonly pick: Picked; readonly set?: PackSet; readonly onChange: (more: readonly LinkedDiscipline[]) => void }) {
  const t = useEditorTranslate()
  const left = linkedDisciplineChoices(set).filter((c) => c.value !== pick.discipline && !pick.more.includes(c.value))
  const blocked =
    pick.more.length + 1 >= MAX_LINKED_DISCIPLINES
      ? t('docsPicker.upToDisciplines', 'Up to {{count}} disciplines per model.', { ns: 'editor', count: MAX_LINKED_DISCIPLINES })
      : left.length === 0
        ? t('docsPicker.everyDisciplinePicked', 'Every discipline is already picked.', { ns: 'editor' })
        : null
  return (
    <div className="col-span-3 flex flex-wrap items-center gap-1.5" data-testid={`docs-also-${pick.file.itemId}`}>
      {pick.more.map((d) => {
        const label = linkedDisciplineLabel(d, set)
        return (
          <Badge key={d} variant="secondary" className="gap-1 pr-0.5">
            {label}
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t('docsPicker.removeDiscipline', 'Remove {{label}} from {{name}}', { ns: 'editor', label, name: pick.file.name })} onClick={() => onChange(pick.more.filter((x) => x !== d))}>
              <X />
            </Button>
          </Badge>
        )
      })}
      <Select value="" onValueChange={(v) => isLinkedDiscipline(v) && onChange([...pick.more, v])} disabled={blocked !== null}>
        <SelectTrigger size="sm" className="h-7 w-auto text-xs" aria-label={t('docsPicker.alsoShowsFor', 'Also shows, for {{name}}', { ns: 'editor', name: pick.file.name })} title={blocked ?? undefined}>
          <SelectValue placeholder={blocked ?? t('docsPicker.alsoShows', 'Also shows…', { ns: 'editor' })} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {left.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
