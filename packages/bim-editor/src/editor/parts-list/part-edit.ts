import { partGroupName } from '@permitzip/bim-kernel'
import type { CatalogEntry } from '../model-session'
import { editableInPartEditor } from '../part-editor/draft'
import { englishOnly, type Translate } from '../i18n/translate'

/** Why a part's type can't open in the part editor, in plain words; null when it can. */
export function partEditBlockedReason(entry: CatalogEntry, canEdit: boolean, t: Translate = englishOnly): string | null {
  const name = partGroupName(entry.definition)
  if (!canEdit) return t('partsList.cantEditParts', "You can't change parts in this model, so {{name}} can't open in the part editor.", { ns: 'editor', name })
  if (entry.definition.model === undefined)
    return t('partsList.simpleShape', '{{name}} is a simple shape with no part drawing to open. Use New part to draw your own.', { ns: 'editor', name })
  if (!editableInPartEditor(entry.definition)) return t('partsList.scriptMade', '{{name}} is made by a script: run its script again to change it.', { ns: 'editor', name })
  return null
}
