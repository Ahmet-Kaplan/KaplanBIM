/**
 * The orientation controls' own words, in one place.
 *
 * `OrientationBall` and `OrientationControls` draw each other's labels (the ball's
 * dots are named by `sideLabel`, the menu lists the same six sides), so the
 * vocabulary lives here rather than in either component: a component importing
 * its sibling for a word made the two files a runtime import cycle, and
 * `packages/bim-kernel/src/__tests__/import-layers.test.ts` fails on a new one.
 */
import { SIDE_LABEL, type Side } from '@permitzip/bim-viewer-3d/light'
import type { Translate } from '../i18n/translate'

/** A side of the model, in the language on screen: the viewer's own label is English. */
export function sideLabel(side: Side, t: Translate): string {
  switch (side) {
    case 'top':
      return t('orientation.side.top', 'Top', { ns: 'editor' })
    case 'bottom':
      return t('orientation.side.bottom', 'Bottom', { ns: 'editor' })
    case 'north':
      return t('orientation.side.north', 'North', { ns: 'editor' })
    case 'south':
      return t('orientation.side.south', 'South', { ns: 'editor' })
    case 'east':
      return t('orientation.side.east', 'East', { ns: 'editor' })
    case 'west':
      return t('orientation.side.west', 'West', { ns: 'editor' })
    default:
      return SIDE_LABEL[side]
  }
}
