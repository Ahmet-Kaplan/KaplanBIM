'use client'

import { useCallback, useEffect, useState } from 'react'
import { PackageOpen } from 'lucide-react'
import type { PackSummary } from '@permitzip/bim-pack'
import { Badge } from '../../ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { SettingsCard, SettingsLoadError, SettingsLoading } from '../../ui/settings-page'
import { addonContents } from '../contributions/registry'
import { PREVIEW_NOTE } from '../settings/AddonsPreviewNote'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

/** The catalogue plus which add-ons are Preview (results not yet for issued drawings). */
export interface PackCatalogue {
  readonly rows: readonly PackSummary[]
  readonly previewIds: ReadonlySet<string>
}

type LoadState = { readonly kind: 'loading' } | ({ readonly kind: 'ready' } & PackCatalogue) | { readonly kind: 'error'; readonly message: string }

/** "Services (3), Network adapters (1)": what a pack adds, in words. */
function addsInWords(row: PackSummary, t: Translate = englishOnly): string {
  if (row.missing) return t('library.notOnThisServer', 'Not on this server', { ns: 'editor' })
  const engine = row.contributes.map((c) => `${c.label} (${c.count})`)
  const screens = addonContents(row.id)
  const parts = screens.length > 0 ? [...engine, t('library.screens', 'Screens: {{names}}', { ns: 'editor', names: screens.join(', ') })] : engine
  return parts.length === 0 ? '—' : parts.join(', ')
}

/** The pack catalogue (first-party trades and this server's add-ons), loaded on its own so the rest of the page never waits for it. */
function loadPackCatalogue(): Promise<PackCatalogue> {
  return Promise.all([import('@permitzip/bim-pack'), import('../../contracts/building-model/installed-packs')]).then(([pack, host]) => ({ rows: pack.describePacks(host.installedPacks()), previewIds: host.PREVIEW_PACK_IDS }))
}

/**
 * Settings › MutinyBIM library › Add-ons: the packs this server can open
 * models with. Read-only. The first-party trades are listed as built in;
 * installed add-ons carry a Preview badge until their results are for issued
 * drawings, and each model switches them on in Building Model › Manage ›
 * Model settings › Add-ons.
 */
export function PacksSection({ loadCatalogue = loadPackCatalogue }: { readonly loadCatalogue?: () => Promise<PackCatalogue> }) {
  const t = useEditorTranslate()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const fetchRows = useCallback(() => {
    loadCatalogue()
      .then((catalogue) => setState({ kind: 'ready', ...catalogue }))
      .catch((err: unknown) => {
        console.error('[PacksSection] the add-on list failed to load', err)
        setState({ kind: 'error', message: t('library.addonsCouldntBeRead', "The add-on list couldn't be read ({{error}}). Models still open with the built-in trades.", { ns: 'editor', error: err instanceof Error ? err.message : t('library.unknownError', 'unknown error', { ns: 'editor' }) }) })
      })
  }, [loadCatalogue, t])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const retry = () => {
    setState({ kind: 'loading' })
    fetchRows()
  }

  if (state.kind === 'loading') return <SettingsLoading rows={3} label={t('library.loadingAddons', 'Loading add-ons', { ns: 'editor' })} />
  if (state.kind === 'error') return <SettingsLoadError title={t('library.addonsDidntLoad', "Add-ons didn't load", { ns: 'editor' })} message={state.message} onRetry={retry} />

  const others = state.rows.filter((r) => !r.firstParty)
  return (
    <SettingsCard id="add-ons" title={t('panel.addOns', 'Add-ons', { ns: 'editor' })} description={t('library.addonsDescription', 'The trades and add-ons models on this server can use. Built-in trades come with MutinyBIM; other add-ons are installed per server and switched on per model in Building Model › Manage › Model settings › Add-ons.', { ns: 'editor' })}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('library.columnAddon', 'Add-on', { ns: 'editor' })}</TableHead>
            <TableHead>{t('library.columnVersion', 'Version', { ns: 'editor' })}</TableHead>
            <TableHead>{t('library.columnAdds', 'What it adds', { ns: 'editor' })}</TableHead>
            <TableHead>{t('library.columnStatus', 'Status', { ns: 'editor' })}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.rows.map((row) => (
            <TableRow key={`${row.id}@${row.version}`}>
              <TableCell>
                <div className="font-medium">{row.name}</div>
                {row.description ? <div className="text-muted-foreground text-xs">{row.description}</div> : null}
              </TableCell>
              <TableCell className="tabular-nums">{row.version}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{addsInWords(row, t)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  {row.firstParty ? (
                    <Badge variant="secondary">{t('library.builtIn', 'Built in', { ns: 'editor' })}</Badge>
                  ) : row.missing ? (
                    <Badge variant="destructive">{t('library.notInstalled', 'Not installed', { ns: 'editor' })}</Badge>
                  ) : (
                    <Badge variant="outline">{t('library.installed', 'Installed', { ns: 'editor' })}</Badge>
                  )}
                  {!row.firstParty && !row.missing && state.previewIds.has(row.id) ? <Badge variant="outline">{t('library.preview', 'Preview', { ns: 'editor' })}</Badge> : null}
                </div>
                {!row.firstParty && !row.missing && state.previewIds.has(row.id) ? <div className="text-warning-700 text-xs">{PREVIEW_NOTE}</div> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {others.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageOpen />
            </EmptyMedia>
            <EmptyTitle>{t('library.noOtherAddons', 'No other add-ons yet', { ns: 'editor' })}</EmptyTitle>
            <EmptyDescription>{t('library.noOtherAddonsHint', 'Only the built-in trades are installed on this server. Structural and Civil add-ons will appear here once they are installed.', { ns: 'editor' })}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
    </SettingsCard>
  )
}
