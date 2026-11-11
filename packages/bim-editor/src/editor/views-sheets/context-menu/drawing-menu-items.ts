import { elementsOfKind, elementViewCategory, VIEW_CATEGORY_LABELS, viewLevelElements, type BimElement, type ModelState, type ViewCategory, type ViewElement } from '@permitzip/bim-kernel'
import { similarStartFor } from '../../create-similar'
import { englishOnly, type Translate } from '../../i18n/translate'

/**
 * Right-click on a printed drawing or a sheet (the product owner, C6: "Right-click also
 * isn't supported yet"). What was under the pointer decides the menu; every
 * item is an operation the model already has. Pure, so the menu is tested
 * without a canvas.
 */

/** What the right-click landed on. */
export type DrawingMenuTarget =
  | { readonly kind: 'element'; readonly elementId: string }
  | { readonly kind: 'viewport'; readonly viewportId: string; readonly view: ViewElement }
  | { readonly kind: 'paper' }

export type DrawingMenuAction = 'properties' | 'select_like' | 'hide_in_view' | 'create_similar' | 'zoom_fit' | 'open_view' | 'remove_from_sheet' | 'add_view'

export interface DrawingMenuItem {
  readonly id: DrawingMenuAction
  readonly label: string
  /** A short line under the label saying what it will do. */
  readonly hint?: string
  /** Set when the item can't run here, in the person's words; the item shows greyed with this reason. */
  readonly disabledReason?: string
  /** Asks first (taking a view off a sheet). */
  readonly confirm?: { readonly title: string; readonly description: string; readonly confirmLabel: string }
  /** Starts a new group (a separator above it). */
  readonly groupStart?: boolean
}

export interface DrawingMenu {
  readonly title: string
  readonly items: readonly DrawingMenuItem[]
}

export interface DrawingMenuContext {
  readonly model: ModelState
  /** The drawing the right-click was in (the open plan or section, or the view being edited on the sheet); null on bare sheet paper. */
  readonly view: ViewElement | null
  readonly onSheet: boolean
  readonly canEdit: boolean
  readonly blockedReason: string
  /** Model selection works in this drawing (the surface passed its edit bridge). */
  readonly canSelect: boolean
  /** The surface handles Create similar from a drawing. */
  readonly canCreateSimilar: boolean
  /** The surface can place a view on this sheet from a list. */
  readonly canAddView: boolean
}

const selectUnavailable = (t: Translate): string =>
  t('drawing.selectUnavailable', "Selecting from this drawing isn't available here. Open the plan or section to select.", { ns: 'editor' })
const createSimilarUnavailable = (t: Translate): string =>
  t('drawing.createSimilarUnavailable', "Create similar can't start from this drawing yet. Select it in the 3D view and press C then S.", { ns: 'editor' })
const addViewHow = (t: Translate): string =>
  t('drawing.addViewHow', 'Drag a view or schedule from Views and sheets onto the sheet to place it.', { ns: 'editor' })

function live(el: BimElement | undefined): el is BimElement {
  return el !== undefined && !('deleted' in el && el.deleted)
}

/**
 * The element a right-click acts on, from what was under the pointer (nearest
 * first). A placed part wins over whatever touches it (the short piece into
 * its connection), so the menu acts on the whole part.
 */
export function menuElementOf(model: ModelState, ids: readonly string[]): BimElement | null {
  const found = ids.map((id) => model.elements[id]).filter(live)
  return found.find((el) => el.kind === 'part') ?? found[0] ?? null
}

/** Ids drawn in this view that are like `el`: a part's same type; anything else, the same kind (and the same domain for routed pieces). */
export function likeThisIds(model: ModelState, view: ViewElement | null, el: BimElement): string[] {
  const pool: readonly BimElement[] = view ? viewLevelElements(model, view) : elementsOfKind(model.elements, el.kind)
  const domainOf = (e: BimElement): string | null => ('domain' in e && typeof e.domain === 'string' ? e.domain : null)
  return pool
    .filter(live)
    .filter((e) => (el.kind === 'part' ? e.kind === 'part' && e.typeId === el.typeId : e.kind === el.kind && domainOf(e) === domainOf(el)))
    .map((e) => e.id)
}

/** Hide in view: the element's category added to the view's hidden categories; null when it has none this view can hide. */
export function hideInViewPatch(model: ModelState, view: ViewElement, el: BimElement): { readonly category: ViewCategory; readonly label: string; readonly hiddenCategories: readonly ViewCategory[] } | null {
  const category = elementViewCategory(model.elements, el)
  if (!category) return null
  const hidden = view.props?.hiddenCategories ?? []
  return { category, label: VIEW_CATEGORY_LABELS[category], hiddenCategories: hidden.includes(category) ? hidden : [...hidden, category] }
}

/** The element in words, for the menu's title ("SD-9", a part's type name, or its category). */
export function elementTitle(model: ModelState, el: BimElement, t: Translate): string {
  if ('mark' in el && typeof el.mark === 'string' && el.mark) return el.mark
  if (el.kind === 'part') {
    const type = model.elements[el.typeId]
    if (type?.kind === 'part_type') return type.definition.typeName
  }
  const category = elementViewCategory(model.elements, el)
  return category ? VIEW_CATEGORY_LABELS[category] : t('drawing.modelElement', 'Model element', { ns: 'editor' })
}

const zoomFit = (t: Translate): DrawingMenuItem => ({ id: 'zoom_fit', label: t('drawing.zoomToFit', 'Zoom to fit', { ns: 'editor' }), hint: 'F', groupStart: true })

export function drawingMenuItems(target: DrawingMenuTarget, ctx: DrawingMenuContext, translate: Translate = englishOnly): DrawingMenu {
  const t = translate
  if (target.kind === 'viewport') {
    const schedule = target.view.viewType === 'schedule'
    return {
      title: target.view.name,
      items: [
        {
          id: 'open_view',
          label: schedule ? t('drawing.openSchedule', 'Open schedule', { ns: 'editor' }) : t('drawing.openView', 'Open view', { ns: 'editor' }),
        },
        {
          id: 'remove_from_sheet',
          label: t('drawing.removeFromSheet', 'Remove from sheet…', { ns: 'editor' }),
          hint: schedule
            ? t('drawing.scheduleStays', 'The schedule itself stays in Views and sheets.', { ns: 'editor' })
            : t('drawing.viewStays', 'The view itself stays in Views and sheets.', { ns: 'editor' }),
          ...(ctx.canEdit ? {} : { disabledReason: ctx.blockedReason }),
          confirm: {
            title: t('drawing.removeNamedTitle', 'Remove {{name}} from this sheet?', { ns: 'editor', name: target.view.name }),
            description: schedule
              ? t('drawing.removeScheduleWhy', 'The schedule stays in Views and sheets; only its place on this sheet goes. Undo brings it back.', { ns: 'editor' })
              : t('drawing.removeViewWhy', 'The view stays in Views and sheets; only its place on this sheet goes. Undo brings it back.', { ns: 'editor' }),
            confirmLabel: t('drawing.removeFromSheetButton', 'Remove from sheet', { ns: 'editor' }),
          },
        },
        zoomFit(t),
      ],
    }
  }
  if (target.kind === 'paper') {
    const items: DrawingMenuItem[] = []
    if (ctx.onSheet)
      items.push({
        id: 'add_view',
        label: t('drawing.addView', 'Add view…', { ns: 'editor' }),
        ...(!ctx.canEdit ? { disabledReason: ctx.blockedReason } : ctx.canAddView ? {} : { disabledReason: addViewHow(t) }),
      })
    items.push({ ...zoomFit(t), groupStart: items.length > 0 })
    return {
      title: ctx.onSheet ? t('drawing.sheet', 'Sheet', { ns: 'editor' }) : (ctx.view?.name ?? t('drawing.drawing', 'Drawing', { ns: 'editor' })),
      items,
    }
  }

  const el = ctx.model.elements[target.elementId]
  if (!live(el)) return { title: t('drawing.drawing', 'Drawing', { ns: 'editor' }), items: [{ ...zoomFit(t), groupStart: false }] }
  const like = likeThisIds(ctx.model, ctx.view, el)
  const hide = ctx.view ? hideInViewPatch(ctx.model, ctx.view, el) : null
  const similar = similarStartFor(el)
  const hideWhy = !ctx.canEdit
    ? ctx.blockedReason
    : !ctx.view
      ? t('drawing.openItToChange', 'Double-click the view on the sheet (or open it) to change what it shows.', { ns: 'editor' })
      : !hide
        ? t('drawing.noHideableCategory', 'This element has no category this view can hide.', { ns: 'editor' })
        : ctx.view.props?.hiddenCategories?.includes(hide.category)
          ? t('drawing.alreadyHidden', '{{name}} is already hidden in this view.', { ns: 'editor', name: hide.label })
          : null
  const similarWhy = !ctx.canEdit
    ? ctx.blockedReason
    : similar.kind === 'refused'
      ? similar.reason
      : !ctx.canCreateSimilar
        ? createSimilarUnavailable(t)
        : null
  return {
    title: elementTitle(ctx.model, el, t),
    items: [
      {
        id: 'properties',
        label: t('drawing.properties', 'Properties', { ns: 'editor' }),
        hint: t('drawing.propertiesHint', 'Selects it and shows its properties.', { ns: 'editor' }),
        ...(ctx.canSelect ? {} : { disabledReason: selectUnavailable(t) }),
      },
      {
        id: 'select_like',
        label: t('drawing.selectLike', 'Select all like this', { ns: 'editor' }),
        hint: t('drawing.selectLikeHint', '{{n}} in this view', { ns: 'editor', n: like.length }),
        ...(ctx.canSelect ? {} : { disabledReason: selectUnavailable(t) }),
      },
      {
        id: 'hide_in_view',
        label: t('drawing.hideInView', 'Hide in view', { ns: 'editor' }),
        ...(hide ? { hint: t('drawing.hideInViewHint', 'Hides every {{name}} in this view.', { ns: 'editor', name: hide.label }) } : {}),
        ...(hideWhy ? { disabledReason: hideWhy } : {}),
      },
      { id: 'create_similar', label: t('drawing.createSimilar', 'Create similar', { ns: 'editor' }), hint: 'C S', ...(similarWhy ? { disabledReason: similarWhy } : {}) },
      zoomFit(t),
    ],
  }
}
