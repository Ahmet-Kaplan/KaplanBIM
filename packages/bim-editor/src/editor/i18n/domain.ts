import { DOMAIN_NAMESPACE, translateDomainLabel } from '@permitzip/bim-ui'
import { useMemo } from 'react'
import { englishOnly, useEditorTranslate, type Translate } from './translate'

/**
 * The editor's side of the domain map: a discipline's own label ("Electrical"),
 * a pack's trade name, a quantity kind, drawn in the host's language.
 *
 * Those words are *data* — they come from `ADDON_UI` and from the kernel's
 * discipline registry, and spec §7/Ç-B keeps them in English in the packs so a
 * pack file never differs from upstream. The translation therefore happens here,
 * where the label is drawn: `packages/bim-ui/locales/tr/domain.json`, through
 * `translateDomainLabel`, which hands back the English label for a word nobody
 * has translated yet.
 *
 * The namespace is named here rather than at each call site: an editor `Translate`
 * carries its own namespace per call (`{ ns: 'editor' }`), and a label reached
 * through a map would otherwise come back as a `domain.…` key with no English
 * beside it.
 */
export function domainLabelOf(t: Translate): (label: string) => string {
  return (label: string) => translateDomainLabel(label, (key, english) => t(key, english, { ns: DOMAIN_NAMESPACE }))
}

/** `domainLabelOf` over the editor's own translator, for a component. */
export function useDomainLabelOf(): (label: string) => string {
  const t = useEditorTranslate()
  return useMemo(() => domainLabelOf(t), [t])
}

/** The English-only `domainLabelOf`, for a builder whose host passed no translator. */
export const domainLabelInEnglish: (label: string) => string = domainLabelOf(englishOnly)
