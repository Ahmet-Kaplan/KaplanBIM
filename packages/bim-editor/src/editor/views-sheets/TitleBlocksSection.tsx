'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { SettingsCard, SettingsLoadError, SettingsLoading } from '../../ui/settings-page'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { loadTitleBlocksFrom, makeDefaultTitleBlockFrom, type TitleBlockList } from './title-blocks-client'
import { useEditorTranslate } from '../i18n/translate'

type LoadState = { readonly kind: 'loading' } | { readonly kind: 'ready'; readonly list: TitleBlockList } | { readonly kind: 'error'; readonly message: string }

const inches = (mm: number) => Math.round(mm / 25.4)

/**
 * Library › Title blocks (round 15, SH15): every title block in the firm
 * library, its paper, and the firm default new sheets start with. A sheet
 * keeps the title block it was given, so changing the default never redraws
 * an issued sheet; Sheets › Title block switches one sheet.
 */
export function TitleBlocksSection({ load: loadOverride, makeDefault: makeDefaultOverride }: { readonly load?: () => Promise<TitleBlockList>; readonly makeDefault?: (id: string) => Promise<void> }) {
  const t = useEditorTranslate()
  const titleBlocks = useEditorHost().data.titleBlocks
  const load = useCallback(() => (loadOverride ? loadOverride() : loadTitleBlocksFrom(titleBlocks)), [loadOverride, titleBlocks])
  const makeDefault = (id: string) => (makeDefaultOverride ? makeDefaultOverride(id) : makeDefaultTitleBlockFrom(titleBlocks, id))
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [saving, setSaving] = useState<string | null>(null)

  const fetchList = useCallback(() => {
    load()
      .then((list) => setState({ kind: 'ready', list }))
      .catch((err: unknown) => {
        console.error('[TitleBlocksSection] the title blocks failed to load', err)

        setState({
          kind: 'error',
          message: t('titleBlock.readFailed', 'Title blocks couldn’t be read ({{reason}}).', {
            ns: 'editor',
            reason: err instanceof Error ? err.message : t('titleBlock.unknownError', 'unknown error', { ns: 'editor' }),
          }),
        })
      })
  }, [load, t])


  useEffect(() => {
    fetchList()
  }, [fetchList])


  if (state.kind === 'loading') return <SettingsLoading rows={3} label={t('titleBlock.loading', 'Loading title blocks', { ns: 'editor' })} />
  if (state.kind === 'error')
    return (
      <SettingsLoadError
        title={t('titleBlock.didNotLoad', 'Title blocks didn’t load', { ns: 'editor' })}
        message={state.message}

        onRetry={() => {
          setState({ kind: 'loading' })
          fetchList()
        }}
      />
    )

  const { choices, canWrite } = state.list

  const blocked = canWrite ? null : t('titleBlock.needPublishing', 'Making a title block the default needs MutinyBIM library publishing.', { ns: 'editor' })


  const choose = async (id: string, name: string) => {
    setSaving(id)
    try {
      await makeDefault(id)

      toast.success(t('titleBlock.nowDefault', '{{name}} is now the title block new sheets start with', { ns: 'editor', name }))

      fetchList()
    } catch (err) {
      console.error('[TitleBlocksSection] make default failed', err)

      toast.error(
        t('titleBlock.couldNotDefault', '{{name}} couldn’t be made the default: {{reason}}', {
          ns: 'editor',
          name,
          reason: err instanceof Error ? err.message : t('titleBlock.unknownError', 'unknown error', { ns: 'editor' }),
        }),
      )

    } finally {
      setSaving(null)
    }
  }

  return (
    <SettingsCard
      id="title-blocks"
      title={t('panel.titleBlocks', 'Title blocks', { ns: 'editor' })}

      description={t(
        'titleBlock.description',
        'The title blocks sheets can use, with the paper each is drawn for. New sheets start with the default; a sheet keeps its own title block until you change it in Sheets › Title block.',
        { ns: 'editor' },
      )}

    >
      {choices.length === 0 ? (
        <Empty>
          <EmptyHeader>

            <EmptyTitle>{t('titleBlock.noneInLibrary', 'No title blocks in the library', { ns: 'editor' })}</EmptyTitle>
            <EmptyDescription>
              {t('titleBlock.noneInLibraryWhy', 'Sheets use the built-in MutinyBIM title block until the firm adds one.', { ns: 'editor' })}
            </EmptyDescription>

          </EmptyHeader>
        </Empty>
      ) : (
        <Table aria-label={t('panel.titleBlocks', 'Title blocks', { ns: 'editor' })}>
          <TableHeader>
            <TableRow>

              <TableHead>{t('titleBlock.titleBlock', 'Title block', { ns: 'editor' })}</TableHead>
              <TableHead>{t('titleBlock.paper', 'Paper', { ns: 'editor' })}</TableHead>
              <TableHead className="text-right">{t('titleBlock.default', 'Default', { ns: 'editor' })}</TableHead>

            </TableRow>
          </TableHeader>
          <TableBody>
            {choices.map((c) => {
              const paper = c.row.definition.paperMm
              const button = (
                <Button size="sm" variant="outline" disabled={Boolean(blocked) || saving !== null} onClick={() => void choose(c.id, c.name)}>

                  {saving === c.id ? t('titleBlock.saving', 'Saving…', { ns: 'editor' }) : t('titleBlock.makeDefault', 'Make default', { ns: 'editor' })}

                </Button>
              )
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>

                    {t('titleBlock.paperSize', '{{name}} · {{height}} × {{width}} in, landscape', {
                      ns: 'editor',
                      name: c.paperName,
                      height: inches(paper.y),
                      width: inches(paper.x),
                    })}

                  </TableCell>
                  <TableCell className="text-right">
                    {c.isDefault ? (

                      <Badge variant="secondary">{t('titleBlock.default', 'Default', { ns: 'editor' })}</Badge>

                    ) : blocked ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{button}</span>
                        </TooltipTrigger>
                        <TooltipContent>{blocked}</TooltipContent>
                      </Tooltip>
                    ) : (
                      button
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </SettingsCard>
  )
}
