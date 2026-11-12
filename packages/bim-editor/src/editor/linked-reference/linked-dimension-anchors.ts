import { linkedElementKey, viewModelLevel, REFERENCE_PLAN_HEIGHT_MM, type AnchorName, type LinkedReferenceIndex, type ModelState, type Vec2, type ViewElement } from '@permitzip/bim-kernel'
import { anchorWord, type SnapPoint } from '../views-sheets/annotation-tools'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * The points a dimension can follow on a linked model's elements in a plan:
 * each long, thin element's two faces, centre line and ends; anything else
 * its middle. The reference is the linked element's key and an anchor name,
 * so the dimension follows the element by its GlobalId when the link updates
 * (the kernel's `resolveLinkedAnchor`). Plans only: sections keep the clicked
 * point.
 *
 * The label is read out in the snap chip ("Snaps to the {{what}}" — `canvas.snapsTo`),
 * so it is keyed: the noun a pack gives its rule is data, the way an element's kind is
 * in `dimension.snapAnchor`, and the words around it are ours.
 */
/**
 * The noun a pack gives its snap rule, in the language on screen.
 *
 * Six cases, because those are the nouns the packs ship (`bim-pack-mechanical`,
 * `-structural`; the architecture entities fall back to `nounOfIfcEntity`). An
 * entity no pack names keeps the exporter's own noun, the way an add-on's own
 * clearance purpose keeps its pack's words: the id is data, the frame is ours.
 */
export function linkedNounWord(noun: string, t: Translate): string {
  switch (noun) {
    case 'wall':
      return t('linkedRef.nounWall', 'wall', { ns: 'editor' })
    case 'window':
      return t('linkedRef.nounWindow', 'window', { ns: 'editor' })
    case 'door':
      return t('linkedRef.nounDoor', 'door', { ns: 'editor' })
    case 'roof':
      return t('linkedRef.nounRoof', 'roof', { ns: 'editor' })
    case 'column':
      return t('linkedRef.nounColumn', 'column', { ns: 'editor' })
    case 'beam':
    case 'member':
      return t('linkedRef.nounBeam', 'beam', { ns: 'editor' })
    default:
      return noun
  }
}

export function linkedDimensionAnchors(
  index: LinkedReferenceIndex,
  model: ModelState,
  view: ViewElement,
  toPaper: (p: Vec2) => Vec2,
  t: Translate = englishOnly,
): SnapPoint[] {
  if (view.viewType === 'section' || view.viewType === 'detail') return []
  const level = viewModelLevel(model, view.props?.level, view.props?.levelElevationMm)
  if (!level) return []
  const z = level.elevationMm + REFERENCE_PLAN_HEIGHT_MM
  const out: SnapPoint[] = []
  const push = (key: string, anchor: AnchorName, at: Vec2, label: string) => out.push({ ref: { elementId: key, anchor }, at: toPaper(at), label })
  /** `linked wall face`, `linked wall centre line`: one frame, the pack's noun as data. */
  const linked = (noun: string, where: string): string => t('dimension.snapLinked', 'linked {{what}} {{where}}', { ns: 'editor', what: noun, where })
  // `end` and `middle` are the words a dimension already uses for our own elements'
  // snap points: one word table (`anchorWord`), not a second copy of it.
  const face = t('dimension.anchor.face', 'face', { ns: 'editor' })
  const centreLine = t('dimension.anchor.centreLine', 'centre line', { ns: 'editor' })
  const middle = anchorWord('mid', t)
  const end = anchorWord('start', t)
  for (const item of index.items) {
    if (!item.rule.snap || z < item.minZ || z > item.maxZ) continue
    const key = linkedElementKey(item.ref)
    const noun = linkedNounWord(item.rule.noun, t)
    if (item.line) {
      const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      push(key, 'edge_left', mid(item.line.faces[0].start, item.line.faces[0].end), linked(noun, face))
      push(key, 'edge_right', mid(item.line.faces[1].start, item.line.faces[1].end), linked(noun, face))
      push(key, 'mid', mid(item.line.axis.start, item.line.axis.end), linked(noun, centreLine))
      push(key, 'start', item.line.axis.start, linked(noun, end))
      push(key, 'end', item.line.axis.end, linked(noun, end))
    } else {
      let x = 0
      let y = 0
      for (const p of item.outline) {
        x += p.x
        y += p.y
      }
      push(key, 'center', { x: x / item.outline.length, y: y / item.outline.length }, linked(noun, middle))
    }
  }
  return out
}
