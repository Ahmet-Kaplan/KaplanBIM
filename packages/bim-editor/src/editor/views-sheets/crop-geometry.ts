import { DEFAULT_ANNOTATION_CROP_OFFSET_MM, type Rect, type Vec2, type ViewProps } from '@permitzip/bim-kernel'
import type { Translate } from '../i18n/translate'

/** A view prints at 1/4" = 1'-0" until its scale is set (View properties › Scale). */
const DEFAULT_VIEW_SCALE = 48

/**
 * How far notes, tags and dimensions may reach when the view's annotation
 * crop is on: the crop box grown by the offset on paper, in the crop's own
 * frame (model mm). Null when the annotation crop is off. The drawing clips
 * notes to exactly this (`drawing/views.ts` painter noteMin / noteMax).
 */
export function annotationCropRect(crop: Rect, props: Pick<ViewProps, 'annotationCrop' | 'annotationCropOffsetMm' | 'scale'> | undefined): Rect | null {
  if (props?.annotationCrop !== true) return null
  const reach = (props.annotationCropOffsetMm ?? DEFAULT_ANNOTATION_CROP_OFFSET_MM) * (props.scale ?? DEFAULT_VIEW_SCALE)
  return { min: { x: crop.min.x - reach, y: crop.min.y - reach }, max: { x: crop.max.x + reach, y: crop.max.y + reach } }
}

/** A crop box grip: an edge, a corner, or the whole box. */
export type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const CROP_HANDLES: readonly CropHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

/** What part of the crop box a grip holds, in the language on screen. */
export function handleLabel(handle: CropHandle, t: Translate): string {
  switch (handle) {
    case 'n':
      return t('crop3d.handle.top', 'top edge', { ns: 'editor' })
    case 's':
      return t('crop3d.handle.bottom', 'bottom edge', { ns: 'editor' })
    case 'e':
      return t('crop3d.handle.right', 'right edge', { ns: 'editor' })
    case 'w':
      return t('crop3d.handle.left', 'left edge', { ns: 'editor' })
    case 'ne':
      return t('crop3d.handle.topRight', 'top-right corner', { ns: 'editor' })
    case 'nw':
      return t('crop3d.handle.topLeft', 'top-left corner', { ns: 'editor' })
    case 'se':
      return t('crop3d.handle.bottomRight', 'bottom-right corner', { ns: 'editor' })
    case 'sw':
      return t('crop3d.handle.bottomLeft', 'bottom-left corner', { ns: 'editor' })
  }
}

export const HANDLE_CURSOR: Record<CropHandle, string> = {
  n: 'cursor-ns-resize',
  s: 'cursor-ns-resize',
  e: 'cursor-ew-resize',
  w: 'cursor-ew-resize',
  ne: 'cursor-nesw-resize',
  sw: 'cursor-nesw-resize',
  nw: 'cursor-nwse-resize',
  se: 'cursor-nwse-resize',
}

/**
 * Where each grip sits on a rectangle. `yUp`: model frames (north is +y);
 * paper and screen frames have y down, so "top" is the smaller y.
 */
export function handlePoint(rect: Rect, handle: CropHandle, yUp: boolean): Vec2 {
  const top = yUp ? rect.max.y : rect.min.y
  const bottom = yUp ? rect.min.y : rect.max.y
  const cx = (rect.min.x + rect.max.x) / 2
  const cy = (rect.min.y + rect.max.y) / 2
  const x = handle.includes('e') ? rect.max.x : handle.includes('w') ? rect.min.x : cx
  const y = handle.startsWith('n') ? top : handle.startsWith('s') ? bottom : cy
  return { x, y }
}

/**
 * The rectangle after dragging one grip by `delta` (in the rectangle's own
 * frame). Edges never cross: each side keeps at least `minSize` from the
 * opposite one.
 */
export function dragRect(rect: Rect, handle: CropHandle, delta: Vec2, minSize: number, yUp: boolean): Rect {
  let { x: x0, y: y0 } = rect.min
  let { x: x1, y: y1 } = rect.max
  if (handle.includes('e')) x1 = Math.max(x0 + minSize, x1 + delta.x)
  if (handle.includes('w')) x0 = Math.min(x1 - minSize, x0 + delta.x)
  const movesTop = handle.startsWith('n')
  const movesBottom = handle.startsWith('s')
  // The y side a grip moves: top is max.y when y is up, min.y when y is down.
  const movesMaxY = yUp ? movesTop : movesBottom
  const movesMinY = yUp ? movesBottom : movesTop
  if (movesMaxY) y1 = Math.max(y0 + minSize, y1 + delta.y)
  if (movesMinY) y0 = Math.min(y1 - minSize, y0 + delta.y)
  return { min: { x: x0, y: y0 }, max: { x: x1, y: y1 } }
}

/** A paper rectangle as the viewport centre and size the kernel takes. */
export function centerAndSize(rect: Rect): { center: Vec2; size: Vec2 } {
  return {
    center: { x: (rect.min.x + rect.max.x) / 2, y: (rect.min.y + rect.max.y) / 2 },
    size: { x: rect.max.x - rect.min.x, y: rect.max.y - rect.min.y },
  }
}

export function rectFromCenter(center: Vec2, size: Vec2): Rect {
  return { min: { x: center.x - size.x / 2, y: center.y - size.y / 2 }, max: { x: center.x + size.x / 2, y: center.y + size.y / 2 } }
}

/** Feet with up to two decimals, for the crop box fields. */
export function feet(mm: number): string {
  return (mm / 304.8).toFixed(2).replace(/\.?0+$/, '')
}
