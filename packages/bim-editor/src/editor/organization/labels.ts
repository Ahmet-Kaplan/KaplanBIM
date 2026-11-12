import type { GroupVisibility, PhaseDisplay, PhaseStatus } from '@permitzip/bim-kernel'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * Operator words for groups, phases and phase filters, shared by every
 * organization control.
 *
 * Each is an **accessor taking a translator**, not a table of English strings:
 * a `Record<GroupVisibility, string>` drawn inside a keyed frame is how English
 * shipped under a Turkish caption before. The default is `englishOnly`, so a
 * caller with no host language reads exactly the words it read before.
 */

/** Show / halftone / hide, the three ways a group or phase can draw (§5.2: yarım ton). */
export function groupVisibilityLabel(visibility: GroupVisibility, t: Translate = englishOnly): string {
  switch (visibility) {
    case 'show':
      return t('org.visibility.show', 'Show', { ns: 'editor' })
    case 'halftone':
      return t('org.visibility.halftone', 'Halftone', { ns: 'editor' })
    case 'hide':
      return t('org.visibility.hide', 'Hide', { ns: 'editor' })
  }
}

/** What a phase filter does to one status: show, halftone, dashed or hide. */
export function phaseDisplayLabel(display: PhaseDisplay, t: Translate = englishOnly): string {
  switch (display) {
    case 'show':
      return t('org.visibility.show', 'Show', { ns: 'editor' })
    case 'halftone':
      return t('org.visibility.halftone', 'Halftone', { ns: 'editor' })
    case 'dashed':
      return t('org.phaseDisplay.dashed', 'Dashed', { ns: 'editor' })
    case 'hide':
      return t('org.visibility.hide', 'Hide', { ns: 'editor' })
  }
}

/** A phase status's name and the one line that explains it, in the reader's language. */
export function phaseStatusLabel(status: PhaseStatus, t: Translate = englishOnly): { readonly label: string; readonly hint: string } {
  switch (status) {
    case 'new':
      return {
        label: t('org.phaseStatus.new', 'New', { ns: 'editor' }),
        hint: t('org.phaseStatus.newHint', 'Built in the phase the view shows', { ns: 'editor' }),
      }
    case 'existing':
      return {
        label: t('org.phaseStatus.existing', 'Existing', { ns: 'editor' }),
        hint: t('org.phaseStatus.existingHint', 'Built in an earlier phase and still there', { ns: 'editor' }),
      }
    case 'demolished':
      return {
        label: t('org.phaseStatus.demolished', 'Demolished', { ns: 'editor' }),
        hint: t('org.phaseStatus.demolishedHint', 'Removed in the phase the view shows', { ns: 'editor' }),
      }
    case 'temporary':
      return {
        label: t('org.phaseStatus.temporary', 'Temporary', { ns: 'editor' }),
        hint: t('org.phaseStatus.temporaryHint', 'Built and removed in the phase the view shows', { ns: 'editor' }),
      }
  }
}

/**
 * Where the organization lists live, as a path people can follow (§2.3: *Manage*
 * is **Yönet**, *Groups & phases* **Gruplar ve fazlar**).
 *
 * One key rather than `Manage` + `›` + `Groups & phases`: a breadcrumb is a place
 * in the app, and a verb glued to a translated noun is the defect that shipped
 * "Collapse Özellikler".
 */
export function managePath(t: Translate = englishOnly): string {
  return t('org.managePath', 'Manage › Groups & phases', { ns: 'editor' })
}
