'use client'

import { useMemo } from 'react'
import { ShieldCheck } from 'lucide-react'
import { derivedZoneCandidates, type Command, type ElementId, type ModelState } from '@permitzip/bim-kernel'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { newElementId } from '../placement'
import { useEditorTranslate } from '../i18n/translate'

/**
 * Code zones the equipment on this plan derives (the NEC 110.26(E) dedicated
 * space above each panel), from the same kernel rule the electrical check
 * reads. "Keep as a zone" stores only the panel and the rule; the zone
 * follows the panel when it moves.
 */
export function CodeZonesList({ model, levelId, editReason, send }: { readonly model: ModelState; readonly levelId: ElementId | null; readonly editReason: string | null; readonly send: (command: Command, label: string) => boolean }) {
  const t = useEditorTranslate()
  const candidates = useMemo(() => derivedZoneCandidates(model, { levelId }), [model, levelId])
  if (candidates.length === 0) return null
  return (
    <section className="flex flex-col gap-2 border-t pt-2" aria-label={t('spaces.codeZonesFromEquipment', 'Code zones from equipment', { ns: 'editor' })} data-testid="spaces-code-zones">
      <h3 className="text-xs font-medium text-muted-foreground">{t('spaces.codeZonesFromEquipment', 'Code zones from equipment', { ns: 'editor' })}</h3>
      <ItemGroup>
        {candidates.map((c) => {
          const first = c.regions[0]
          const highFt = first ? Math.round(((first.topMm - first.bottomMm) / 304.8) * 10) / 10 : null
          return (
            <Item key={`${c.hostId}:${c.rule}`} size="xs" variant="outline" data-testid="spaces-code-zone" data-host={c.hostId} data-zone={c.zoneId ?? ''}>
              <ItemContent>
                <ItemTitle>
                  {first?.name ?? c.label} {c.hostLabel}
                  {c.zoneId ? <Badge variant="secondary">{t('spaces.zoneBadge', 'Zone', { ns: 'editor' })}</Badge> : null}
                </ItemTitle>
                <ItemDescription>
                  {highFt !== null ? t('spaces.codeZoneUpTo', 'Up to {{feet}} ft above it, ends at a suspended ceiling or the structure', { ns: 'editor', feet: highFt }) : c.label}
                  {first?.cite ? ` · ${first.cite}` : ''}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {c.zoneId ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={editReason !== null}
                    title={editReason ?? t('spaces.keepCodeZoneWhy', 'Keep it as a zone in the list; it follows the equipment when it moves', { ns: 'editor' })}
                    onClick={() => send({ type: 'accept_derived_zone', zoneId: newElementId('zone'), hostId: c.hostId, rule: c.rule }, t('spaces.keepCodeZone', 'Keep code zone', { ns: 'editor' }))}
                    data-testid="spaces-code-zone-keep"
                  >
                    <ShieldCheck data-icon="inline-start" />
                    {t('spaces.keepAsZone', 'Keep as a zone', { ns: 'editor' })}
                  </Button>
                )}
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>
    </section>
  )
}
