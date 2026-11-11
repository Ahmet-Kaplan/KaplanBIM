import { Fan, Flame, TableProperties } from 'lucide-react'
import { DEFAULT_FIELD_BLOCK_WIDTH_MM, sheetPaper, type ElementId, type Sheet, type Vec2 } from '@permitzip/bim-kernel'
import type { RibbonCommand } from '../ribbon/types'
import { newId, type SubmitCommand } from '../views-sheets/types'
import { englishOnly, type Translate } from '../i18n/translate'
import { VENTILATION_TABLE_TITLE, ZONE_VENTILATION_TEMPLATE, ZONE_VENTILATION_TITLE, type VentilationScope } from './pack'

/**
 * Ribbon commands for ventilation, as shapes the ui builder mounts:
 * Mechanical › Analyze › Ventilation opens the panel;
 * Sheet tab › Figures › Ventilation table places the live table on the open
 * sheet, beside Load summary. Each carries the reason it is disabled.
 */

export function ventilationPanelCommand(tabId: string, open: (() => void) | null, blocked: string | null, t: Translate = englishOnly): RibbonCommand {
  return {
    id: `${tabId}-ventilation`,
    label: t('ventilation.title', 'Ventilation', { ns: 'editor' }),
    icon: Fan,
    description: t(
      'ventilation.commandDescription',
      'Outdoor air and exhaust for every space (Vbz, Voz) under IMC and ASHRAE 62.1 side by side, the adopted code marked governing, and each zone against the unit that serves it',
      { ns: 'editor' },
    ),
    // Search words: the abbreviations (oa, vbz, voz, IMC, ASHRAE) are the same in
    // both languages (§0.3 — international abbreviations are never translated).
    keywords: [
      t('ventilation.keyword.outdoorAir', 'outdoor air', { ns: 'editor' }),
      t('ventilation.keyword.abbrOa', 'oa', { ns: 'editor' }),
      t('ventilation.keyword.abbrVbz', 'vbz', { ns: 'editor' }),
      t('ventilation.keyword.abbrVoz', 'voz', { ns: 'editor' }),
      t('ventilation.keyword.abbrImc403', 'imc 403', { ns: 'editor' }),
      t('ventilation.keyword.ashrae621', 'ashrae 62.1', { ns: 'editor' }),
      t('ventilation.keyword.exhaust', 'exhaust', { ns: 'editor' }),
      t('ventilation.keyword.schedule', 'ventilation schedule', { ns: 'editor' }),
      t('ventilation.keyword.freshAir', 'fresh air', { ns: 'editor' }),
    ],
    disabledReason: open ? blocked : t('ventilation.modelStillLoading', 'The model is still loading.', { ns: 'editor' }),
    ...(open ? { run: open } : {}),
    testId: `ribbon-${tabId}-ventilation`,
  }
}

export function kitchenHeatPanelCommand(open: (() => void) | null, blocked: string | null, t: Translate = englishOnly): RibbonCommand {
  return {
    id: 'model-kitchen-heat',
    label: t('ventilation.kitchenHeatCommand', 'Kitchen heat…', { ns: 'editor' }),
    icon: Flame,
    description: t(
      'ventilation.kitchenHeatDescription',
      'Heat each space gains from its kitchen equipment, from the firm’s or the project’s kitchen heat table with its citation, or where to add the table',
      { ns: 'editor' },
    ),
    keywords: [
      t('ventilation.keyword.kitchen', 'kitchen', { ns: 'editor' }),
      t('ventilation.keyword.heatGain', 'heat gain', { ns: 'editor' }),
      t('ventilation.keyword.fryer', 'fryer', { ns: 'editor' }),
      t('ventilation.keyword.range', 'range', { ns: 'editor' }),
      t('ventilation.keyword.appliance', 'appliance', { ns: 'editor' }),
      t('ventilation.keyword.sensible', 'sensible', { ns: 'editor' }),
      t('ventilation.keyword.latent', 'latent', { ns: 'editor' }),
      t('ventilation.keyword.abbrBtu', 'btu', { ns: 'editor' }),
      t('ventilation.keyword.lookupTable', 'lookup table', { ns: 'editor' }),
      t('ventilation.keyword.loads', 'loads', { ns: 'editor' }),
    ],
    disabledReason: open ? blocked : t('ventilation.modelStillLoading', 'The model is still loading.', { ns: 'editor' }),
    ...(open ? { run: open } : {}),
    testId: 'ribbon-model-kitchen-heat',
  }
}

export function ventilationTableCommand(place: (() => void) | null | undefined, editBlocked: string | null, t: Translate = englishOnly): RibbonCommand {
  return {
    id: 'sheet-ventilation-table',
    label: t('ventilation.tableCommand', 'Ventilation table', { ns: 'editor' }),
    icon: TableProperties,
    description: t(
      'ventilation.tableCommandDescription',
      'Put the live ventilation table on the sheet: outdoor air and exhaust per space and zone under the governing code, updated with every edit and frozen when the set is issued',
      { ns: 'editor' },
    ),
    keywords: [
      t('ventilation.keyword.schedule', 'ventilation schedule', { ns: 'editor' }),
      t('ventilation.keyword.outdoorAir', 'outdoor air', { ns: 'editor' }),
      t('ventilation.keyword.abbrImc', 'imc', { ns: 'editor' }),
      t('ventilation.keyword.ashrae621', 'ashrae 62.1', { ns: 'editor' }),
      t('ventilation.keyword.block', 'block', { ns: 'editor' }),
      t('ventilation.keyword.table', 'table', { ns: 'editor' }),
      t('ventilation.keyword.abbrOa', 'oa', { ns: 'editor' }),
    ],
    disabledReason: place ? editBlocked : t('ventilation.tableNeedsSheet', 'Open a sheet to place a ventilation table: Views and sheets › a sheet.', { ns: 'editor' }),
    ...(place ? { run: place } : {}),
    testId: 'ribbon-sheet-ventilation-table',
  }
}

/** Where a new table lands when nobody picked a spot: the top-left quarter, clear of the title block. */
export function ventilationTableCorner(sheet: Sheet): Vec2 {
  const paper = sheetPaper(sheet)
  return { x: Math.round(Math.max(0, Math.min(paper.x / 8, paper.x - DEFAULT_FIELD_BLOCK_WIDTH_MM))), y: Math.round(paper.y / 8) }
}

/** One table block for a scope (the block spec's `table`, blocks/table-spec.ts). */
export function ventilationTableBlock(scope: VentilationScope, t: Translate = englishOnly) {
  return { template: t('ventilation.templateName', 'Ventilation table', { ns: 'editor' }), title: VENTILATION_TABLE_TITLE, table: { kind: 'ventilation' as const, scope } }
}

/**
 * Sheet › Figures › Ventilation table, today: one zone's summary as an
 * ordinary field block (works once the ventilation field provider is
 * registered). Returns the new item id, or the refusal in words.
 */
export function placeZoneVentilation(sheet: Sheet, zoneId: ElementId, submit: SubmitCommand, t: Translate = englishOnly, at: Vec2 = ventilationTableCorner(sheet)): { readonly itemId: string } | { readonly refusal: string } {
  const itemId = newId('blk')
  const refusal = submit(
    { type: 'add_field_block', itemId, sheetId: sheet.id, at, block: { template: ZONE_VENTILATION_TEMPLATE, title: ZONE_VENTILATION_TITLE, subjectId: zoneId } },
    t('ventilation.undo.placeZoneVentilation', 'place zone ventilation', { ns: 'editor' }),
  )
  return refusal ? { refusal } : { itemId }
}
