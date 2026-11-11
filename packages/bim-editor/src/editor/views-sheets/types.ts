import type { Command } from '@permitzip/bim-kernel'
import { englishOnly, type Translate } from '../i18n/translate'

/** What the canvas shows: the live 3D model (or looking straight down at it), a saved view, or a sheet. */
export type OpenItem =
  | { readonly kind: 'model'; readonly mode: '3d' | 'plan' }
  | { readonly kind: 'view'; readonly id: string }
  | { readonly kind: 'sheet'; readonly id: string }

/** Send one command; null when it is on its way, or the plain reason it was refused. */
export type SubmitCommand = (command: Command, undoLabel?: string) => string | null

export type CreatableViewType = 'floor_plan' | 'ceiling_plan' | 'section' | 'three_d' | 'detail'

/**
 * What kind of view this is, in the language on screen (§2.4: view, section,
 * detail view, sheet; §5: a schedule is a çizelge).
 */
export function viewTypeLabel(type: CreatableViewType | 'schedule', t: Translate = englishOnly): string {
  switch (type) {
    case 'floor_plan':
      return t('view.type.floorPlan', 'Floor plan', { ns: 'editor' })
    case 'ceiling_plan':
      return t('view.type.ceilingPlan', 'Ceiling plan', { ns: 'editor' })
    case 'section':
      return t('view.type.section', 'Section', { ns: 'editor' })
    case 'three_d':
      return t('view.type.threeD', '3D view', { ns: 'editor' })
    case 'detail':
      return t('view.type.detail', 'Detail view (drawing-only)', { ns: 'editor' })
    case 'schedule':
      return t('view.type.schedule', 'Schedule', { ns: 'editor' })
  }
}

/** Drag payload when a view is dragged from the panel onto a sheet. */
export const VIEW_DRAG_TYPE = 'application/x-mutinybim-view'

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function sameOpen(a: OpenItem, b: OpenItem): boolean {
  if (a.kind === 'model' && b.kind === 'model') return a.mode === b.mode
  if (a.kind === 'view' && b.kind === 'view') return a.id === b.id
  if (a.kind === 'sheet' && b.kind === 'sheet') return a.id === b.id
  return false
}
