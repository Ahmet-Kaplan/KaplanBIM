'use client'

import type { ReactNode } from 'react'
import { useEditorTranslate, type Translate } from '../i18n/translate'
import { GitBranchIcon } from 'lucide-react'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '../../ui/item'
import type { VersionEntry } from '../../contracts/building-model/branch-versions'

export interface VersionRowProps {
  readonly entry: VersionEntry
  /** Absent: the person can't start branches (the reason is shown instead). */
  readonly onNewBranch?: (entry: VersionEntry) => void
  readonly cantStartReason?: string | null
  /** Slot under the row (lane O: "What kind of change was this?"). */
  readonly renderExtra?: (entry: VersionEntry) => ReactNode
}

/** The row's kind, as a word: a saved version or an issued set. */
function kindLabel(kind: Exclude<VersionEntry['kind'], 'now'>, t: Translate): string {
  return kind === 'saved' ? t('versions.saved', 'Saved', { ns: 'editor' }) : t('versions.issuedSet', 'Issued set', { ns: 'editor' })
}

export function VersionRow({ entry, onNewBranch, cantStartReason, renderExtra }: VersionRowProps) {
  const t = useEditorTranslate()
  return (
    <Item variant="outline" size="sm" className="flex-wrap">
      <ItemContent>
        <ItemTitle>
          {entry.label}
          {entry.kind !== 'now' ? <Badge variant="secondary">{kindLabel(entry.kind, t)}</Badge> : null}
        </ItemTitle>
        <ItemDescription>{entry.detail}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline" disabled={!onNewBranch} title={onNewBranch ? undefined : (cantStartReason ?? undefined)} onClick={() => onNewBranch?.(entry)}>
          <GitBranchIcon aria-hidden />
          {t('versions.newBranchFromThis', 'New branch from this version', { ns: 'editor' })}
        </Button>
      </ItemActions>
      {renderExtra ? <div className="basis-full">{renderExtra(entry)}</div> : null}
    </Item>
  )
}
