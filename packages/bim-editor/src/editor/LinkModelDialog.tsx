'use client'

import { useRef, useState } from 'react'
import { HostLink as Link } from '@permitzip/bim-editor/host'
import { toast } from 'sonner'
import { Building2, FileUp } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { Progress } from '../ui/progress'
import { Spinner } from '../ui/spinner'
import type { PackSet } from '@permitzip/bim-kernel/packs'
import { LinkedContributorFields, LinkedDisciplinesField } from './linked-display/LinkedDisciplinesField'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import {
  exportStatusLabel,
  formatBytes,
  isInProgress,
  uploadProblem,
  type AutodeskExportView,
  type LinkedDiscipline,
} from '../contracts/building-model/linked-contract'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { useEditorTranslate } from './i18n/translate'
import { completeUploadFrom, putFileFrom, startAutodeskExportFrom, startUploadFrom, UploadCancelled, type UploadHandle } from './linked-api'

interface Props {
  projectId: string
  open: boolean
  onOpenChange(open: boolean): void
  /** The project's connected Revit model; null when none is connected. */
  revitModel: { name: string } | null
  autodeskExport: AutodeskExportView | null
  /** Set when uploading a new version of an existing linked model. */
  replacing: { id: string; label: string } | null
  /** Called after something was queued, so the panel refreshes now instead of at the next poll. */
  onQueued(): void
  /** Opens "Add from Autodesk Docs" for a model that isn't linked in our Revit file; null when it can't be used. */
  onOpenDocsPicker: (() => void) | null
  /** The open model's discipline registry (its add-ons and firm rows); built-in and first-party when absent. */
  disciplineSet?: PackSet
}

export function LinkModelDialog({ projectId, open, onOpenChange, revitModel, autodeskExport, replacing, onQueued, onOpenDocsPicker, disciplineSet }: Props) {
  const t = useEditorTranslate()
  const linked = useEditorHost().data.linkedModels
  const [tab, setTab] = useState<'autodesk' | 'upload'>(replacing ? 'upload' : revitModel ? 'autodesk' : 'upload')
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [suppliedByName, setSuppliedByName] = useState('')
  const [disciplines, setDisciplines] = useState<readonly LinkedDiscipline[]>(['architecture'])
  const [contributor, setContributor] = useState({ organization: '', contact: '' })
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const uploadRef = useRef<UploadHandle | null>(null)


  const problem = file ? uploadProblem(file) : null
  const uploading = progress !== null
  const exportRunning = autodeskExport !== null && isInProgress(autodeskExport.status)

  function close(next: boolean) {
    if (!next && uploadRef.current) {
      uploadRef.current.cancel()
      return
    }
    onOpenChange(next)
  }

  async function upload() {
    if (!file || problem) return
    setError(null)
    setProgress(0)
    try {
      const started = await startUploadFrom(linked, projectId, {
        fileName: file.name,
        bytes: file.size,
        label: replacing?.label ?? (label.trim() || file.name.replace(/\.ifc$/i, '')),
        discipline: disciplines[0] ?? 'architecture',
        ...(replacing ? {} : { disciplines, contributor: { organization: contributor.organization.trim(), contact: contributor.contact.trim() } }),
        suppliedByName: suppliedByName.trim() || undefined,
        referenceId: replacing?.id,
      })
      const handle = await putFileFrom(linked, started.sourcePath, file, setProgress)
      uploadRef.current = handle
      await handle.done
      uploadRef.current = null
      await completeUploadFrom(linked, projectId, started.versionId)
      toast.success(t('linkModel.uploadDone', '{{name}} uploaded. Converting it for the 3D view…', { ns: 'editor', name: file.name }))
      onQueued()
      onOpenChange(false)
    } catch (err) {
      uploadRef.current = null
      if (err instanceof UploadCancelled) {
        toast(t('linkModel.uploadCancelled', 'Upload cancelled.', { ns: 'editor' }))
        setProgress(null)
        return
      }
      console.error('[LinkModelDialog] upload failed', err)
      setError(err instanceof Error ? err.message : t('linkModel.uploadFailed', 'The upload failed.', { ns: 'editor' }))
      setProgress(null)
    }
  }

  async function exportFromRevit() {
    setError(null)
    setExporting(true)
    try {
      await startAutodeskExportFrom(linked, projectId)
      toast.success(t('linkModel.exportStarted', 'Exporting from Revit. The models appear here when it finishes (usually 2–5 minutes).', { ns: 'editor' }))
      onQueued()
      onOpenChange(false)
    } catch (err) {
      console.error('[LinkModelDialog] Autodesk export failed to start', err)
      setError(err instanceof Error ? err.message : t('linkModel.exportDidNotStart', "The export from Revit didn't start.", { ns: 'editor' }))
    } finally {
      setExporting(false)
    }
  }

  const uploadBlockedReason = !file ? t('linkModel.chooseFile', 'Choose an IFC file first', { ns: 'editor' }) : problem
  const exportBlockedReason = exportRunning ? t('linkModel.exportAlreadyRunning', 'An export from Revit is already running', { ns: 'editor' }) : null

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg" data-testid="link-model-dialog">
        <DialogHeader>
          <DialogTitle>{replacing ? t('linkModel.uploadNewVersionTitle', 'Upload a new version of {{label}}', { ns: 'editor', label: replacing.label }) : t('linkModel.title', 'Link a model', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {replacing
              ? t('linkModel.replaceDescription', 'The new file becomes the current version. Earlier versions stay listed, and you can switch back.', { ns: 'editor' })
              : t('linkModel.linkDescription', "Linked models are shown read-only next to the new ductwork, so you can design around the architect's building.", { ns: 'editor' })}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => (v === 'autodesk' || v === 'upload') && setTab(v)}>
          {!replacing && (
            <TabsList className="w-full">
              <TabsTrigger value="autodesk" disabled={uploading}>
                <Building2 data-icon="inline-start" />
                {t('linkModel.tabAutodesk', 'From linked models in our Revit file', { ns: 'editor' })}
              </TabsTrigger>
              <TabsTrigger value="upload" disabled={uploading}>
                <FileUp data-icon="inline-start" />
                {t('linkModel.tabUpload', 'Upload an IFC file', { ns: 'editor' })}
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="autodesk" className="pt-2">
            {revitModel ? (
              <div className="flex flex-col gap-3 text-sm">
                <p>
                  {t(
                    'linkModel.autodeskBody',
                    "This opens {{name}} in Autodesk read-only and adds it here, along with every model it links (the architect's, structure, and so on) at the position it's linked at in Revit. Nothing in Revit changes.",
                    { ns: 'editor', name: revitModel.name },
                  )}
                </p>
                <p className="text-muted-foreground">{t('linkModel.autodeskTime', 'Usually 2–5 minutes. You can close this and keep working; it finishes on its own.', { ns: 'editor' })}</p>
                {onOpenDocsPicker && (
                  <p className="text-muted-foreground">
                    {t('linkModel.docsQuestion', "Architect's model uploaded to Docs but not linked in ours?", { ns: 'editor' })}{' '}
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={onOpenDocsPicker} data-testid="link-dialog-open-docs">
                      {t('linkModel.addFromDocs', 'Add it from Autodesk Docs…', { ns: 'editor' })}
                    </Button>
                  </p>
                )}
                {autodeskExport && (
                  <Alert variant={autodeskExport.status === 'failed' ? 'destructive' : 'default'}>
                    {exportRunning && <Spinner />}
                    <AlertTitle>{autodeskExport.status === 'failed' ? t('linkModel.lastExportFailed', 'The last export failed', { ns: 'editor' }) : t('linkModel.exportFromRevit', 'Export from Revit', { ns: 'editor' })}</AlertTitle>
                    <AlertDescription>{exportStatusLabel(autodeskExport)}</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Building2 />
                  </EmptyMedia>
                  <EmptyTitle>{t('linkModel.noRevitModel', 'No Revit model is connected to this project', { ns: 'editor' })}</EmptyTitle>
                  <EmptyDescription>{t('linkModel.connectFirst', "Connect the project's Revit model in Autodesk Docs first, or upload an IFC file instead.", { ns: 'editor' })}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/projects/${projectId}?tab=integrations`}>{t('linkModel.connectRevitModel', 'Connect a Revit model', { ns: 'editor' })}</Link>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </TabsContent>

          <TabsContent value="upload" className="pt-2">
            <FieldGroup>
              <Field data-invalid={problem ? true : undefined}>
                <FieldLabel htmlFor="link-model-file">{t('linkModel.ifcFile', 'IFC file', { ns: 'editor' })}</FieldLabel>
                <Input
                  id="link-model-file"
                  type="file"
                  accept=".ifc"
                  disabled={uploading}
                  aria-invalid={problem ? true : undefined}
                  onChange={(e) => {
                    const chosen = e.target.files?.[0] ?? null
                    setFile(chosen)
                    setError(null)
                    if (chosen && !label) setLabel(chosen.name.replace(/\.ifc$/i, ''))
                  }}
                />
                {problem ? (
                  <FieldError>{problem}</FieldError>
                ) : (
                  <FieldDescription>
                    {file ? `${formatBytes(file.size)}` : t('linkModel.sizeLimit', 'Up to 150 MB for now. If the file has location data, the model is placed from it; otherwise you can line it up after.', { ns: 'editor' })}
                  </FieldDescription>
                )}
              </Field>
              {!replacing && (
                <>
                  <Field>
                    <FieldLabel htmlFor="link-model-label">{t('linkModel.nameInModel', 'Name in the model', { ns: 'editor' })}</FieldLabel>
                    <Input id="link-model-label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={uploading} maxLength={200} placeholder={t('linkModel.namePlaceholder', "e.g. Architect's model, July 15", { ns: 'editor' })} />
                  </Field>
                  <LinkedDisciplinesField id="link-model-discipline" value={disciplines} onChange={setDisciplines} set={disciplineSet} disabled={uploading} />
                  <LinkedContributorFields id="link-model-contributor" organization={contributor.organization} contact={contributor.contact} onChange={setContributor} disabled={uploading} />
                </>
              )}
              <Field>
                <FieldLabel htmlFor="link-model-supplier">{t('linkModel.whoSentIt', 'Who sent it (optional)', { ns: 'editor' })}</FieldLabel>
                <Input
                  id="link-model-supplier"
                  value={suppliedByName}
                  onChange={(e) => setSuppliedByName(e.target.value)}
                  disabled={uploading}
                  maxLength={200}
                  placeholder={t('linkModel.whoSentPlaceholder', 'e.g. Acme Architects, by email', { ns: 'editor' })}
                />
                <FieldDescription>{t('linkModel.keptWithVersion', 'Kept with this version so anyone can see where the file came from.', { ns: 'editor' })}</FieldDescription>
              </Field>
              {uploading && (
                <Field>
                  <FieldLabel>{t('linkModel.uploadingPercent', 'Uploading… {{percent}}%', { ns: 'editor', percent: Math.round((progress ?? 0) * 100) })}</FieldLabel>
                  <Progress value={(progress ?? 0) * 100} aria-label={t('linkModel.uploadProgress', 'Upload progress', { ns: 'editor' })} />
                </Field>
              )}
            </FieldGroup>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t('linkModel.failedTitle', "That didn't work", { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {uploading ? t('linkModel.cancelUpload', 'Cancel upload', { ns: 'editor' }) : t('linkModel.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          {tab === 'autodesk' && revitModel ? (
            <Button onClick={() => void exportFromRevit()} disabled={exporting || exportBlockedReason !== null} title={exportBlockedReason ?? undefined}>
              {exporting && <Spinner data-icon="inline-start" />}
              {exportBlockedReason ?? t('linkModel.bringInLinked', 'Bring in its linked models', { ns: 'editor' })}
            </Button>
          ) : tab === 'upload' ? (
            <Button onClick={() => void upload()} disabled={uploading || uploadBlockedReason !== null} title={uploadBlockedReason ?? undefined}>
              {uploading && <Spinner data-icon="inline-start" />}
              {uploading ? t('linkModel.uploading', 'Uploading…', { ns: 'editor' }) : t('linkModel.uploadAndLink', 'Upload and link', { ns: 'editor' })}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
