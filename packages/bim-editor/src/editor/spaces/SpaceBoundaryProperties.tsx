'use client'

import { BOUNDARY_QUANTITY_KEYS, boundingElementWords, measuredValue, spaceBoundaryFacts, type BoundaryFact, type ElementId, type ModelState } from '@permitzip/bim-kernel'
import { isPackRefusal } from '@permitzip/bim-kernel/packs'
import { Button } from '../../ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Table, TableBody, TableCaption, TableCell, TableRow } from '../../ui/table'
import { useEditorTranslate, type Translate } from '../i18n/translate'

const FT_PER_M = 3.28084
const FT2_PER_M2 = 10.7639104

/** `ft` and `sq ft` are §7 unit symbols: they do not travel, so only the number is localised. */
const ft = (m: number) => `${Math.round(m * FT_PER_M).toLocaleString('en-US')} ft`
const ft2 = (m2: number) => `${Math.round(m2 * FT2_PER_M2).toLocaleString('en-US')} sq ft`

/** The boundary quantities in the order a person reads them, with their units and their words (§5). */
const QUANTITIES: ReadonlyArray<{ readonly key: string; readonly label: (t: Translate) => string; readonly show: (v: number) => string }> = [
  { key: BOUNDARY_QUANTITY_KEYS.exteriorLength, label: (t) => t('spaces.exteriorWallLength', 'Exterior wall length', { ns: 'editor' }), show: ft },
  { key: BOUNDARY_QUANTITY_KEYS.exteriorWallArea, label: (t) => t('spaces.exteriorWallArea', 'Exterior wall area (less doors and windows)', { ns: 'editor' }), show: ft2 },
  { key: BOUNDARY_QUANTITY_KEYS.interiorWallArea, label: (t) => t('spaces.interiorWallArea', 'Interior wall area (less doors)', { ns: 'editor' }), show: ft2 },
  { key: BOUNDARY_QUANTITY_KEYS.windowArea, label: (t) => t('spaces.windowArea', 'Window area', { ns: 'editor' }), show: ft2 },
  { key: BOUNDARY_QUANTITY_KEYS.doorCount, label: (t) => t('spaces.doors', 'Doors', { ns: 'editor' }), show: (v) => String(Math.round(v)) },
  { key: BOUNDARY_QUANTITY_KEYS.ratedLength, label: (t) => t('spaces.ratedWallLength', 'Rated wall length', { ns: 'editor' }), show: ft },
]

function beyondWords(model: ModelState, f: BoundaryFact, t: Translate): string {
  if (f.otherSide.kind === 'outside') return t('spaces.beyondOutside', 'outside', { ns: 'editor' })
  if (f.otherSide.kind === 'unknown') return t('spaces.beyondUnknown', 'not known', { ns: 'editor' })
  const s = model.elements[f.otherSide.spaceId]
  // A space's name and number are model data, not a caption.
  return s?.kind === 'space' ? [s.name, s.number].filter((part) => part.trim() !== '').join(' ') || t('spaces.anotherSpace', 'another space', { ns: 'editor' }) : t('spaces.anotherSpace', 'another space', { ns: 'editor' })
}

/**
 * A space's "Bounded by walls" section: each edge with what bounds it, how
 * long it is, what is beyond it and the doors and windows in it (each row
 * selects its wall), then the boundary quantities. A space drawn or traced
 * says so instead.
 */
export function SpaceBoundaryProperties({ model, spaceId, onSelectElement }: { readonly model: ModelState; readonly spaceId: ElementId; readonly onSelectElement?: (id: ElementId) => void }) {
  const t = useEditorTranslate()
  const space = model.elements[spaceId]
  if (space?.kind !== 'space') return null
  if (space.bounds.kind !== 'bounded') {
    const how =
      space.bounds.kind === 'none'
        ? t('spaces.notDrawnYet', 'Not drawn yet', { ns: 'editor' })
        : space.origin.kind === 'traced'
          ? t('spaces.tracedOverADrawing', 'Traced over a drawing', { ns: 'editor' })
          : space.origin.kind === 'from_room'
            ? t('spaces.fromTheRoom', 'From the room', { ns: 'editor' })
            : t('spaces.drawn', 'Drawn', { ns: 'editor' })
    return (
      <p className="text-xs text-muted-foreground" data-testid="space-made-how">
        {t('spaces.outlineDoesntFollowWalls', '{{how}}. Its outline doesn’t follow walls; make it with Room from walls to list what bounds it.', { ns: 'editor', how })}
      </p>
    )
  }
  const facts = spaceBoundaryFacts(model, spaceId)
  const list = isPackRefusal(facts) ? [] : facts
  return (
    <section className="flex flex-col gap-2" aria-label={t('spaces.boundedByWalls', 'Bounded by walls', { ns: 'editor' })} data-testid="space-bounded-by">
      <h4 className="text-xs font-medium">
        {t('spaces.boundedByWalls', 'Bounded by walls', { ns: 'editor' })}
        {space.bounds.open ? t('spaces.noLongerClosedCheckWalls', ' (no longer closed: check its walls)', { ns: 'editor' }) : ''}
      </h4>
      <ItemGroup>
        {list.map((f, i) => (
          <Item key={`${f.elementId}:${i}`} size="sm" variant="outline" data-testid="space-bounded-by-row" data-element={f.elementId}>
            <ItemContent>
              <ItemTitle>{f.virtual ? t('spaces.separationLineNamed', 'Separation line {{line}}', { ns: 'editor', line: f.elementId }) : boundingElementWords(model.elements, f.elementId)}</ItemTitle>
              <ItemDescription>
                {t('spaces.beyondWhat', '{{length}} · beyond: {{beyond}}', { ns: 'editor', length: ft(f.lengthMm / 1000), beyond: beyondWords(model, f, t) })}
                {f.openings.length > 0 ? ` · ${f.openings.map((o) => o.label.toLowerCase()).join(', ')}` : ''}
              </ItemDescription>
            </ItemContent>
            {onSelectElement ? (
              <ItemActions>
                <Button size="sm" variant="ghost" onClick={() => onSelectElement(f.elementId)} aria-label={t('spaces.selectNamed', 'Select {{name}}', { ns: 'editor', name: boundingElementWords(model.elements, f.elementId) })}>
                  {t('spaces.select', 'Select', { ns: 'editor' })}
                </Button>
              </ItemActions>
            ) : null}
          </Item>
        ))}
      </ItemGroup>
      <Table data-testid="space-boundary-quantities">
        <TableCaption className="sr-only">{t('spaces.whatIsAroundTheSpace', 'What is around the space, from its walls', { ns: 'editor' })}</TableCaption>
        <TableBody>
          {QUANTITIES.map((q) => {
            const v = measuredValue(model.elements, spaceId, q.key)
            return (
              <TableRow key={q.key}>
                <TableCell className="text-xs">{q.label(t)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{v === null ? '—' : q.show(v)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
