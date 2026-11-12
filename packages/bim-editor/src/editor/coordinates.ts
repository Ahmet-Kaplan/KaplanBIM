import {
  ORIGIN_POINT_LABEL,
  formatSharedFt,
  modelToShared,
  originPointPosition,
  type Command,
  type ModelState,
  type OriginPoint,
  type SiteFrame,
  type SitePoint,
  elementValues,
} from '@permitzip/bim-kernel'
import { englishOnly, type Translate } from './i18n/translate'
import { elementKindWords } from './placement'
import type { SnapCandidate } from '@permitzip/bim-viewer-3d'

/** Move the origin marker only, or move the building on the site. Worded the same everywhere the choice appears. */
export type OriginMoveMode = 'move_point' | 'relocate_project'

/** The two choices in the language on screen: the label a person picks and the line under it. */
export function moveModeWords(mode: OriginMoveMode, t: Translate): { readonly label: string; readonly help: string } {
  return mode === 'move_point'
    ? {
        label: t('coordinates.movePointOnly', 'Move the origin marker only', { ns: 'editor' }),
        help: t('coordinates.movePointOnlyWhy', 'Coordinates of everything else stay the same.', { ns: 'editor' }),
      }
    : {
        label: t('coordinates.relocateProject', 'Move the building on the site', { ns: 'editor' }),
        help: t('coordinates.relocateProjectWhy', 'Site coordinates of everything change; geometry stays put.', { ns: 'editor' }),
      }
}

/** The undo / toast wording for a committed move ("Move the origin marker (project origin)"). */
export function moveOriginLabel(which: OriginPoint, mode: OriginMoveMode, t: Translate = englishOnly): string {
  const point = which === 'survey_point' ? t('coordinates.sitePointWord', 'site point', { ns: 'editor' }) : t('coordinates.projectOriginWord', 'project origin', { ns: 'editor' })
  return mode === 'move_point'
    ? t('coordinates.undoMoveMarker', 'move the origin marker ({{point}})', { ns: 'editor', point })
    : t('coordinates.undoRelocateProject', 'move the building on the site ({{point}})', { ns: 'editor', point })
}

/** The point Reset and Move act on: the marker's point, or the project base point when the marker shows the fixed internal origin. */
export function movableOriginPoint(which: OriginPoint): Exclude<OriginPoint, 'internal_origin'> {
  return which === 'internal_origin' ? 'project_base_point' : which
}

/** Put a movable point back on the internal origin (0, 0, 0). Only the marker moves; nothing else's coordinates change. Null when it is already there. */
export function resetOriginCommand(site: SiteFrame, which: OriginPoint): Command | null {
  const target = movableOriginPoint(which)
  const at = originPointPosition(site, target)
  if (Math.hypot(at.x, at.y, at.z) < 0.5) return null
  return moveOriginCommand(target, 'move_point', { position: { x: 0, y: 0, z: 0 } })
}

/** The marker's label: which point it is and its site coordinates, in feet. */
export function originLabel(site: SiteFrame, which: OriginPoint, at: SitePoint = originPointPosition(site, which)): { title: string; lines: readonly { readonly key: string; readonly value: string }[] } {
  const s = modelToShared(site, at)
  return {
    title: ORIGIN_POINT_LABEL[which],
    lines: [
      { key: 'N/S', value: formatSharedFt(s.northSouth) },
      { key: 'E/W', value: formatSharedFt(s.eastWest) },
      { key: 'Elev', value: formatSharedFt(s.elevation) },
    ],
  }
}

/** Where a dragged origin may snap: the other origin points, parts and equipment, and run ends. Kernel plan mm. */
export function originSnapCandidates(model: ModelState, site: SiteFrame, dragging: OriginPoint, t: Translate = englishOnly): SnapCandidate[] {
  const out: SnapCandidate[] = []
  for (const which of ['internal_origin', 'project_base_point', 'survey_point'] as const) {
    if (which === dragging) continue
    const p = originPointPosition(site, which)
    out.push({ x: p.x, y: p.y, label: ORIGIN_POINT_LABEL[which] })
  }
  for (const el of elementValues(model.elements)) {
    switch (el.kind) {
      case 'part':
        out.push({ x: el.position.x, y: el.position.y, label: el.mark || 'part' })
        break
      case 'equipment':
        out.push({ x: el.position.x, y: el.position.y, label: el.mark })
        break
      case 'run_segment':
        out.push(
          { x: el.start.x, y: el.start.y, label: t('coordinates.runEnd', 'run end', { ns: 'editor' }) },
          { x: el.end.x, y: el.end.y, label: t('coordinates.runEnd', 'run end', { ns: 'editor' }) },
        )
        break
      case 'wall':
      case 'grid':
        out.push(
          { x: el.start.x, y: el.start.y, label: elementKindWords(el.kind, t) },
          { x: el.end.x, y: el.end.y, label: elementKindWords(el.kind, t) },
        )
        break
      default:
        break
    }
  }
  return out
}

/** The command that moves one of the movable points; null for the internal origin, which never moves. */
export function moveOriginCommand(which: OriginPoint, mode: OriginMoveMode, change: { readonly position?: SitePoint; readonly shared?: { eastWest: number; northSouth: number; elevation: number } }): Command | null {
  if (which === 'internal_origin') return null
  const type = which === 'project_base_point' ? 'set_project_origin' : 'set_survey_point'
  return { type, mode, ...(change.position ? { position: change.position } : {}), ...(change.shared ? { shared: change.shared } : {}) }
}

export const INTERNAL_ORIGIN_FIXED = 'Model zero is the model’s own 0, 0, 0 and never moves. Move the project origin instead.'
