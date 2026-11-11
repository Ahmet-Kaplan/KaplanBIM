import { CircleSlash, RotateCw } from 'lucide-react'
import { Spinner } from '../../ui/spinner'
import type { BuildingModelRibbonContext } from '../building-model-ribbon'
import type { RibbonCommand, RibbonGroup, RibbonTab } from '../ribbon/types'
import { englishOnly } from '../i18n/translate'
import { domainLabelOf } from '../i18n/domain'
import { FIRST_PARTY_ONLY, isAddonActive, loadState, retryContribution, ribbonContributions } from './registry'
import type { AddonId, RibbonCommandContribution, RibbonCommandTarget, RibbonTabContribution } from './types'

/**
 * The ribbon's add-on tabs and commands, built from the contributions of the
 * add-ons the model has. While a tab's code loads it shows that it is loading;
 * if it fails it says so and offers Retry; if the model pins an add-on this
 * server doesn't have, the tab says the add-on isn't loaded for this model.
 */

function notLoadedReason(name: string): string {
  return `${name} isn't loaded for this model. The model has ${name} content, but this server doesn't have the ${name} add-on, so its tools are off. Nothing is lost: the content stays in the model.`
}

/**
 * A tab whose code has not loaded. Its name is the add-on's own trade word
 * (`ADDON_UI`), which is domain data: `label` here is already translated by the
 * caller (§7/Ç-B), so an English pack stays English in the file.
 */
function statusTab(c: RibbonTabContribution, label: string, select: RibbonGroup, command: RibbonCommand): RibbonTab {
  return { id: c.id, label, groups: [select, { id: `${c.id}-addon-status`, label, commands: [command] }] }
}

function loadingCommand(id: string, label: string, testId: string): RibbonCommand {
  return { id: `${id}-loading`, label: 'Loading…', icon: Spinner, description: `Loading the ${label} tools`, disabledReason: `The ${label} tools are loading. They appear here in a moment.`, testId }
}

function retryCommand(id: string, label: string, message: string, retry: () => void, testId: string): RibbonCommand {
  return { id: `${id}-retry`, label: 'Retry', icon: RotateCw, description: `The ${label} tools didn't load (${message}). Check your connection and press Retry.`, disabledReason: null, run: retry, testId }
}

/** The tabs of one kind the model's add-ons bring, in registration order. */
export function contributedTabs(kind: RibbonTabContribution['kind'], ctx: BuildingModelRibbonContext, select: RibbonGroup): RibbonTab[] {
  const availability = ctx.addons ?? FIRST_PARTY_ONLY
  // The add-on's trade word is a domain label (`Electrical`, `Fire protection`),
  // so it is translated where it is drawn rather than in the pack's `ADDON_UI`.
  const domain = domainLabelOf(ctx.t ?? englishOnly)
  const out: RibbonTab[] = []
  for (const c of ribbonContributions()) {
    if (c.kind !== kind || !c.applies(ctx)) continue
    const missing = availability.notLoaded.get(c.addon)
    if (missing !== undefined) {
      if (kind === 'ribbon-tab') out.push(statusTab(c, domain(c.label), select, { id: `${c.id}-not-loaded`, label: `${missing} isn't loaded`, icon: CircleSlash, description: notLoadedReason(missing), disabledReason: notLoadedReason(missing), testId: `ribbon-${c.id}-not-loaded` }))
      continue
    }
    if (!isAddonActive(c.addon, availability)) continue
    const state = loadState(c)
    if (state.status === 'loaded') {
      const tab = state.module.build(ctx, select)
      if (tab) out.push(tab)
    } else if (kind === 'ribbon-tab') {
      const label = domain(c.label)
      out.push(statusTab(c, label, select, state.status === 'loading' ? loadingCommand(c.id, label, `ribbon-${c.id}-loading`) : retryCommand(c.id, label, state.message, () => retryContribution(c), `ribbon-${c.id}-retry`)))
    }
  }
  return out
}

function placeholderCommand(c: RibbonCommandContribution, disabledReason: string | null, description: string, run?: () => void): RibbonCommand {
  return { id: c.id, label: c.label, icon: c.icon, description, disabledReason, ...(run ? { run } : {}), testId: c.testId }
}

/** The commands the model's add-ons put into one existing ribbon group, by their order (ties in registration order). */
export function contributedCommands(target: RibbonCommandTarget, ctx: BuildingModelRibbonContext, addon?: AddonId): RibbonCommand[] {
  const availability = ctx.addons ?? FIRST_PARTY_ONLY
  const out: RibbonCommand[] = []
  const inTarget = ribbonContributions().filter((c): c is RibbonCommandContribution => c.kind === 'ribbon-command' && c.target === target && (addon === undefined || c.addon === addon))
  for (const c of [...inTarget].sort((x, y) => x.order - y.order)) {
    if (c.applies && !c.applies(ctx)) continue
    const missing = availability.notLoaded.get(c.addon)
    if (missing !== undefined) {
      out.push(placeholderCommand(c, notLoadedReason(missing), notLoadedReason(missing)))
      continue
    }
    if (!isAddonActive(c.addon, availability)) continue
    const state = loadState(c)
    if (state.status === 'loaded') out.push(state.module.command(ctx))
    else if (state.status === 'loading') out.push(placeholderCommand(c, `${c.label} is loading. It is ready in a moment.`, `Loading ${c.label}`))
    else out.push(placeholderCommand(c, null, `${c.label} didn't load (${state.message}). Press to try again.`, () => retryContribution(c)))
  }
  return out
}

/** Each add-on's trade tab carries the Analyze commands its own add-on brings (`trade-analyze`), by tab id. */
export function addonTabAnalyzeCommands(ctx: BuildingModelRibbonContext): Record<string, RibbonCommand[]> {
  const out: Record<string, RibbonCommand[]> = {}
  for (const c of ribbonContributions()) {
    if (c.kind !== 'ribbon-tab') continue
    const commands = contributedCommands('trade-analyze', ctx, c.addon)
    if (commands.length > 0) out[c.id] = commands
  }
  return out
}

/** Each add-on tab with a Plan group carries the Model › Plan commands its own add-on brings, by tab id. */
export function addonTabPlanCommands(ctx: BuildingModelRibbonContext): Record<string, RibbonCommand[]> {
  const out: Record<string, RibbonCommand[]> = {}
  for (const c of ribbonContributions()) {
    if (c.kind === 'ribbon-command' || !c.plan) continue
    const commands = contributedCommands('model-plan', ctx, c.addon)
    if (commands.length > 0) out[c.id] = commands
  }
  return out
}
