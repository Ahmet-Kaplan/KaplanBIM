import { Wind } from 'lucide-react'
import { type BlockTableInput, type Sheet, type Vec2 } from '@permitzip/bim-kernel'
import { PRESSURIZATION_TABLE_TITLE } from '@permitzip/bim-pack-mechanical'
import type { RibbonCommand } from '../ribbon/types'
import { newId, type SubmitCommand } from '../views-sheets/types'
import { englishOnly, type Translate } from '../i18n/translate'
import { ventilationTableCorner } from '../ventilation/ribbon'

/**
 * Sheet tab › Figures › Pressurization table: places the live pressurization
 * table (each zone and the building, exhaust, makeup air, outdoor air, net and
 * the makeup-air load) on the open sheet, beside Load summary and Ventilation
 * table. Frozen at issue like every block.
 */

export function pressurizationTableCommand(place: (() => void) | null | undefined, editBlocked: string | null, t: Translate = englishOnly): RibbonCommand {
  return {
    id: 'sheet-pressurization-table',
    label: t('balance.tableCommand', 'Pressurization table', { ns: 'editor' }),
    icon: Wind,
    description: t(
      'balance.tableCommandDescription',
      'Put the live building pressurization table on the sheet: exhaust fans, makeup air and unit outdoor air per zone and for the building, positive or negative against the target, and the untempered makeup air load; updated with every edit and frozen when the set is issued',
      { ns: 'editor' },
    ),
    keywords: [
      t('balance.tableKeyword.pressurization', 'pressurization', { ns: 'editor' }),
      t('balance.tableKeyword.airBalance', 'air balance', { ns: 'editor' }),
      t('balance.tableKeyword.exhaust', 'exhaust', { ns: 'editor' }),
      t('balance.tableKeyword.makeupAir', 'makeup air', { ns: 'editor' }),
      t('balance.tableKeyword.abbrMua', 'mua', { ns: 'editor' }),
      t('balance.tableKeyword.abbrKef', 'kef', { ns: 'editor' }),
      t('balance.tableKeyword.positive', 'positive', { ns: 'editor' }),
      t('balance.tableKeyword.negative', 'negative', { ns: 'editor' }),
      t('balance.tableKeyword.buildingPressure', 'building pressure', { ns: 'editor' }),
      t('balance.tableKeyword.table', 'table', { ns: 'editor' }),
      t('balance.tableKeyword.block', 'block', { ns: 'editor' }),
    ],
    disabledReason: place ? editBlocked : t('balance.tableNeedsSheet', 'Open a sheet to place a pressurization table: Views and sheets › a sheet.', { ns: 'editor' }),
    ...(place ? { run: place } : {}),
    testId: 'ribbon-sheet-pressurization-table',
  }
}

/** The block a Pressurization table places: the whole building, or one level's zones. */
export function pressurizationTableBlock(scope: Extract<BlockTableInput, { scope: unknown }>['scope'], t: Translate = englishOnly) {
  return { template: t('balance.templateName', 'Pressurization table', { ns: 'editor' }), title: PRESSURIZATION_TABLE_TITLE, table: { kind: 'pressurization' as const, scope } }
}

/**
 * The undo label for a table block placed on a sheet — `place pressurization table`.
 * The kind is a table kind (`pressurization`, `ventilation`, `gas`), so the noun is
 * a word table in its own right: splicing the raw kind into a translated frame
 * would print `place pressurization table` in a Turkish undo toast (§9/Ç-B).
 */
export function tableKindUndo(kind: BlockTableInput['kind'], t: Translate = englishOnly): string {
  const word = ((): string => {
    switch (kind) {
      case 'pressurization':
        return t('balance.tableKind.pressurization', 'pressurization', { ns: 'editor' })
      case 'ventilation':
        return t('balance.tableKind.ventilation', 'ventilation', { ns: 'editor' })
      case 'gas':
        return t('balance.tableKind.gas', 'gas', { ns: 'editor' })
      case 'keynotes':
        return t('balance.tableKind.keynotes', 'keynote', { ns: 'editor' })
    }
  })()
  return t('balance.undoPlaceTable', 'place {{kind}} table', { ns: 'editor', kind: word })
}

/** Places a table block on the sheet; returns the new item id, or the refusal in words. */
export function placeTableBlock(sheet: Sheet, block: { readonly template: string; readonly title: string; readonly table: BlockTableInput }, submit: SubmitCommand, t: Translate = englishOnly, at: Vec2 = ventilationTableCorner(sheet)): { readonly itemId: string } | { readonly refusal: string } {
  const itemId = newId('blk')
  const refusal = submit({ type: 'add_field_block', itemId, sheetId: sheet.id, at, block }, tableKindUndo(block.table.kind, t))
  return refusal ? { refusal } : { itemId }
}
