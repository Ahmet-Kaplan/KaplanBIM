import type { LineWeight, ReferenceDisplayPreset } from '@permitzip/bim-kernel'
import type { Translate } from '../i18n/translate'

/**
 * The words a linked model's display is described with, each as a literal `t()`
 * call.
 *
 * Four tables used to hold them in English (`PRESET_HINT`, `PEN_LABEL`,
 * `CATEGORY_CHOICE_LABEL`, the category list) and the kernel's
 * `REFERENCE_PRESET_LABEL` was spliced into the panels and the undo labels. A table
 * of `{ key, english }` behind a variable is invisible to `npm run i18n:review`
 * (the same reason `plumbing-words.ts` writes accessors), and the kernel's English
 * in a Turkish frame reads half-translated. So every word here is a `switch` of
 * literal calls, and the undo labels compose them rather than the kernel's data.
 *
 * A category or a line weight the model gains later falls back to its own id — data,
 * the way an add-on's own clearance purpose stays its pack's words.
 */

/** What each one-click look does, in the language on screen. */
export function presetHint(preset: ReferenceDisplayPreset | 'custom', t: Translate): string {
  switch (preset) {
    case 'normal':
      return t('linkedDisplay.hintNormal', 'Full colour and linework, as the architect drew it.', { ns: 'editor' })
    case 'halftone':
      return t('linkedDisplay.hintHalftone', 'Lighter grey linework; slightly see-through in 3D.', { ns: 'editor' })
    case 'transparent':
      return t('linkedDisplay.hintTransparent', 'Grey and well see-through in 3D, so your work shows behind it.', { ns: 'editor' })
    case 'underlay':
      return t(
        'linkedDisplay.hintUnderlay',
        'Faint, and your work draws over it: lighter than halftone on paper, mostly see-through in 3D.',
        { ns: 'editor' },
      )
    case 'hidden':
      return t('linkedDisplay.hintHidden', 'Not drawn, printed or pickable in this view. The link stays; pick another look to bring it back.', {
        ns: 'editor',
      })
    case 'custom':
      return t('linkedDisplay.hintCustom', 'Set by hand below (see-through amount or categories).', { ns: 'editor' })
  }
}

/** The look's own name (`Normal`, `Halftone` …), where the kernel's `REFERENCE_PRESET_LABEL` used to be read. */
export function presetWord(preset: ReferenceDisplayPreset | 'custom', t: Translate): string {
  switch (preset) {
    case 'normal':
      return t('linkedDisplay.presetNormal', 'Normal', { ns: 'editor' })
    case 'halftone':
      return t('linkedDisplay.presetHalftone', 'Halftone', { ns: 'editor' })
    case 'transparent':
      return t('linkedDisplay.presetTransparent', 'See-through', { ns: 'editor' })
    case 'underlay':
      return t('linkedDisplay.presetUnderlay', 'Underlay', { ns: 'editor' })
    case 'hidden':
      return t('linkedDisplay.presetHidden', 'Hidden', { ns: 'editor' })
    case 'custom':
      return t('linkedDisplay.presetCustom', 'Custom', { ns: 'editor' })
  }
}

/** A pen's weight, in the Select that sets a drawing's cut and below-the-cut lines. */
export function penWord(weight: LineWeight, t: Translate): string {
  switch (weight) {
    case 'thin':
      return t('linkedDisplay.penThin', 'Thin', { ns: 'editor' })
    case 'medium':
      return t('linkedDisplay.penMedium', 'Medium', { ns: 'editor' })
    case 'wide':
      return t('linkedDisplay.penWide', 'Wide', { ns: 'editor' })
    case 'heavy':
      return t('linkedDisplay.penHeavy', 'Heavy', { ns: 'editor' })
  }
}

/** The two linework sides a drawing can set a pen for, as the pen Select's accessible name says them. */
export function lineSideWord(kind: 'cut' | 'beyond', t: Translate): string {
  return kind === 'cut'
    ? t('linkedDisplay.sideCut', 'cut', { ns: 'editor' })
    : t('linkedDisplay.sideBelowCut', 'below the cut', { ns: 'editor' })
}

/** The same two sides as the undo label says them ("… 's cut line weight", "… 's beyond line weight"). */
export function penSideWord(kind: 'cut' | 'beyond', t: Translate): string {
  return kind === 'cut'
    ? t('linkedDisplay.penSideCut', 'cut', { ns: 'editor' })
    : t('linkedDisplay.penSideBeyond', 'beyond', { ns: 'editor' })
}

/** A category's name as the list titles it (`Walls`, `Ceilings and finishes`). */
export function categoryListWord(category: string, t: Translate): string {
  switch (category) {
    case 'IFCWALL':
      return t('linkedDisplay.categoriesWalls', 'Walls', { ns: 'editor' })
    case 'IFCDOOR':
      return t('linkedDisplay.categoriesDoors', 'Doors', { ns: 'editor' })
    case 'IFCWINDOW':
      return t('linkedDisplay.categoriesWindows', 'Windows', { ns: 'editor' })
    case 'IFCSLAB':
      return t('linkedDisplay.categoriesFloors', 'Floors', { ns: 'editor' })
    case 'IFCROOF':
      return t('linkedDisplay.categoriesRoofs', 'Roofs', { ns: 'editor' })
    case 'IFCCOVERING':
      return t('linkedDisplay.categoriesCoverings', 'Ceilings and finishes', { ns: 'editor' })
    case 'IFCCOLUMN':
      return t('linkedDisplay.categoriesColumns', 'Columns', { ns: 'editor' })
    case 'IFCFURNISHINGELEMENT':
      return t('linkedDisplay.categoriesFurniture', 'Furniture', { ns: 'editor' })
    default:
      return categoryNounOfId(category)
  }
}

/** "IFCWALL" → "walls": what an undo label names, the shape `categoryNoun` gave the screen before. */
function categoryNounOfId(category: string): string {
  return `${category.replace(/^IFC/u, '').toLowerCase()}s`
}

/** The noun an undo label uses ("change how Sample draws its walls"). */
export function categoryNounWord(category: string, t: Translate): string {
  switch (category) {
    case 'IFCWALL':
      return t('linkedDisplay.undoNounWalls', 'walls', { ns: 'editor' })
    case 'IFCDOOR':
      return t('linkedDisplay.undoNounDoors', 'doors', { ns: 'editor' })
    case 'IFCWINDOW':
      return t('linkedDisplay.undoNounWindows', 'windows', { ns: 'editor' })
    case 'IFCSLAB':
      return t('linkedDisplay.undoNounSlabs', 'slabs', { ns: 'editor' })
    case 'IFCROOF':
      return t('linkedDisplay.undoNounRoofs', 'roofs', { ns: 'editor' })
    case 'IFCCOVERING':
      return t('linkedDisplay.undoNounCoverings', 'coverings', { ns: 'editor' })
    case 'IFCCOLUMN':
      return t('linkedDisplay.undoNounColumns', 'columns', { ns: 'editor' })
    case 'IFCFURNISHINGELEMENT':
      return t('linkedDisplay.undoNounFurnishingElements', 'furnishingelements', { ns: 'editor' })
    default:
      return categoryNounOfId(category)
  }
}

/** One category's own choice in its Select. */
export function categoryChoiceWord(choice: 'follow' | 'halftone' | 'ink' | 'hidden', t: Translate): string {
  switch (choice) {
    case 'follow':
      return t('linkedDisplay.choiceFollow', 'Like the model', { ns: 'editor' })
    case 'halftone':
      return t('linkedDisplay.choiceHalftone', 'Halftone', { ns: 'editor' })
    case 'ink':
      return t('linkedDisplay.choiceInk', 'Full colour', { ns: 'editor' })
    case 'hidden':
      return t('linkedDisplay.choiceHidden', 'Hidden', { ns: 'editor' })
  }
}
