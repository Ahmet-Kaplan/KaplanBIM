'use client'

import { Contrast, Eye, EyeOff, Lock } from 'lucide-react'
import { GROUP_VISIBILITIES, organizationOf, type GroupVisibility, type ModelState } from '@permitzip/bim-kernel'
import { Field, FieldContent, FieldDescription, FieldLabel } from '../../ui/field'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { useEditorTranslate } from '../i18n/translate'
import { groupVisibilityLabel } from './labels'

const ICON = { show: Eye, halftone: Contrast, hide: EyeOff } as const

interface Props {
  readonly model: ModelState
  /** Per group: what the open view (or the free 3D model) uses. */
  readonly visibility: (groupId: string) => GroupVisibility
  /** Null when saved; otherwise the plain reason it wasn't. */
  readonly onChange: (groupId: string, visibility: GroupVisibility) => string | null
  /** Why the toggles are read-only (a saved view you can't edit), or null. */
  readonly blockedReason: string | null
  /** "this view" or "the 3D model" — already in the reader's language by the caller. */
  readonly scope: string
}

/** The model's groups with show / halftone / hide for what is open. */
export function GroupVisibilityList({ model, visibility, onChange, blockedReason, scope }: Props) {
  const t = useEditorTranslate()
  const org = organizationOf(model)
  return (
    <div className="flex flex-col gap-2" data-testid="group-visibility">
      {org.groups.map((g) => {
        const value = visibility(g.id)
        return (
          <Field key={g.id} orientation="horizontal" className="items-center justify-between gap-2" data-testid={`group-visibility-${g.id}`}>
            <FieldContent className="min-w-0">
              <FieldLabel className="min-w-0 font-normal">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full border" style={{ backgroundColor: g.entry.color }} />
                <span className="truncate">{g.entry.name}</span>
                {g.entry.locked && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="size-3 shrink-0 text-muted-foreground" aria-label={t('org.lockedAria', 'Locked', { ns: 'editor' })} />
                    </TooltipTrigger>
                    <TooltipContent>{t('org.lockedWhy', "Locked: its elements can't be changed until someone unlocks it", { ns: 'editor' })}</TooltipContent>
                  </Tooltip>
                )}
              </FieldLabel>
            </FieldContent>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={value}
              disabled={blockedReason !== null}
              aria-label={t('org.group.showsIn', 'How {{name}} shows in {{scope}}', { ns: 'editor', name: g.entry.name, scope })}
              onValueChange={(v) => {
                const next = GROUP_VISIBILITIES.find((x) => x === v)
                if (next && next !== value) onChange(g.id, next)
              }}
            >
              {GROUP_VISIBILITIES.map((v) => {
                const Icon = ICON[v]
                return (
                  <Tooltip key={v}>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem
                        value={v}
                        aria-label={t('org.group.visibilityOf', '{{word}} {{name}}', { ns: 'editor', word: groupVisibilityLabel(v, t), name: g.entry.name })}
                        data-testid={`group-${g.id}-${v}`}
                      >
                        <Icon />
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent>
                      {blockedReason ??
                        t('org.group.visibilityIn', '{{word}} {{name}} in {{scope}}', { ns: 'editor', word: groupVisibilityLabel(v, t), name: g.entry.name, scope })}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </ToggleGroup>
          </Field>
        )
      })}
      {blockedReason && <FieldDescription>{blockedReason}</FieldDescription>}
    </div>
  )
}
