import { elementClass, elementsOfKind, fieldProviderRegistry, type BimElement, type ElementTypeElement, type ModelState, type ParamValue } from '@permitzip/bim-kernel'
import { ratingKindRow } from '@permitzip/bim-kernel/rated-routes'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * What the Edit type dialog shows for one element type: the elements that
 * use it, and the parameters its classes take (the add-ons' parameter sets
 * and any rating parameter the registry knows), read from the registry in
 * force so an outside add-on's parameters appear with no change here.
 */

/** Kinds an element type can type (`create_element_type` forKinds), as stored. */
const TYPED_KINDS = ['wall', 'opening', 'slab', 'ceiling', 'column', 'beam', 'grid', 'room', 'component', 'riser_segment'] as const

export interface TypeField {
  /** The parameter key the value is stored under on the type. */
  readonly key: string
  readonly label: string
  readonly group: string
  readonly control: 'text' | 'number' | 'boolean' | 'choice'
  readonly unit?: string
  readonly choices?: readonly string[]
  readonly description?: string
}

function typedKinds(type: ElementTypeElement): readonly (typeof TYPED_KINDS)[number][] {
  return type.forKinds ? TYPED_KINDS.filter((k) => type.forKinds?.includes(k)) : TYPED_KINDS
}

/** Elements that use the type, in model order (read from the kind index, never the whole model). */
export function typeUsers(model: Pick<ModelState, 'elements'>, type: ElementTypeElement): BimElement[] {
  return elementsOfKind(model.elements, ...typedKinds(type)).filter((el) => 'typeId' in el && el.typeId === type.id)
}

/**
 * One element, in the words this panel uses: *door*, *window*, *floor* (§2.3
 * *door* = **kapı**, *window* = **pencere**, *floor* = **döşeme**). A kind no
 * table names keeps the model's own word, the way an add-on's own noun does.
 */
function noun(el: BimElement, t: Translate): string {
  switch (el.kind) {
    case 'opening':
      switch (el.openingType) {
        case 'door':
          return t('architecture.noun.door', 'door', { ns: 'editor' })
        case 'window':
          return t('architecture.noun.window', 'window', { ns: 'editor' })
        default:
          return t('architecture.noun.opening', 'opening', { ns: 'editor' })
      }
    case 'slab':
      return t('architecture.noun.floor', 'floor', { ns: 'editor' })
    case 'wall':
      return t('architecture.noun.wall', 'wall', { ns: 'editor' })
    case 'ceiling':
      return t('architecture.noun.ceiling', 'ceiling', { ns: 'editor' })
    case 'column':
      return t('architecture.noun.column', 'column', { ns: 'editor' })
    default:
      return el.kind.replace(/_/g, ' ')
  }
}

/**
 * "Used by 14 doors", "Used by 1 wall", "Not used by anything yet".
 *
 * The plural is the English default's own (`{{what}}s`), not a suffix added to
 * a translated noun: Turkish takes no plural suffix after a number (§8), so the
 * Turkish row says *14 kapı tarafından kullanılıyor*.
 */
export function usedByWords(users: readonly BimElement[], t: Translate = englishOnly): string {
  const first = users[0]
  if (!first) return t('architecture.usedBy.none', 'Not used by anything yet', { ns: 'editor' })
  const one = noun(first, t)
  const same = users.every((u) => noun(u, t) === one)
  const what = same ? one : t('architecture.noun.element', 'element', { ns: 'editor' })
  return users.length === 1
    ? t('architecture.usedBy.one', 'Used by 1 {{what}}', { ns: 'editor', what })
    : t('architecture.usedBy.many', 'Used by {{count}} {{what}}s', { ns: 'editor', count: users.length, what })
}

/** Every class an element of these kinds is recognised as, in the registry in force. */
export function classesOfKinds(kinds: readonly string[]): string[] {
  const out: string[] = []
  for (const cls of fieldProviderRegistry().listClasses()) if (cls.recognize?.elementKinds?.some((k) => kinds.includes(k))) out.push(cls.id)
  return out
}

/** The classes the type's values apply to: its users' classes, else every class its kinds are recognised as. */
function typeClasses(model: Pick<ModelState, 'elements'>, type: ElementTypeElement, users: readonly BimElement[]): string[] {
  const out = new Set<string>()
  for (const u of users) {
    const cls = elementClass(model.elements, u)
    if (cls) out.add(cls)
  }
  if (out.size > 0) return [...out]
  return classesOfKinds(typedKinds(type))
}

/** A type's stored values: a model's element type or a firm library type item. */
export interface TypeValues {
  readonly values?: Readonly<Record<string, unknown>>
}

/** The type's editable parameters, ratings first, then by group, each once. */
export function typeFields(model: Pick<ModelState, 'elements'>, type: ElementTypeElement, t: Translate = englishOnly): TypeField[] {
  return fieldsForClasses(typeClasses(model, type, typeUsers(model, type)), type, t)
}

/** A new type's parameters for elements of one kind: a duplicate's source's classes, else every class the kind is recognised as. */
export function newTypeFields(model: Pick<ModelState, 'elements'>, kind: string, from: ElementTypeElement | null, t: Translate = englishOnly): TypeField[] {
  return fieldsForClasses(from ? typeClasses(model, from, typeUsers(model, from)) : classesOfKinds([kind]), from ?? {}, t)
}

/**
 * The fire rating one element sets for itself, over its type's: the key the
 * element or its type already holds (typed as held), else the rating row's
 * text key. Null when no add-on in force rates anything.
 */
export function instanceRatingField(el: BimElement, type: TypeValues | null, t: Translate = englishOnly): TypeField | null {
  const keys = new Set(ratingKindRow('fire_resistance')?.parameterKeys ?? [])
  const own = 'values' in el && typeof el.values === 'object' && el.values !== null ? (el.values as Readonly<Record<string, unknown>>) : {}
  return ratingField({ values: { ...(type?.values ?? {}), ...own } }, keys, new Set(), t)
}

/** The editable parameters of these classes for a type holding `type.values` (shared by Edit type and Firm library › Types). */
export function fieldsForClasses(classes: readonly string[], type: TypeValues, t: Translate = englishOnly): TypeField[] {
  const registry = fieldProviderRegistry()
  const ratingKeys = new Set(ratingKindRow('fire_resistance')?.parameterKeys ?? [])
  const seen = new Set<string>()
  const out: TypeField[] = []
  for (const cls of classes) {
    for (const f of registry.fieldsFor(cls)) {
      // A value stored on the element (and so on its type): a parameter writer, or the add-ons' `set_element_values` one.
      const key = f.writer.kind === 'parameter' ? f.writer.name : f.writer.kind === 'command' && f.writer.command === 'set_element_values' ? f.writer.argument : null
      if (key === null || seen.has(key) || f.valueType === 'element') continue
      seen.add(key)
      const control = f.valueType === 'quantity' ? 'number' : f.valueType === 'boolean' ? 'boolean' : f.valueType === 'choice' && f.choices ? 'choice' : 'text'
      out.push({ key, label: f.label, group: ratingKeys.has(key) ? 'Ratings' : f.group ?? 'Other', control, ...(f.unit ? { unit: f.unit } : {}), ...(f.choices ? { choices: f.choices } : {}), ...(f.description ? { description: f.description } : {}) })
    }
  }
  const rating = ratingField(type, ratingKeys, seen, t)
  if (rating) out.push(rating)
  const rank = (g: string) => (g === 'Ratings' ? 0 : g === 'Identity' ? 1 : 2)
  return out.sort((a, b) => rank(a.group) - rank(b.group))
}

/**
 * The fire rating when no registry field carries it (it lives in the firm's
 * library, not a parameter set): the key the type already holds, typed as
 * held (hours as a number); else the rating row's last key, typed as text
 * the rating row reads ("1 hr", "90 min").
 */
function ratingField(type: TypeValues, keys: ReadonlySet<string>, seen: ReadonlySet<string>, t: Translate): TypeField | null {
  const all = [...keys]
  if (all.length === 0 || all.some((k) => seen.has(k))) return null
  const held = all.find((k) => type.values?.[k] !== undefined)
  const heldValue = held === undefined ? undefined : type.values?.[held]
  // §2.2: a type's *fire rating* is the **yangın dayanımı** it is rated at; the
  // hours-only field is the same word (§0.1 one idea, one term).
  if (held !== undefined && typeof heldValue === 'number') return { key: held, label: t('architecture.fireResistance', 'Fire resistance', { ns: 'editor' }), group: 'Ratings', control: 'number', unit: 'h' }
  const key = held ?? all[all.length - 1]
  return key === undefined
    ? null
    : {
        key,
        label: t('architecture.fireRating', 'Fire rating', { ns: 'editor' }),
        group: 'Ratings',
        control: 'text',
        description: t('architecture.fireRatingWhy', 'Hours or minutes: 1 hr, 90 min. Leave it empty when the type is not rated.', { ns: 'editor' }),
      }
}

export type DraftValue = string | boolean

/** What the dialog's control starts on: the type's stored value, as typed in. */
export function draftOf(type: TypeValues, field: TypeField): DraftValue {
  const v = type.values?.[field.key]
  if (field.control === 'boolean') return v === true
  return v === undefined || v === null ? '' : String(v)
}

/**
 * The values Save writes (one `set_element_values` on the type): only the
 * changed ones; an emptied field removes the value. A number that doesn't
 * read is refused in words before anything is written.
 */
export function changedValues(
  type: TypeValues,
  fields: readonly TypeField[],
  draft: Readonly<Record<string, DraftValue>>,
  t: Translate = englishOnly,
): { readonly values: Record<string, ParamValue | null> } | { readonly refusal: string } {
  const values: Record<string, ParamValue | null> = {}
  for (const f of fields) {
    const next = draft[f.key]
    if (next === undefined || next === draftOf(type, f)) continue
    if (typeof next === 'boolean') {
      values[f.key] = next
      continue
    }
    const text = next.trim()
    if (text === '') {
      values[f.key] = null
      continue
    }
    if (f.control === 'number') {
      const n = Number(text)
      if (!Number.isFinite(n))
        return {
          refusal: f.unit
            ? t('architecture.needsNumberIn', '{{label}} needs a number in {{unit}}; "{{text}}" isn\'t one.', { ns: 'editor', label: f.label, unit: f.unit, text })
            : t('architecture.needsNumber', '{{label}} needs a number; "{{text}}" isn\'t one.', { ns: 'editor', label: f.label, text }),
        }
      values[f.key] = n
      continue
    }
    values[f.key] = text
  }
  return { values }
}
