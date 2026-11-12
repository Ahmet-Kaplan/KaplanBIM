import { definitionTypes, type Command, type PartTypeDefinition, type Vec2 } from '@permitzip/bim-kernel'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * Model in place: the part editor opened for a new part at a spot clicked in
 * the project. The first save adds its types to the project and places one
 * at that spot, as one edit (one revision, one undo). Later saves in the same
 * window only update the type; Save to library in the editor makes it a
 * reusable part.
 */
export interface InPlaceSpot {
  readonly levelId: string
  /** The level's name, for the words ("Level 1"). */
  readonly levelName: string
  /** Plan point on that level, model mm. */
  readonly at: Vec2
}

/** Where the part goes, in words for the editor and the hint bar (§2.3: a storey is a **kat**). */
export function inPlaceWords(spot: InPlaceSpot, t: Translate = englishOnly): string {
  return t('partEditor.inPlace.theSpot', 'the spot you clicked on {{level}}', { ns: 'editor', level: spot.levelName })
}

/** The edit that saves the part and places it at the spot; a refusal in words when it can't be built. */
export function modelInPlaceCommand(definition: PartTypeDefinition, spot: InPlaceSpot, partId: string, t: Translate = englishOnly): Command | string {
  let types: ReturnType<typeof definitionTypes>
  try {
    types = definitionTypes(definition)
  } catch (err) {
    console.error('[model-in-place] the sizes table cannot be saved', err)
    return err instanceof Error ? err.message : t('partEditor.inPlace.noSizes', 'The sizes table can’t be saved', { ns: 'editor' })
  }
  const first = types[0]
  if (!first) return t('partEditor.inPlace.noType', 'The part has no type to place. Give it a type name and save again.', { ns: 'editor' })
  const name = definition.familyName.trim() || first.definition.typeName
  return {
    type: 'batch_edits',
    label: t('partEditor.inPlace.modelInPlace', 'Model {{name}} in place', { ns: 'editor', name }),
    commands: [
      { type: 'save_part_types', label: t('partEditor.inPlace.saveNamed', 'Save {{name}}', { ns: 'editor', name }), types },
      { type: 'place_part', partId, typeId: first.typeId, levelId: spot.levelId, position: { x: spot.at.x, y: spot.at.y } },
    ],
  }
}
