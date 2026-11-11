import {
  containsPoint,
  detectRoomOutlines,
  isCalibrated,
  ROOM_DETECTOR_ID,
  sourceToModel,
  spaceOutlines,
  spacesOnLevel,
  type Command,
  type DetectedRoomOutline,
  type DrawingUnderlay,
  type ElementId,
  type LineworkSegment,
  type ModelState,
} from '@permitzip/bim-kernel'
import type { UnderlaySegment } from '../../contracts/bim/underlays/formats'
import { newElementId } from '../placement'
import { englishOnly, type Translate } from '../i18n/translate'
import { nextSpaceNumber } from './space-rows'

/**
 * "Propose rooms from this drawing": the drawing's linework in model mm into
 * the kernel's room detector, minus rooms that already have a space, then the
 * accepted ones as one create_space batch (one undo). Pure, so the hook and
 * the tests share it. Nothing is written until the person accepts.
 */

export type ProposalDecision = 'pending' | 'accepted' | 'rejected'

export interface ReviewedProposal {
  readonly room: DetectedRoomOutline
  readonly decision: ProposalDecision
}

export type ProposeOutcome =
  | { readonly kind: 'review'; readonly proposals: readonly ReviewedProposal[]; readonly alreadySpaces: number }
  | { readonly kind: 'empty'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string }

/** Said when the drawing's lines enclose nothing. A function so a Turkish panel says it in Turkish. */
export const noRoomsFound = (t: Translate = englishOnly): string => t('spaces.noRoomsFound', 'No closed rooms found on this page — check the scale.', { ns: 'editor' })

/** Rooms the drawing's lines enclose that have no space yet on this level. */
export function proposeRooms(model: ModelState, levelId: ElementId, underlay: DrawingUnderlay, linework: readonly UnderlaySegment[], t: Translate = englishOnly): ProposeOutcome {
  if (!isCalibrated(underlay)) return { kind: 'error', message: t('spaces.drawingNoScale', '{{drawing}} has no scale yet. Set its scale, then propose rooms.', { ns: 'editor', drawing: underlay.source.name }) }
  const cal = underlay.calibration
  const segments: LineworkSegment[] = linework.map(([x1, y1, x2, y2]) => ({ a: sourceToModel(cal, { x: x1, y: y1 }), b: sourceToModel(cal, { x: x2, y: y2 }) }))
  const found = detectRoomOutlines(segments)
  if (!found.ok) return { kind: 'error', message: `${found.reason}.` }
  const existing = spacesOnLevel(model.elements, levelId).flatMap((s) => spaceOutlines(model.elements, s))
  const fresh = found.rooms.filter((r) => !existing.some((o) => containsPoint(o, r.centre)))
  if (found.rooms.length === 0) return { kind: 'empty', message: noRoomsFound(t) }
  if (fresh.length === 0)
    return { kind: 'empty', message: t('spaces.everyRoomHasSpace', 'Every room found on this page ({{count}}) already has a space.', { ns: 'editor', count: found.rooms.length }) }
  return { kind: 'review', proposals: fresh.map((room) => ({ room, decision: 'pending' })), alreadySpaces: found.rooms.length - fresh.length }
}

export function decide(proposals: readonly ReviewedProposal[], key: string, decision: ProposalDecision): ReviewedProposal[] {
  return proposals.map((p) => (p.room.key === key ? { ...p, decision } : p))
}

/** Accept all: every proposal not rejected. */
export function acceptAll(proposals: readonly ReviewedProposal[]): ReviewedProposal[] {
  return proposals.map((p) => (p.decision === 'rejected' ? p : { ...p, decision: 'accepted' }))
}

/** The accepted proposals as one create_space batch, numbered on from the level's highest; null when none are accepted. */
export function acceptedSpacesCommand(model: ModelState, levelId: ElementId, underlay: DrawingUnderlay, proposals: readonly ReviewedProposal[], t: Translate = englishOnly): Command | null {
  const accepted = proposals.filter((p) => p.decision === 'accepted')
  if (accepted.length === 0) return null
  let n = Number.parseInt(nextSpaceNumber(model, levelId), 10)
  return {
    type: 'create_space',
    spaces: accepted.map((p) => {
      const number = String(n++)
      return {
        spaceId: newElementId('space'),
        number,
        name: t('spaces.spaceName', 'Space {{number}}', { ns: 'editor', number }),
        levelId,
        outline: p.room.outline.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) })),
        origin: { kind: 'detected' as const, detector: ROOM_DETECTOR_ID, confidence: p.room.confidence, underlayId: underlay.id, accepted: true as const },
      }
    }),
  }
}

export function areaFt2(room: DetectedRoomOutline): number {
  return Math.round(room.areaM2 * 10.7639)
}
