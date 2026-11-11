'use client'

import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { convertParametersExport, type ConvertResult, type RevitParametersExport } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { SettingsCard } from '../../ui/settings-page'
import { ConnectorReport } from '../part-editor/ConnectorReport'
import type { EditorDataHost } from '@permitzip/bim-editor-host'
import { unavailableWords } from '@permitzip/bim-editor/host/unavailable'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

type Converted = Extract<ConvertResult, { ok: true }>
type Failed = Extract<ConvertResult, { ok: false }>
type SaveState = { readonly kind: 'idle' } | { readonly kind: 'saving' } | { readonly kind: 'saved' } | { readonly kind: 'error'; readonly message: string }

type ReadState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'reading'; readonly fileName: string }
  | { readonly kind: 'read'; readonly fileName: string; readonly converted: readonly Converted[]; readonly failed: readonly Failed[] }
  | { readonly kind: 'error'; readonly fileName: string; readonly message: string }

function isParametersExport(value: unknown): value is RevitParametersExport {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'schema') === 'string'
}

type LibraryPort = EditorDataHost['firmLibrary']

/** Save one imported part type to the firm library; null when saved, else the refusal in words. */
export async function saveImportedPartTypeFrom(port: LibraryPort, definition: Converted['definition'], t: Translate = englishOnly): Promise<string | null> {
  if (!port) return unavailableWords(t('library.savingToFirmLibrary', 'Saving to the firm library', { ns: 'editor' }))
  const res = await port.importPartType({ definition })
  if (res.ok) return null
  const body: unknown = await res.json().catch((err: unknown) => {
    console.error('[PartImportSection] error body unreadable', err)
    return null
  })
  const message = typeof body === 'object' && body !== null ? Reflect.get(body, 'error') : null
  return typeof message === 'string' ? message : `HTTP ${res.status}`
}

/**
 * Settings › MutinyBIM library › Import part types (round 9 J9): read a
 * Revit parameter export, show every type's connector report before it is
 * saved, and save each to the firm library. A type with bad connectors still
 * saves; the problems show as issues wherever it is placed.
 */
export function PartImportSectionFrom({ port, canSave, save: given }: { readonly port: LibraryPort; readonly canSave: boolean; readonly save?: (definition: Converted['definition']) => Promise<string | null> }) {
  const t = useEditorTranslate()
  const save = given ?? ((definition: Converted['definition']) => saveImportedPartTypeFrom(port, definition, t))
  const input = useRef<HTMLInputElement>(null)
  const [read, setRead] = useState<ReadState>({ kind: 'empty' })
  const [saves, setSaves] = useState<Readonly<Record<string, SaveState>>>({})

  const onFile = async (file: File) => {
    setRead({ kind: 'reading', fileName: file.name })
    setSaves({})
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isParametersExport(parsed)) throw new Error(t('library.notARevitExport', 'it is not a Revit parameter export (no "schema" field)', { ns: 'editor' }))
      const results = convertParametersExport(parsed, { origin: file.name })
      setRead({ kind: 'read', fileName: file.name, converted: results.filter((r): r is Converted => r.ok), failed: results.filter((r): r is Failed => !r.ok) })
    } catch (err) {
      console.error('[PartImportSection] the export could not be read', err)
      setRead({ kind: 'error', fileName: file.name, message: err instanceof Error ? err.message : t('library.fileCouldNotBeRead', 'the file could not be read', { ns: 'editor' }) })
    }
  }

  const saveOne = async (r: Converted) => {
    setSaves((s) => ({ ...s, [r.id]: { kind: 'saving' } }))
    try {
      const refused = await save(r.definition)
      setSaves((s) => ({ ...s, [r.id]: refused ? { kind: 'error', message: refused } : { kind: 'saved' } }))
    } catch (err) {
      console.error('[PartImportSection] save failed', err)
      setSaves((s) => ({ ...s, [r.id]: { kind: 'error', message: err instanceof Error ? err.message : t('library.saveFailed', 'the save failed', { ns: 'editor' }) } }))
    }
  }

  const choose = () => input.current?.click()
  const picker = (
    <Input
      ref={input}
      type="file"
      accept="application/json,.json"
      className="hidden"
      data-testid="part-import-file"
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) void onFile(file)
      }}
    />
  )

  return (
    <SettingsCard
      id="part-import"
      title={t('library.importTitle', 'Import part types', { ns: 'editor' })}
      description={t('library.importDescription', "Bring in part types from a Revit parameter export. Each type's connector report shows before you save it, so a bad connector is fixed once in the library instead of on every project.", { ns: 'editor' })}
      actions={
        <Button variant="outline" onClick={choose} disabled={read.kind === 'reading'} data-testid="part-import-choose">
          <FileUp data-icon="inline-start" />
          {read.kind === 'empty' ? t('library.chooseAnExport', 'Choose an export', { ns: 'editor' }) : t('library.chooseAnotherExport', 'Choose another export', { ns: 'editor' })}
        </Button>
      }
    >
      {picker}
      {read.kind === 'empty' ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileUp />
            </EmptyMedia>
            <EmptyTitle>{t('library.noExportRead', 'No export read yet', { ns: 'editor' })}</EmptyTitle>
            <EmptyDescription>{t('library.noExportReadHint', 'Choose the JSON file the Revit parameter export wrote. Nothing is saved until you save a type.', { ns: 'editor' })}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={choose}>{t('library.chooseAnExport', 'Choose an export', { ns: 'editor' })}</Button>
          </EmptyContent>
        </Empty>
      ) : null}
      {read.kind === 'reading' ? <p className="text-muted-foreground text-sm" aria-busy="true">{t('library.readingFile', 'Reading {{file}}…', { ns: 'editor', file: read.fileName })}</p> : null}
      {read.kind === 'error' ? (
        <Alert variant="destructive">
          <AlertTitle>{t('library.fileCouldntBeRead', "{{file}} couldn't be read", { ns: 'editor', file: read.fileName })}</AlertTitle>
          <AlertDescription>
            {t('library.nothingImported', 'Nothing was imported: {{error}}. Export the types again from Revit and choose that file.', { ns: 'editor', error: read.message })}
          </AlertDescription>
        </Alert>
      ) : null}
      {read.kind === 'read' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            {[
              read.converted.length === 1 ? t('library.summaryOneType', '{{file}}: 1 part type ready to review', { ns: 'editor', file: read.fileName }) : t('library.summaryTypes', '{{file}}: {{count}} part types ready to review', { ns: 'editor', file: read.fileName, count: read.converted.length }),
              read.failed.length === 0 ? '' : read.failed.length === 1 ? t('library.summaryOneFailed', ", 1 that can't be imported", { ns: 'editor' }) : t('library.summaryFailed', ", {{count}} that can't be imported", { ns: 'editor', count: read.failed.length }),
            ].join('')}
            {'.'}
          </p>
          {read.converted.length === 0 && read.failed.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{t('library.noPartTypes', 'No part types in this export', { ns: 'editor' })}</EmptyTitle>
                <EmptyDescription>{t('library.noPartTypesHint', 'The file has no family types to bring in. Check that the export included the families you want.', { ns: 'editor' })}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {read.converted.map((r) => {
            const s = saves[r.id] ?? { kind: 'idle' }
            return (
              <section key={r.id} className="flex flex-col gap-2 rounded-lg border p-3" aria-label={`${r.definition.familyName} ${r.definition.typeName}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    {r.definition.familyName} · {r.definition.typeName}
                  </div>
                  <div className="flex items-center gap-2">
                    {s.kind === 'saved' ? <Badge variant="secondary">{t('library.savedToFirm', 'Saved to the firm library', { ns: 'editor' })}</Badge> : null}
                    <Button
                      size="sm"
                      onClick={() => void saveOne(r)}
                      disabled={!canSave || s.kind === 'saving' || s.kind === 'saved'}
                      title={!canSave ? t('library.onlyLibraryEditors', 'Only people who can edit the firm library can save part types.', { ns: 'editor' }) : s.kind === 'saved' ? t('library.alreadySaved', 'Already saved', { ns: 'editor' }) : undefined}
                      data-testid={`part-import-save-${r.id}`}
                    >
                      {s.kind === 'saving' ? t('library.saving', 'Saving…', { ns: 'editor' }) : r.report.problems.length > 0 ? t('library.saveWithProblems', 'Save with these problems', { ns: 'editor' }) : t('library.saveToFirmLibrary', 'Save to firm library', { ns: 'editor' })}
                    </Button>
                  </div>
                </div>
                {!canSave ? <p className="text-muted-foreground text-xs">{t('library.onlyLibraryEditors', 'Only people who can edit the firm library can save part types.', { ns: 'editor' })}</p> : null}
                {s.kind === 'error' ? <p className="text-destructive text-sm">{t('library.notSaved', 'Not saved: {{error}}. Try again.', { ns: 'editor', error: s.message })}</p> : null}
                <ConnectorReport report={r.report} />
              </section>
            )
          })}
          {read.failed.length > 0 ? (
            <ItemGroup className="gap-1" aria-label={t('library.failedTypes', "Types that can't be imported", { ns: 'editor' })}>
              {read.failed.map((f, i) => (
                <Item key={`${f.family}-${f.typeName}-${i}`} variant="muted" size="sm">
                  <ItemContent>
                    <ItemTitle>
                      {f.family} · {f.typeName}
                    </ItemTitle>
                    <ItemDescription>{t('library.cantBeImported', "Can't be imported: {{reason}}", { ns: 'editor', reason: f.reason })}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          ) : null}
        </div>
      ) : null}
    </SettingsCard>
  )
}
