'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '../ui/button'
import { Field, FieldDescription, FieldLabel } from '../ui/field'
import { Spinner } from '../ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import { defaultsFromChoices } from './route-defaults'
import type { RouteDefaultDomain } from '../contracts/building-model/route-defaults'
import type { RouteChoices } from './RoutePanel'
import type { RouteDefaultsApi } from './use-route-defaults'
import { useEditorTranslate, type Translate } from './i18n/translate'

/** The domain's word in a sentence: "duct" / "pipe" (§9/Ç17: duct = kanal, pipe = boru). */
function domainWords(domain: RouteDefaultDomain, t: Translate): string {
  return domain === 'duct' ? t('route.duct', 'duct', { ns: 'editor' }) : t('route.pipe', 'pipe', { ns: 'editor' })
}

/**
 * "My defaults" in the Route panel: what the panel opened with, saving the
 * current choices for this project or every project, and forgetting them.
 * Saved in the database per person, so they follow the person anywhere.
 */
export function RouteDefaultsControl({ choices, api }: { choices: RouteChoices; api: RouteDefaultsApi }) {
  const t = useEditorTranslate()
  const [scope, setScope] = useState<'project' | 'all'>('all')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const { domain, settings } = defaultsFromChoices(choices)
  const row = api.state.status === 'ready' ? api.state.rows.find((r) => r.domain === domain) : undefined
  const saved = scope === 'project' ? row?.thisProject : row?.allProjects
  const where = scope === 'project' ? t('route.thisProject', 'this project', { ns: 'editor' }) : t('route.everyProject', 'every project', { ns: 'editor' })

  const status =
    api.state.status === 'loading'
      ? t('route.loadingDefaults', 'Loading your defaults…', { ns: 'editor' })
      : api.state.status === 'error'
        ? t('route.defaultsLoadFailed', "Couldn't load your saved defaults: {{reason}}. Saving still works.", { ns: 'editor', reason: api.state.message })
        : row?.thisProject
          ? t('route.openedOnProjectDefaults', 'Opened on your {{domain}} defaults for this project.', { ns: 'editor', domain: domainWords(domain, t) })
          : row?.allProjects
            ? t('route.openedOnEveryProjectDefaults', 'Opened on your {{domain}} defaults for every project.', { ns: 'editor', domain: domainWords(domain, t) })
            : t('route.noDefaultsYet', 'No {{domain}} defaults saved yet; the panel starts on the standard choices.', { ns: 'editor', domain: domainWords(domain, t) })

  const run = async (next: typeof settings | null, done: string) => {
    setBusy(true)
    const err = await api.save(domain, scope, next)
    setBusy(false)
    setMessage(err ? { error: true, text: err } : { error: false, text: done })
  }

  return (
    <Field data-testid="route-defaults">
      <FieldLabel htmlFor="bm-route-defaults-scope">{t('route.myDefaults', 'My defaults', { ns: 'editor' })}</FieldLabel>
      <FieldDescription className={api.state.status === 'error' ? 'text-danger-600' : undefined} data-testid="route-defaults-status">
        {api.state.status === 'loading' && <Spinner data-icon="inline-start" />}
        {status}
      </FieldDescription>
      <ToggleGroup id="bm-route-defaults-scope" type="single" variant="outline" size="sm" value={scope} onValueChange={(v) => (v === 'project' || v === 'all') && setScope(v)} aria-label={t('route.saveDefaultsFor', 'Save my defaults for', { ns: 'editor' })}>
        <ToggleGroupItem value="all">{t('route.everyProjectCapital', 'Every project', { ns: 'editor' })}</ToggleGroupItem>
        <ToggleGroupItem value="project">{t('route.thisProjectCapital', 'This project', { ns: 'editor' })}</ToggleGroupItem>
      </ToggleGroup>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(settings, t('route.defaultsSaved', 'Saved: new {{domain}} routes on {{where}} start like this.', { ns: 'editor', domain: domainWords(domain, t), where }))
          }
          data-testid="route-defaults-save"
        >
          {busy ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          {t('route.saveAsMyDefault', 'Save as my default', { ns: 'editor' })}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !saved}
          title={saved ? undefined : t('route.nothingSavedFor', 'Nothing is saved for {{where}}', { ns: 'editor', where })}
          onClick={() => run(null, t('route.defaultsForgotten', 'Forgot your {{domain}} defaults for {{where}}.', { ns: 'editor', domain: domainWords(domain, t), where }))}
          data-testid="route-defaults-clear"
        >
          {t('route.forget', 'Forget', { ns: 'editor' })}
        </Button>
      </div>
      {message && (
        <FieldDescription className={message.error ? 'text-danger-600' : 'text-success-700'} role={message.error ? 'alert' : 'status'} data-testid="route-defaults-message">
          {message.text}
        </FieldDescription>
      )}
      <FieldDescription>
        {t(
          'route.defaultsLede',
          "Saves the shape, size, insulation, elbows, takeoffs and rises shown above, for you only. This project's defaults win over every-project ones.",
          { ns: 'editor' },
        )}
      </FieldDescription>
    </Field>
  )
}
