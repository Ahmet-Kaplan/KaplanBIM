'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  referenceDisplayPreset,
  referencePresetDisplay,
  withPens,
  referenceSurfaceOf,
  resolveCanvasDisplay,
  resolveReferenceDisplay,
  withCategoryDisplay,
  withReferenceDisplay,
  workingViewOf,
  type LineWeight,
  type LinkedModelDiscipline,
  type ReferenceCategoryDisplay,
  type ReferenceDisplay,
  type ReferenceDisplayPreset,
  type ReferenceSurface,
  type ResolvedReferenceDisplay,
  type Aabb3,
  type ViewElement,
} from '@permitzip/bim-kernel'
import type { ModelViewer3D } from '@permitzip/bim-viewer-3d'
import { referenceTone } from '@permitzip/bim-viewer-3d/light'
import { workingViewName } from '../views-sheets/use-crop-3d'
import { newId, type SubmitCommand } from '../views-sheets/types'
import { useEditorTranslate, englishOnly, type Translate } from '../i18n/translate'
import { categoryNounWord, penSideWord, presetWord } from './linked-display-words'

/**
 * How each linked model draws in whatever is open: the open view's own
 * setting, or in the free model your working 3D view's ("{3D - you}"), which
 * is made the first time you change one (crop off, so nothing else moves).
 * The live canvas follows it; drawings and prints read the same view props.
 * Without edit access a change still shows, in this tab only, and says so.
 */

export interface LinkedDisplayEntry {
  readonly stored: ReferenceDisplay | undefined
  readonly resolved: ResolvedReferenceDisplay
  readonly preset: ReferenceDisplayPreset | 'custom'
}

export interface LinkedDisplay {
  /** Where changes are saved, in words ("this view", "your 3D view"). */
  readonly targetLabel: string
  readonly surface: ReferenceSurface
  readonly entry: (referenceId: string) => LinkedDisplayEntry
  readonly setPreset: (referenceId: string, label: string, preset: ReferenceDisplayPreset) => void
  readonly setTransparency: (referenceId: string, label: string, pct: number) => void
  readonly setVisible: (referenceId: string, label: string, visible: boolean) => void
  readonly setCategory: (referenceId: string, label: string, category: string, next: ReferenceCategoryDisplay | null) => void
  /** Drawings: the pen for the model's cut or beyond lines; null goes back to the drawing default. */
  readonly setPen: (referenceId: string, label: string, kind: 'cut' | 'beyond', pen: LineWeight | null) => void
}

export interface LinkedDisplayReference {
  readonly id: string
  readonly discipline: LinkedModelDiscipline
}

interface Args {
  readonly viewer: ModelViewer3D | null
  readonly references: readonly LinkedDisplayReference[]
  /** The view open in the canvas or as a drawing (null: the free model). */
  readonly openView: ViewElement | null
  readonly views: readonly ViewElement[]
  readonly userId: string
  readonly userName: string
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
  readonly notify: (message: string, kind?: 'info' | 'error') => void
  /** The whole model's bounds for a new working view's crop box (it starts with crop off). */
  readonly extent: () => Promise<Aabb3 | undefined>
}

export function useLinkedDisplay(args: Args): LinkedDisplay {
  const { viewer, references, openView, views, userId, userName, canEdit, blockedReason, submit, notify, extent } = args
  const t = useEditorTranslate()
  const working = useMemo(() => workingViewOf(views, userId), [views, userId])
  const target = openView ?? working
  const targetKey = openView ? `view:${openView.id}` : 'free'
  const surface = referenceSurfaceOf(openView)
  const targetLabel = openView && !openView.props?.workingFor
    ? t('view.thisView', 'this view', { ns: 'editor' })
    : t('view.your3dView', 'your 3D view', { ns: 'editor' })
  /** Changes kept in this tab only (no edit access), per what is open. */
  const [local, setLocal] = useState<Readonly<Record<string, ReferenceDisplay>>>({})

  const discipline = useCallback((id: string): LinkedModelDiscipline => references.find((r) => r.id === id)?.discipline ?? 'architecture', [references])

  const stored = useCallback(
    (id: string): ReferenceDisplay | undefined => local[`${targetKey}:${id}`] ?? target?.props?.references?.[id],
    [local, targetKey, target],
  )

  // The canvas follows the view's display, resolved for the canvas (a drawing view's display applies when its live model is in the canvas).
  const tones = useMemo(() => references.map((r) => ({ id: r.id, tone: referenceTone(resolveCanvasDisplay(stored(r.id), surface, discipline(r.id))) })), [references, stored, surface, discipline])
  const notifyRef = useRef(notify)
  useEffect(() => {
    notifyRef.current = notify
  })
  useEffect(() => {
    if (!viewer) return
    for (const { id, tone } of tones) {
      viewer.setReferenceTone(id, tone).catch((err: unknown) => {
        console.error('[useLinkedDisplay] applying the linked model display failed', { id, err })
        notifyRef.current(
          t('linkedDisplay.canvasFailed', "The linked model's display couldn't be applied in the canvas. Its printed drawing still follows the setting.", {
            ns: 'editor',
          }),
          'error',
        )
      })
    }
    // `t` is a dependency: a language switch re-applies the tones, which is what a
    // caption that changed language needs (and a stale one is a bug that shipped twice).
  }, [viewer, tones, t])

  const save = useCallback(
    (id: string, next: ReferenceDisplay, label: string) => {
      if (!canEdit) {
        setLocal((prev) => ({ ...prev, [`${targetKey}:${id}`]: next }))
        notify(t('linkedDisplay.thisTabOnly', 'Showing it this way in this tab only. {{reason}}', { ns: 'editor', reason: blockedReason }), 'info')
        return
      }
      if (target) {
        const refusal = submit({ type: 'set_view_properties', viewId: target.id, props: { references: withReferenceDisplay(target.props?.references, id, next) } }, label)
        if (refusal) notify(refusal, 'error')
        return
      }
      void (async () => {
        const camera = viewer?.camera3dState() ?? undefined
        const box = await extent()
        const refusal = submit(
          {
            type: 'create_3d_view',
            viewId: newId('view'),
            name: workingViewName(userName, views),
            workingFor: userId,
            ...(camera ? { camera } : {}),
            ...(box ? { extent: box } : {}),
            cropView: false,
            showCropBox: false,
            references: { [id]: next },
          },
          label,
        )
        if (refusal) notify(refusal, 'error')
      })().catch((err: unknown) => {
        console.error('[useLinkedDisplay] making your working 3D view failed', err)
        notify(t('linkedDisplay.workingViewFailed', "Your 3D view couldn't be made, so the linked model's display wasn't saved.", { ns: 'editor' }), 'error')
      })
    },
    [canEdit, targetKey, notify, blockedReason, target, submit, viewer, extent, userName, views, userId, t],
  )

  return useMemo(() => makeLinkedDisplay({ targetLabel, surface, stored, discipline, save, t }), [targetLabel, surface, stored, discipline, save, t])
}

export function linkedDisplayEntry(stored: ReferenceDisplay | undefined, surface: ReferenceSurface, discipline: LinkedModelDiscipline): LinkedDisplayEntry {
  return { stored, resolved: resolveReferenceDisplay(stored, surface, discipline), preset: referenceDisplayPreset(stored) }
}

interface MakeArgs {
  readonly targetLabel: string
  readonly surface: ReferenceSurface
  readonly stored: (referenceId: string) => ReferenceDisplay | undefined
  readonly discipline: (referenceId: string) => LinkedModelDiscipline
  readonly save: (referenceId: string, next: ReferenceDisplay, undoLabel: string) => void
  /** The translator the undo labels are written through; `englishOnly` outside a host. */
  readonly t?: Translate
}

/** The panel controls over any store of linked model display (the canvas hook, or a view's properties). */
export function makeLinkedDisplay({ targetLabel, surface, stored, discipline, save, t = englishOnly }: MakeArgs): LinkedDisplay {
  const base = (id: string): ReferenceDisplay => stored(id) ?? referencePresetDisplay('halftone')
  return {
    targetLabel,
    surface,
    entry: (id) => linkedDisplayEntry(stored(id), surface, discipline(id)),
    // The undo label is a frame with translated words in it: the kernel's English
    // `REFERENCE_PRESET_LABEL` and a `${category}s` plural never enter a Turkish one.
    setPreset: (id, label, preset) =>
      save(
        id,
        withPens(referencePresetDisplay(preset), stored(id)),
        t('linkedDisplay.undoPreset', 'show {{name}} {{look}}', { ns: 'editor', name: label, look: presetWord(preset, t).toLocaleLowerCase('tr') }),
      ),
    setTransparency: (id, label, pct) =>
      save(
        id,
        { ...base(id), transparencyPct: Math.round(pct) },
        t('linkedDisplay.undoTransparency', 'make {{name}} {{pct}}% see-through', { ns: 'editor', name: label, pct: Math.round(pct) }),
      ),
    setVisible: (id, label, visible) =>
      save(
        id,
        { ...base(id), visible },
        visible
          ? t('linkedDisplay.undoShow', 'show {{name}}', { ns: 'editor', name: label })
          : t('linkedDisplay.undoHide', 'hide {{name}}', { ns: 'editor', name: label }),
      ),
    setCategory: (id, label, category, next) =>
      save(
        id,
        withCategoryDisplay(base(id), category, next),
        t('linkedDisplay.undoCategory', 'change how {{name}} draws its {{what}}', { ns: 'editor', name: label, what: categoryNounWord(category, t) }),
      ),
    setPen: (id, label, kind, pen) => {
      const key = kind === 'cut' ? 'cutPen' : 'beyondPen'
      const { [key]: _old, ...rest } = base(id)
      save(
        id,
        pen ? { ...rest, [key]: pen } : rest,
        t('linkedDisplay.undoPen', "change {{name}}'s {{where}} line weight", { ns: 'editor', name: label, where: penSideWord(kind, t) }),
      )
    },
  }
}
