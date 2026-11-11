import { detectRoomsFromWalls, LINKED_WALL_ROOM_DETECTOR_ID, type Command, type ElementId, type LinkedRoomBounds, type ModelState, type Vec2 } from '@permitzip/bim-kernel'
import { newElementId } from '../placement'
import type { ReviewedProposal } from './propose-rooms'
import { nextSpaceNumber } from './space-rows'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * "Find rooms from walls": every closed room the walls on the plan's level
 * make that has no space yet, as proposals for the same review the drawing
 * detector uses; the accepted ones become spaces bounded by their walls in one
 * undoable step. Pure, so the hook and the tests share it.
 *
 * With a linked model's walls (`linked`), they bound rooms too. A room any
 * linked wall bounds becomes a space with that outline (it can't follow our
 * walls), recorded as found from the linked walls.
 */

/** Said when our own walls close no room that lacks a space. A function: a constant would carry English into a Turkish review. */
export const noWallRooms = (t: Translate = englishOnly): string =>
  t(
    'spaces.noWallRooms',
    'No rooms without a space are closed by walls on this level. Draw the walls around the room first, or use Room from walls to see where they leave a gap.',
    { ns: 'editor' },
  )

/** The same with the linked model's walls in force: nothing closed there either. */
export const noLinkedWallRooms = (t: Translate = englishOnly): string =>
  t(
    'spaces.noLinkedWallRooms',
    "No rooms without a space are closed by walls on this level, ours or the linked model's. Check the linked model has walls at this level's height, or draw the walls around the room first.",
    { ns: 'editor' },
  )

export type WallRoomsOutcome =
  | { readonly kind: 'review'; readonly proposals: readonly ReviewedProposal[]; readonly seeds: Readonly<Record<string, Vec2>>; readonly linkedOutlines?: Readonly<Record<string, readonly Vec2[]>> }
  | { readonly kind: 'empty'; readonly message: string }

export function proposeRoomsFromWalls(model: ModelState, levelId: ElementId, linked: LinkedRoomBounds | null = null, t: Translate = englishOnly): WallRoomsOutcome {
  const found = detectRoomsFromWalls(model.elements, levelId, linked ?? undefined)
  if (found.length === 0) return { kind: 'empty', message: linked ? noLinkedWallRooms(t) : noWallRooms(t) }
  const linkedOutlines = Object.fromEntries(found.filter((p) => p.linkedBoundary).map((p) => [p.key, p.outline]))
  return {
    kind: 'review',
    proposals: found.map((room) => ({ room, decision: 'pending' as const })),
    seeds: Object.fromEntries(found.map((p) => [p.key, p.seed])),
    ...(Object.keys(linkedOutlines).length > 0 ? { linkedOutlines } : {}),
  }
}

type BatchStep = Extract<Command, { type: 'batch_edits' }>['commands'][number]

/** The accepted rooms as one batch of Room from walls, numbered on from the level's highest; null when none are accepted. */
export function acceptedWallRoomsCommand(model: ModelState, levelId: ElementId, proposals: readonly ReviewedProposal[], seeds: Readonly<Record<string, Vec2>>, linkedOutlines: Readonly<Record<string, readonly Vec2[]>> = {}, t: Translate = englishOnly): Command | null {
  const accepted = proposals.filter((p) => p.decision === 'accepted' && seeds[p.room.key])
  if (accepted.length === 0) return null
  let n = Number(nextSpaceNumber(model, levelId))
  const commands = accepted.map((p): BatchStep => {
    const number = Number.isFinite(n) ? String(n++) : ''
    const name = t('spaces.spaceName', 'Space {{number}}', { ns: 'editor', number })
    const seed = seeds[p.room.key] as Vec2
    const outline = linkedOutlines[p.room.key]
    if (outline) {
      // Bounded by a linked model's wall somewhere: drawn from the outline found, and it says where it came from.
      return {
        type: 'create_space',
        spaces: [{ spaceId: newElementId('space'), number, name, levelId, outline: outline.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) })), origin: { kind: 'detected', detector: LINKED_WALL_ROOM_DETECTOR_ID, confidence: 1, accepted: true } }],
      }
    }
    return { type: 'place_space_in_walls' as const, spaceId: newElementId('space'), levelId, seed: { x: Math.round(seed.x), y: Math.round(seed.y) }, number, name }
  })
  return {
    type: 'batch_edits',
    label: accepted.length === 1 ? t('spaces.addARoomFoundFromWalls', 'Add a room found from walls', { ns: 'editor' }) : t('spaces.addRoomsFoundFromWalls', 'Add {{count}} rooms found from walls', { ns: 'editor', count: accepted.length }),
    commands,
  }
}
