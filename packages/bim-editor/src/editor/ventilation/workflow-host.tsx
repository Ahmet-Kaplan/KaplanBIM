'use client'

import { useMemo, type ReactNode } from 'react'
import { diagramKindStoreRefusal } from '@permitzip/bim-kernel'
import { AIR_SCHEMATIC_KIND } from '@permitzip/bim-pack-mechanical/ui'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'
import { usePublishWorkflow } from '../contributions/host-slots'
import type { WorkflowHostProps, WorkflowServices } from '../contributions/types'
import type { MechanicalAction, MechanicalRibbon } from './mechanical-tab'
import { useHeatGainColumns } from './heat-gain-column'
import { useAirPlans } from './use-air-plans'

/** The Mechanical tab's actions from what the surface offers every add-on (Connect › To duct and Analyze › Size ducts come from `useAirPlans`). */
export function mechanicalRibbonFrom(
  s: Pick<WorkflowServices, 'model' | 'editBlocked' | 'modelToolsOff' | 'routeAs' | 'choosePlace' | 'openDiagram' | 'notify' | 'serverFeatures'>,
  plans: { readonly connectToDuct: MechanicalAction; readonly sizeDucts: MechanicalAction } | undefined = undefined,
  t: Translate = englishOnly,
): MechanicalRibbon {
  const loading = t('ventilation.modelStillLoading', 'The model is still loading.', { ns: 'editor' })
  const fallback = { connectToDuct: { run: () => undefined, blocked: loading }, sizeDucts: { run: () => undefined, blocked: loading } }
  const chosen = plans ?? fallback
  const toolsBlocked = s.model
    ? s.modelToolsOff
      ? t('ventilation.toolsOnDrawing', 'Route duct and place equipment in a plan or the 3D model: open one from the Views and sheets panel.', { ns: 'editor' })
      : s.editBlocked
    : loading
  const kind = AIR_SCHEMATIC_KIND
  const features = s.serverFeatures
  return {
    routeDuct: { run: () => s.routeAs('duct'), blocked: toolsBlocked },
    placeEquipment: { run: s.choosePlace, blocked: toolsBlocked },
    connectToDuct: chosen.connectToDuct,
    sizeDucts: chosen.sizeDucts,
    airSchematic: {
      run: () => {
        const refusal = s.openDiagram(kind)
        if (refusal) s.notify(refusal, 'error')
      },
      blocked: s.model ? diagramKindStoreRefusal(kind, (feature) => features === undefined || features.includes(feature)) : loading,
    },
  }
}

/** Mechanical's workflow, mounted by the surface: its tab's input, its preview windows, and the Equipment list's Heat gain column for the shared list. */
export function WorkflowHost({ services, outlet }: WorkflowHostProps): ReactNode {
  const { model, editBlocked, modelToolsOff, routeAs, choosePlace, openDiagram, notify, selectedIds, submit, select, serverFeatures } = services
  const t = useEditorTranslate()
  const plans = useAirPlans({ model, selectedIds, editBlocked, submit, select, notify, ...(serverFeatures ? { serverFeatures } : {}) })
  const { connectToDuct, sizeDucts } = plans
  const ribbon = useMemo(
    () => mechanicalRibbonFrom({ model, editBlocked, modelToolsOff, routeAs, choosePlace, openDiagram, notify, serverFeatures }, { connectToDuct, sizeDucts }, t),
    [model, editBlocked, modelToolsOff, routeAs, choosePlace, openDiagram, notify, serverFeatures, connectToDuct, sizeDucts, t],
  )
  const equipmentListColumns = useHeatGainColumns(services.projectId)
  usePublishWorkflow(outlet, { data: { ribbon, autoTab: null, shared: { equipmentListColumns } } })
  return plans.overlay
}
