/**
 * The Architecture tools: what each draws and how it is drawn. The order is
 * the Build group's: the most used first, so they stay visible and the rest
 * fold under More.
 *
 * The three words a tool says (`label`, `description`, `noun`) are accessors
 * taking a translator, not strings: the ribbon's button and tooltip and the hint
 * bar write them in the language being drawn, and English reads character for
 * character as it did. `id`, `mode`, `kind` and `shortcut` stay data.
 */
import type { Translate } from '../../i18n/translate'

export type ArchitectureToolId = 'level' | 'grid' | 'reference_plane' | 'wall' | 'wall_rectangle' | 'door' | 'window' | 'floor' | 'room' | 'opening' | 'ceiling' | 'roof' | 'column' | 'stair'

/** `room`: click inside closed walls (a space bounded by them). `rectangle`: two opposite corners make a closed chain of four. */
export type ToolMode = 'chain' | 'rectangle' | 'line' | 'area' | 'point' | 'hosted' | 'room' | 'dialog'

export interface ArchitectureTool {
  readonly id: ArchitectureToolId
  readonly label: (t: Translate) => string
  readonly description: (t: Translate) => string
  readonly mode: ToolMode
  /** The record kind it makes (`create_element`'s kind; `ceiling` uses its own command). */
  readonly kind: string
  /** What the hint bar calls one. */
  readonly noun: (t: Translate) => string
  /** Two-key tip, also shown in search. */
  readonly shortcut?: string
}

export const DATUM_TOOLS: readonly ArchitectureTool[] = [
  {
    id: 'level',
    label: (t) => t('architecture.tool.level', 'Level', { ns: 'editor' }),
    description: (t) => t('architecture.tool.levelWhy', 'Add a level at a height', { ns: 'editor' }),
    mode: 'dialog',
    kind: 'level',
    noun: (t) => t('architecture.noun.level', 'level', { ns: 'editor' }),
  },
  {
    id: 'grid',
    label: (t) => t('architecture.tool.grid', 'Grid', { ns: 'editor' }),
    description: (t) => t('architecture.tool.gridWhy', 'Draw a grid line; labels go A, B, C… and 1, 2, 3… by themselves', { ns: 'editor' }),
    mode: 'line',
    kind: 'grid',
    noun: (t) => t('architecture.noun.gridLine', 'grid line', { ns: 'editor' }),
    shortcut: 'G R',
  },
  {
    id: 'reference_plane',
    label: (t) => t('architecture.tool.referencePlane', 'Reference plane', { ns: 'editor' }),
    description: (t) => t('architecture.tool.referencePlaneWhy', 'Draw a named line to snap to on this level', { ns: 'editor' }),
    mode: 'line',
    kind: 'reference_plane',
    noun: (t) => t('architecture.noun.referencePlane', 'reference plane', { ns: 'editor' }),
  },
]

export const BUILD_TOOLS: readonly ArchitectureTool[] = [
  {
    id: 'wall',
    label: (t) => t('architecture.tool.wall', 'Wall', { ns: 'editor' }),
    description: (t) => t('architecture.tool.wallWhy', 'Draw walls corner to corner; they join where they meet', { ns: 'editor' }),
    mode: 'chain',
    kind: 'wall',
    noun: (t) => t('architecture.noun.wall', 'wall', { ns: 'editor' }),
    shortcut: 'W W',
  },
  {
    id: 'door',
    label: (t) => t('architecture.tool.door', 'Door', { ns: 'editor' }),
    description: (t) => t('architecture.tool.doorWhy', 'Put a door in a wall', { ns: 'editor' }),
    mode: 'hosted',
    kind: 'door',
    noun: (t) => t('architecture.noun.door', 'door', { ns: 'editor' }),
    shortcut: 'D R',
  },
  {
    id: 'window',
    label: (t) => t('architecture.tool.window', 'Window', { ns: 'editor' }),
    description: (t) => t('architecture.tool.windowWhy', 'Put a window in a wall', { ns: 'editor' }),
    mode: 'hosted',
    kind: 'window',
    noun: (t) => t('architecture.noun.window', 'window', { ns: 'editor' }),
    shortcut: 'W N',
  },
  {
    id: 'floor',
    label: (t) => t('architecture.tool.floor', 'Floor', { ns: 'editor' }),
    description: (t) => t('architecture.tool.floorWhy', 'Click inside walls to fill the room with a floor, or click its corners', { ns: 'editor' }),
    mode: 'area',
    kind: 'slab',
    noun: (t) => t('architecture.noun.floor', 'floor', { ns: 'editor' }),
  },
  {
    id: 'room',
    label: (t) => t('architecture.tool.room', 'Room', { ns: 'editor' }),
    description: (t) => t('architecture.tool.roomWhy', 'Click inside walls to make a room bounded by them', { ns: 'editor' }),
    mode: 'room',
    kind: 'space',
    noun: (t) => t('architecture.noun.room', 'room', { ns: 'editor' }),
  },
  {
    id: 'opening',
    label: (t) => t('architecture.tool.opening', 'Opening', { ns: 'editor' }),
    description: (t) => t('architecture.tool.openingWhy', 'Cut a plain opening in a wall', { ns: 'editor' }),
    mode: 'hosted',
    kind: 'opening',
    noun: (t) => t('architecture.noun.opening', 'opening', { ns: 'editor' }),
  },
  {
    id: 'ceiling',
    label: (t) => t('architecture.tool.ceiling', 'Ceiling', { ns: 'editor' }),
    description: (t) => t('architecture.tool.ceilingWhy', 'Draw a ceiling by its corners', { ns: 'editor' }),
    mode: 'area',
    kind: 'ceiling',
    noun: (t) => t('architecture.noun.ceiling', 'ceiling', { ns: 'editor' }),
  },
  {
    id: 'roof',
    label: (t) => t('architecture.tool.roof', 'Roof', { ns: 'editor' }),
    description: (t) => t('architecture.tool.roofWhy', 'Draw a roof by its footprint', { ns: 'editor' }),
    mode: 'area',
    kind: 'architecture.roof',
    noun: (t) => t('architecture.noun.roof', 'roof', { ns: 'editor' }),
  },
  {
    id: 'column',
    label: (t) => t('architecture.tool.column', 'Column', { ns: 'editor' }),
    description: (t) => t('architecture.tool.columnWhy', 'Place a column', { ns: 'editor' }),
    mode: 'point',
    kind: 'column',
    noun: (t) => t('architecture.noun.column', 'column', { ns: 'editor' }),
  },
  {
    id: 'stair',
    label: (t) => t('architecture.tool.stair', 'Stair', { ns: 'editor' }),
    description: (t) => t('architecture.tool.stairWhy', 'Draw a straight stair from its foot to its top', { ns: 'editor' }),
    mode: 'line',
    kind: 'architecture.stair',
    noun: (t) => t('architecture.noun.stair', 'stair', { ns: 'editor' }),
  },
  {
    id: 'wall_rectangle',
    label: (t) => t('architecture.tool.wallRectangle', 'Rectangle walls', { ns: 'editor' }),
    description: (t) => t('architecture.tool.wallRectangleWhy', 'Click two opposite corners: four walls, joined at every corner', { ns: 'editor' }),
    mode: 'rectangle',
    kind: 'wall',
    noun: (t) => t('architecture.noun.wall', 'wall', { ns: 'editor' }),
  },
]

export const ARCHITECTURE_TOOLS: readonly ArchitectureTool[] = [...DATUM_TOOLS, ...BUILD_TOOLS]

export function toolById(id: string): ArchitectureTool | undefined {
  return ARCHITECTURE_TOOLS.find((t) => t.id === id)
}
