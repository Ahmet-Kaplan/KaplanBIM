'use client'

import { boundsRooms, elementsOfKind, elementValueSource, ROOM_BOUNDING_INSTANCE_KEY, starterElementTypes, type BimElement, type ElementTypeElement, type ModelState, type ParamValue } from '@permitzip/bim-kernel'
import { formatRating, ratingKindRow, ratingOf, ratingSourceOf } from '@permitzip/bim-kernel/rated-routes'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '../../ui/select'
import { Switch } from '../../ui/switch'
import { useEditorTranslate, type Translate } from '../i18n/translate'
import type { SubmitCommand } from '../views-sheets/types'
import { EditTypeDialog, type NewTypeRequest } from './EditTypeDialog'
import { instanceRatingField } from './type-fields'
import { doorFlipCommand } from './tools/door-flips'
import { typeDescription } from './tools/tool-types'
import { WallBaseField, WallTopField } from './WallTopField'
import { OpeningSillField } from './OpeningSillField'

const TYPED_KINDS: ReadonlySet<string> = new Set(['wall', 'opening', 'slab', 'ceiling', 'column'])
const NO_TYPE = '__none__'
const NEW_TYPE = '__new__'
const DUPLICATE_TYPE = '__duplicate__'
const FIRE = 'fire_resistance'

/**
 * What one selected wall, door, window or floor is called here (§2.3: *wall* =
 * **duvar**, *door* = **kapı**, *window* = **pencere**, *floor* = **döşeme**,
 * *ceiling* = **tavan**, *column* = **kolon**).
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
      return el.kind
  }
}

function typeIdOf(el: BimElement): string | null {
  return 'typeId' in el && typeof el.typeId === 'string' ? el.typeId : null
}

type Props = {
  readonly model: ModelState | null
  readonly selectedIds: readonly string[]
  readonly submit: SubmitCommand
  readonly editBlocked: string | null
  readonly notify: (message: string, kind?: 'info' | 'error') => void
  /** The model server stores wall tops tied to a level; absent: it does. */
  readonly tiesStored?: boolean
  /** The model server stores tops and bases bound to surfaces (`walls:surface_binding`); absent: it does. */
  readonly surfacesStored?: boolean
}

/**
 * The Architecture section of the properties panel for one selected wall,
 * door, window, floor or ceiling: its type (pick another, or make one with
 * New type… / Duplicate type…), its own fire rating over its type's, and,
 * for walls, whether it bounds rooms.
 */
export function ArchitectureProperties({ model, selectedIds, submit, editBlocked, notify, tiesStored = true, surfacesStored = true }: Props): ReactNode {
  const t = useEditorTranslate()
  const [making, setMaking] = useState<NewTypeRequest | null>(null)
  const el = model && selectedIds.length === 1 ? model.elements[selectedIds[0] ?? ''] : undefined
  if (!model || !el || !TYPED_KINDS.has(el.kind)) return null
  const types = elementsOfKind(model.elements, 'element_type').filter((t) => !t.forKinds || t.forKinds.includes(el.kind))
  // Starter types the add-ons ship that the model doesn't have yet: picking one adds it with the change.
  const variant = el.kind === 'opening' ? el.openingType : undefined
  const starters = starterElementTypes().filter((r) => r.forKinds.includes(el.kind) && (r.variant === undefined || r.variant === variant) && !model.elements[r.id])
  const current = typeIdOf(el)
  const currentType = current ? model.elements[current] : undefined
  const ownType: ElementTypeElement | null = currentType?.kind === 'element_type' ? currentType : null
  const bounding = el.kind === 'wall' ? boundsRooms(el, model.elements) : null
  const what = noun(el, t)
  const blocked = editBlocked !== null
  return (
    <FieldGroup data-testid="architecture-properties">
      <Field>
        <FieldLabel htmlFor="architecture-type">{t('architecture.type.label', 'Type', { ns: 'editor' })}</FieldLabel>
        <Select
          value={current ?? NO_TYPE}
          disabled={blocked}
          onValueChange={(v) => {
            if (v === NEW_TYPE || v === DUPLICATE_TYPE) {
              setMaking({ kind: el.kind, noun: what, from: v === DUPLICATE_TYPE ? ownType : null, assignTo: el.id })
              return
            }
            const err = submit(
              { type: 'set_element_type', elementIds: [el.id], typeId: v === NO_TYPE ? null : v },
              t('architecture.type.change', "Change the {{what}}'s type", { ns: 'editor', what }),
            )
            if (err) {
              console.error('[ArchitectureProperties] type change refused', { elementId: el.id, err })
              notify(err, 'error')
            }
          }}
        >
          <SelectTrigger id="architecture-type" aria-label={t('architecture.type.itsType', "The {{what}}'s type", { ns: 'editor', what })}>
            <SelectValue placeholder={t('architecture.type.none', 'No type', { ns: 'editor' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TYPE}>{t('architecture.type.none', 'No type', { ns: 'editor' })}</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
            {starters.map((r) => (
              <SelectItem key={r.id} value={r.id} data-testid="architecture-starter-type">
                {r.name}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={NEW_TYPE} data-testid="architecture-new-type">
              {t('architecture.type.new', 'New type…', { ns: 'editor' })}
            </SelectItem>
            {ownType ? (
              <SelectItem value={DUPLICATE_TYPE} data-testid="architecture-duplicate-type">
                {t('architecture.type.duplicate', 'Duplicate type…', { ns: 'editor' })}
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        {blocked ? (
          <FieldDescription>{editBlocked}</FieldDescription>
        ) : ownType ? (
          <FieldDescription data-testid="architecture-type-words">
            {typeDescription(ownType.id) ??
              t('architecture.type.madeHere', '{{name}}: a type made in this model. Edit type… shows what it is made of.', { ns: 'editor', name: ownType.name })}
          </FieldDescription>
        ) : types.length === 0 && starters.length === 0 ? (
          <FieldDescription>
            {t(
              'architecture.type.noneInModel',
              'No {{what}} types in this model yet. A type is what the {{what}} is built as (its fire rating and the rest); pick New type… in this menu to make one.',
              { ns: 'editor', what },
            )}
          </FieldDescription>
        ) : (
          <FieldDescription data-testid="architecture-type-words">
            {t(
              'architecture.type.pickOne',
              'No type yet. A type is what the {{what}} is built as: choose a starter type, or pick New type… in this menu to make your own.',
              { ns: 'editor', what },
            )}
          </FieldDescription>
        )}
      </Field>
      {el.kind === 'wall' ? <WallTopField key={`top-${el.id}`} model={model} el={el} submit={submit} editBlocked={editBlocked} notify={notify} tiesStored={tiesStored} surfacesStored={surfacesStored} /> : null}
      {el.kind === 'wall' ? <WallBaseField key={`base-${el.id}`} model={model} el={el} submit={submit} editBlocked={editBlocked} notify={notify} surfacesStored={surfacesStored} /> : null}
      <FireRatingField key={el.id} model={model} el={el} type={ownType} what={what} submit={submit} editBlocked={editBlocked} notify={notify} />
      {bounding !== null ? (
        <Field orientation="horizontal">
          <Switch
            id="architecture-room-bounding"
            checked={bounding}
            disabled={blocked}
            onCheckedChange={(on) => {
              const err = submit(
                { type: 'set_element_values', elementIds: [el.id], values: { [ROOM_BOUNDING_INSTANCE_KEY]: on } },
                on ? t('architecture.rooms.letBound', 'Let the wall bound rooms', { ns: 'editor' }) : t('architecture.rooms.stopBound', 'Stop the wall bounding rooms', { ns: 'editor' }),
              )
              if (err) {
                console.error('[ArchitectureProperties] room bounding refused', { elementId: el.id, err })
                notify(err, 'error')
              }
            }}
          />
          <FieldLabel htmlFor="architecture-room-bounding">{t('architecture.rooms.bounds', 'Bounds rooms', { ns: 'editor' })}</FieldLabel>
        </Field>
      ) : null}
      {el.kind === 'opening' && (el.openingType === 'door' || el.openingType === 'window') ? <OpeningSillField key={`sill-${el.id}`} model={model} el={el} submit={submit} editBlocked={editBlocked} notify={notify} /> : null}
      {el.kind === 'opening' && el.openingType === 'door' ? <DoorFlips model={model} el={el} submit={submit} editBlocked={editBlocked} notify={notify} /> : null}
      {making ? <EditTypeDialog model={model} create={making} submit={submit} editBlocked={editBlocked} onClose={() => setMaking(null)} /> : null}
    </FieldGroup>
  )
}

/**
 * The element's own fire rating: empty reads its type's; a value set here
 * wins over the type and says so, with a way back to the type's.
 */
function FireRatingField({ model, el, type, what, submit, editBlocked, notify }: { readonly model: ModelState; readonly el: BimElement; readonly type: ElementTypeElement | null; readonly what: string; readonly submit: SubmitCommand; readonly editBlocked: string | null; readonly notify: Props['notify'] }): ReactNode {
  const t = useEditorTranslate()
  const row = ratingKindRow(FIRE)
  const source = ratingSourceOf(model.elements, el, FIRE)
  const field = instanceRatingField(el, type, t)
  const ownKey = field?.key
  const own = ownKey ? elementValueSource(model.elements, el, ownKey) : null
  const ownValue = own?.from === 'instance' ? own.value : undefined
  const shown = ownValue === undefined || ownValue === null ? '' : String(ownValue)
  const [text, setText] = useState(shown)
  const [why, setWhy] = useState<string | null>(null)
  // Undo, another person's edit or the reset button changes the stored value: the box follows it.
  const [synced, setSynced] = useState(shown)
  if (synced !== shown) {
    setSynced(shown)
    setText(shown)
  }
  if (!row || !source || !field || !ownKey) {
    return (
      <Field orientation="horizontal">
        <FieldLabel>{t('architecture.fireRating', 'Fire rating', { ns: 'editor' })}</FieldLabel>
        <Badge variant="outline" data-testid="architecture-fire-rating">
          {t('architecture.rated.not', 'Not rated', { ns: 'editor' })}
        </Badge>
      </Field>
    )
  }
  const words = (v: number | null) => (v === null ? t('architecture.rated.not', 'Not rated', { ns: 'editor' }) : formatRating(row, v))
  const typeWords = type ? `${type.name}: ${words(source.typeValue)}` : null

  const write = (values: Record<string, ParamValue | null>, label: string): boolean => {
    const err = submit({ type: 'set_element_values', elementIds: [el.id], values }, label)
    if (err) {
      console.error('[ArchitectureProperties] fire rating refused', { elementId: el.id, err })
      notify(err, 'error')
      return false
    }
    return true
  }
  // Clearing every rating key the element sets puts its type's rating back.
  const clearOwn = (): Record<string, null> => Object.fromEntries(source.ownKeys.map((k) => [k, null]))

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed === shown) return setWhy(null)
    if (trimmed === '') {
      setWhy(null)
      if (source.ownKeys.length > 0) write(clearOwn(), t('architecture.rated.useType', "Use the {{what}}'s type's fire rating", { ns: 'editor', what }))
      return
    }
    let value: ParamValue
    if (field.control === 'number') {
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 0)
        return setWhy(t('architecture.rated.needsHours', 'Fire rating needs a number of hours; "{{text}}" isn\'t one.', { ns: 'editor', text: text.trim() }))
      value = n
    } else value = trimmed
    // Read it the way every check will before writing it, so a typo never lands as "not rated".
    const trial = { ...el, values: { ...('values' in el ? el.values : {}), [ownKey]: value } } as BimElement
    if (ratingOf(model.elements, trial, FIRE) === null && trimmed !== '0')
      return setWhy(t('architecture.rated.doesNotRead', '"{{text}}" doesn\'t read as a fire rating. Type hours or minutes: 1, 1 hr, 90 min.', { ns: 'editor', text: trimmed }))
    setWhy(null)
    write({ ...clearOwn(), [ownKey]: value }, t('architecture.rated.set', "Set the {{what}}'s fire rating", { ns: 'editor', what }))
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      setText(shown)
      setWhy(null)
    }
  }

  return (
    <Field data-testid="architecture-fire-rating-field" data-overrides-type={source.differsFromType ? 'true' : 'false'}>
      <FieldLabel htmlFor="architecture-fire-rating-input">{t('architecture.fireRating', 'Fire rating', { ns: 'editor' })}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id="architecture-fire-rating-input"
          className="h-8 w-28"
          value={text}
          disabled={editBlocked !== null}
          placeholder={source.typeValue !== null ? words(source.typeValue) : t('architecture.rated.not', 'Not rated', { ns: 'editor' })}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          aria-describedby="architecture-fire-rating-words"
        />
        <Badge variant={source.value === null ? 'outline' : 'secondary'} data-testid="architecture-fire-rating">
          {words(source.value)}
        </Badge>
      </div>
      <FieldDescription id="architecture-fire-rating-words" data-testid="architecture-fire-rating-source">
        {why ??
          (source.differsFromType
            ? typeWords
              ? t('architecture.rated.differsNamed', "Differs from its type ({{type}}): this {{what}}'s own rating wins.", { ns: 'editor', type: typeWords, what })
              : t('architecture.rated.differs', "Differs from its type: this {{what}}'s own rating wins.", { ns: 'editor', what })
            : source.ownKeys.length > 0
              ? t('architecture.rated.own', "This {{what}}'s own rating.", { ns: 'editor', what })
              : typeWords
                ? t('architecture.rated.fromType', "From its type ({{type}}). Type a rating to set this {{what}}'s own.", { ns: 'editor', type: typeWords, what })
                : t('architecture.rated.howTo', 'Type hours or minutes (1, 1 hr, 90 min) to rate this {{what}}.', { ns: 'editor', what }))}
      </FieldDescription>
      {source.ownKeys.length > 0 && type ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="self-start"
          data-testid="architecture-fire-rating-reset"
          disabled={editBlocked !== null}
          onClick={() => {
            write(clearOwn(), t('architecture.rated.useType', "Use the {{what}}'s type's fire rating", { ns: 'editor', what }))
          }}
        >
          {t('architecture.rated.useTypeButton', "Use the type's rating", { ns: 'editor' })}
        </Button>
      ) : null}
    </Field>
  )
}

/** Flip hinge (to the other jamb) and Flip swing (to the other side of the wall), as in Revit's flip arrows; the plan and 3D redraw from the edit. */
function DoorFlips({ model, el, submit, editBlocked, notify }: { readonly model: ModelState; readonly el: BimElement; readonly submit: SubmitCommand; readonly editBlocked: string | null; readonly notify: Props['notify'] }): ReactNode {
  const t = useEditorTranslate()
  const flip = (which: 'hinge' | 'swing') => {
    const command = doorFlipCommand(model.elements, el, which, t)
    if (typeof command === 'string') {
      notify(command, 'error')
      return
    }
    const err = submit(command, which === 'hinge' ? t('architecture.doorFlip.hinge', "Flip the door's hinge", { ns: 'editor' }) : t('architecture.doorFlip.swing', "Flip the door's swing", { ns: 'editor' }))
    if (err) {
      console.error('[ArchitectureProperties] door flip refused', { elementId: el.id, which, err })
      notify(err, 'error')
    }
  }
  const hingeWhy =
    typeof doorFlipCommand(model.elements, el, 'hinge', t) === 'string' ? t('architecture.doorFlip.whyNoHinge', 'This door has a leaf on each jamb, or slides: no hinge side to flip', { ns: 'editor' }) : null
  return (
    <Field data-testid="architecture-door-flips">
      <FieldLabel>{t('architecture.doorFlip.label', 'Door', { ns: 'editor' })}</FieldLabel>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" data-testid="architecture-flip-hinge" disabled={editBlocked !== null || hingeWhy !== null} title={hingeWhy ?? undefined} onClick={() => flip('hinge')}>
          {t('architecture.doorFlip.flipHinge', 'Flip hinge', { ns: 'editor' })}
        </Button>
        <Button type="button" size="sm" variant="outline" data-testid="architecture-flip-swing" disabled={editBlocked !== null} onClick={() => flip('swing')}>
          {t('architecture.doorFlip.flipSwing', 'Flip swing', { ns: 'editor' })}
        </Button>
      </div>
      <FieldDescription>
        {editBlocked ?? hingeWhy ?? t('architecture.doorFlip.words', 'Hinge: the jamb it hangs on. Swing: the side of the wall it opens to.', { ns: 'editor' })}
      </FieldDescription>
    </Field>
  )
}
