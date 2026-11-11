'use client'

import { useState, type ReactNode } from 'react'
import { HistoryIcon, RotateCwIcon, SaveIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { FieldError } from '../../ui/field'
import { Input } from '../../ui/input'
import { ItemGroup } from '../../ui/item'
import { Spinner } from '../../ui/spinner'
import type { VersionEntry } from '../../contracts/building-model/branch-versions'
import { VersionRow } from './VersionRow'
import type { VersionsState } from './useVersions'
import { useEditorTranslate } from '../i18n/translate'

export interface VersionsListProps {
  readonly state: VersionsState
  readonly onRetry: () => void
  /** Null when the person can save versions and start branches; otherwise why not (shown, controls disabled). */
  readonly cantEditReason: string | null
  readonly onNewBranchFrom: (entry: VersionEntry) => void
  /** Names the model as it is now; throws an Error with words to show. */
  readonly onSaveVersion: (name: string) => Promise<void>
  /** Lane O's slot on each row. */
  readonly renderExtra?: (entry: VersionEntry) => ReactNode
}

/** Building Model › Manage › Versions: the versions you can start a branch from. */
export function VersionsList({ state, onRetry, cantEditReason, onNewBranchFrom, onSaveVersion, renderExtra }: VersionsListProps) {
  const t = useEditorTranslate()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function save() {
    const trimmed = name.trim()
    if (!trimmed || cantEditReason) return
    setSaving(true)
    setSaveError(null)
    setSaved(null)
    try {
      await onSaveVersion(trimmed)
      setName('')
      setSaved(`Saved “${trimmed}”.`)
    } catch (err) {
      console.error('[VersionsList] saving the version failed', err)
      setSaveError(err instanceof Error ? err.message : t('versions.saveFailed', 'Couldn\'t save the version. Try again.', { ns: 'editor' }))
    } finally {
      setSaving(false)
    }
  }

  const saveBlocked = cantEditReason ?? (name.trim().length === 0 ? t('versions.nameFirst', 'Name the version first.', { ns: 'editor' }) : null)

  return (
    <section aria-label={t('panel.versions', 'Versions', { ns: 'editor' })} className="flex flex-col gap-3">
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="flex flex-1 flex-col gap-1">
          <Input aria-label={t('versions.versionName', 'Version name', { ns: 'editor' })} placeholder={t('versions.namePlaceholder', 'Name this version (e.g. Before VE)', { ns: 'editor' })} value={name} maxLength={80} disabled={cantEditReason !== null} onChange={(e) => setName(e.target.value)} />
          {cantEditReason ? <p className="text-xs text-muted-foreground">{cantEditReason}</p> : null}
          {saveError ? <FieldError>{saveError}</FieldError> : null}
          {saved ? (
            <p role="status" className="text-xs text-muted-foreground">
              {saved}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="sm" disabled={saveBlocked !== null || saving} title={saveBlocked ?? undefined}>
          {saving ? <Spinner aria-hidden /> : <SaveIcon aria-hidden />}
          Save version
        </Button>
      </form>

      {state.status === 'loading' ? (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden /> {t('versions.loading', 'Loading versions…', { ns: 'editor' })}
        </div>
      ) : null}

      {state.status === 'error' ? (
        <Alert variant="destructive">
          <AlertTitle>{t('versions.loadFailed', 'Couldn\'t load versions', { ns: 'editor' })}</AlertTitle>
          <AlertDescription>
            {state.message}
            <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
              <RotateCwIcon aria-hidden /> {t('versions.retry', 'Retry', { ns: 'editor' })}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {state.status === 'ready' ? (
        <>
          {state.issuedError ? (
            <Alert>
              <AlertTitle>{t('versions.issuedSetsNotListed', 'Issued sets aren\'t listed', { ns: 'editor' })}</AlertTitle>
              <AlertDescription>{state.issuedError}</AlertDescription>
            </Alert>
          ) : null}
          {state.entries.length <= 1 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HistoryIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>{t('versions.noVersions', 'No saved versions yet', { ns: 'editor' })}</EmptyTitle>
                <EmptyDescription>{t('versions.noVersionsWhy', 'Save a version to come back to it or start a branch from it. Issued drawing sets appear here too.', { ns: 'editor' })}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          <ItemGroup className="gap-2">
            {state.entries.map((entry) => (
              <VersionRow key={entry.key} entry={entry} {...(cantEditReason ? { cantStartReason: cantEditReason } : { onNewBranch: onNewBranchFrom })} {...(renderExtra ? { renderExtra } : {})} />
            ))}
          </ItemGroup>
        </>
      ) : null}
    </section>
  )
}
