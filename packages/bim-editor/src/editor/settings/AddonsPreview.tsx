'use client'

import { useState } from 'react'
import { PackageOpen } from 'lucide-react'
import { modelSetupOf, type ModelState } from '@permitzip/bim-kernel'
import type { Pack } from '@permitzip/bim-kernel/packs'
import { Alert, AlertDescription } from '../../ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Switch } from '../../ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { PREVIEW_PACK_IDS, installedPacks } from '../../contracts/building-model/installed-packs'
import type { SubmitCommand } from '../views-sheets/types'
import { PREVIEW_NOTE } from './AddonsPreviewNote'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { DisciplinesSectionFrom, type DisciplineRows } from '../library/DisciplinesSection'
import { useEditorTranslate } from '../i18n/translate'


interface Props {
  readonly model: ModelState
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
  readonly onClose: () => void
  /** The add-ons this server has; the host's list by default. */
  readonly packs?: readonly Pack[]
  readonly previewIds?: ReadonlySet<string>
  /** The firm's disciplines to offer for pinning; the library by default. */
  readonly loadDisciplineRows?: () => Promise<DisciplineRows>
}

/**
 * Building Model › Manage › Model settings › Add-ons: switch an installed
 * add-on on or off for this model. Off by default. A switch is an ordinary
 * edit (undoable, attributed; an agent's switch gets an Approve card).
 * Switching off asks first: its rows are hidden, nothing is deleted.
 */
export function AddonsPreview({ model, canEdit, blockedReason, submit, onClose, packs = installedPacks(), previewIds = PREVIEW_PACK_IDS, loadDisciplineRows }: Props) {
  const t = useEditorTranslate()
  const firmLibrary = useEditorHost().data.firmLibrary
  const [error, setError] = useState<string | null>(null)
  const [confirmOff, setConfirmOff] = useState<Pack | null>(null)
  const pins = modelSetupOf(model).pins
  const isOn = (pack: Pack) => pins.some((p) => p.id === pack.manifest.id && p.version === pack.manifest.version)

  const flip = (pack: Pack, on: boolean) => {
    const verb = on ? t('settings.switchOn', 'switch on', { ns: 'editor' }) : t('settings.switchOff', 'switch off', { ns: 'editor' })
    const refusal = submit({ type: 'set_model_addon', packId: pack.manifest.id, version: pack.manifest.version, on }, `${verb} ${pack.manifest.name}`)
    if (refusal) console.error('[AddonsPreview] the add-on switch was refused', { packId: pack.manifest.id, on, refusal })
    setError(refusal)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" data-testid="addons-preview-dialog">
        <DialogHeader>
          <DialogTitle>{t('panel.addOns', 'Add-ons', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('settings.addonsWhy', 'Add-ons this server has, beyond the built-in trades. Each is off until you switch it on for this model; a switch is an edit you can undo.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        {!canEdit && (
          <Alert>
            <AlertDescription>{blockedReason}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" data-testid="addons-preview-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {packs.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageOpen />
              </EmptyMedia>
              <EmptyTitle>{t('settings.noAddons', 'No add-ons on this server', { ns: 'editor' })}</EmptyTitle>
              <EmptyDescription>{t('settings.noAddonsWhy', 'Only the built-in trades are installed. Settings › MutinyBIM library › Add-ons lists what a server has.', { ns: 'editor' })}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>
            {packs.map((pack) => {
              const on = isOn(pack)
              const preview = previewIds.has(pack.manifest.id)
              const label = `${pack.manifest.name}${preview ? t('settings.previewParen', ' (Preview)', { ns: 'editor' }) : ''}`
              const toggle = (
                <Switch
                  checked={on}
                  disabled={!canEdit}
                  aria-label={`${label}: ${on ? 'on' : 'off'} for this model`}
                  data-testid={`addon-switch-${pack.manifest.id}`}
                  onCheckedChange={(next) => (next ? flip(pack, true) : setConfirmOff(pack))}
                />
              )
              return (
                <Item key={pack.manifest.id} variant="outline" data-testid={`addon-row-${pack.manifest.id}`}>
                  <ItemContent>
                    <ItemTitle>
                      {pack.manifest.name}
                      {preview && <Badge variant="outline">{t('settings.preview', 'Preview', { ns: 'editor' })}</Badge>}
                      <span className="text-muted-foreground text-xs tabular-nums">{pack.manifest.version}</span>
                    </ItemTitle>
                    {pack.manifest.description && <ItemDescription>{pack.manifest.description}</ItemDescription>}
                    {preview && <ItemDescription className="text-warning-700">{PREVIEW_NOTE}</ItemDescription>}
                  </ItemContent>
                  <ItemActions>
                    {canEdit ? (
                      toggle
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{toggle}</span>
                        </TooltipTrigger>
                        <TooltipContent>{blockedReason}</TooltipContent>
                      </Tooltip>
                    )}
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        )}
        <DisciplinesSectionFrom port={firmLibrary} pinTo={{ model, canEdit, blockedReason, submit }} {...(loadDisciplineRows ? { loadRows: loadDisciplineRows } : {})} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('settings.close', 'Close', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={confirmOff !== null} onOpenChange={(open) => !open && setConfirmOff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.switchOffOne', 'Switch {{switchName}} off for this model?', { ns: 'editor', switchName: confirmOff?.manifest.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.switchOffWhy', 'Its rows are hidden; nothing is deleted. Switch it back on, or undo, to see them again.', { ns: 'editor' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.keepItOn', 'Keep it on', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="addon-switch-off-confirm"
              onClick={() => {
                if (confirmOff) flip(confirmOff, false)
                setConfirmOff(null)
              }}
            >
              {t('settings.switchOffButton', 'Switch off', { ns: 'editor' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
