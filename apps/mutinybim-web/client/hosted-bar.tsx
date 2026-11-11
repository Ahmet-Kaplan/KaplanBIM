/**
 * The hosted editor's bar: the way back to the model list, the model's name and who
 * owns it, then the language and theme controls, Ask AI (the person's own key,
 * browser to provider) and, when the deployment has one, the quote link.
 *
 * Kept out of `entry.tsx` so it can be rendered in a test: `entry.tsx` reads the
 * page data, opens a model host and mounts the app, which a test cannot do. The
 * model it draws comes in as a prop.
 *
 * Every word here is keyed in this app's `web` namespace (`locales/tr/web.json`),
 * so the bar comes out in the language the editor is drawn in: it was Stage 2's
 * English under a Turkish editor for one stage, which is the mixed-language screen
 * the bilingual UI is not allowed to ship. The provider that holds the language is
 * `./editor-language`, mounted by `entry.tsx` above this bar.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge, Button, Card, CardDescription, CardTitle, LanguageToggle, Spinner, Textarea, ThemeToggle, useT } from '@permitzip/bim-ui'
import { AiError, ask, providerName, readAiSettings } from './ai'
import type { TFunction } from 'i18next'

/** What the bar shows about the model it is over: the page's own data, minus the socket. */
export interface HostedBarModel {
  readonly modelId: string
  readonly modelName: string
  /** Whose model it is, when it was shared with this person. */
  readonly owner: string | null
  /** owner, edit or view (view: the model server refuses edits). */
  readonly access: 'owner' | 'edit' | 'view'
  readonly quoteLabel: string | null
}

interface Summary {
  readonly revision: number
  readonly elements: number
  readonly byKind: Readonly<Record<string, number>>
  readonly levels: readonly string[]
  readonly connections: number
}

async function fetchSummary(modelId: string, signal: AbortSignal, t: TFunction): Promise<Summary> {
  const response = await fetch(`/api/hosted/models/${encodeURIComponent(modelId)}/summary`, { signal, credentials: 'same-origin' })
  if (!response.ok) {
    throw new AiError(
      response.status === 401
        ? t('ai.error.signedOut', 'You are signed out. Log in again, then ask.', { ns: 'web' })
        : t('ai.error.summary', 'The model summary could not be read from the server. Try again.', { ns: 'web' }),
    )
  }
  return (await response.json()) as Summary
}

function AskAiPanel({ model, onClose }: { readonly model: HostedBarModel; readonly onClose: () => void }) {
  const t = useT('web')
  const [settings] = useState(() => readAiSettings())
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'asking' } | { kind: 'answer'; text: string } | { kind: 'error'; text: string }>({ kind: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const input = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    input.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      abort.current?.abort()
    }
  }, [onClose])

  const submit = useCallback(async () => {
    if (!settings || !question.trim()) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setState({ kind: 'asking' })
    try {
      const summary = await fetchSummary(model.modelId, controller.signal, t)
      const kinds = Object.entries(summary.byKind).map(([k, n]) => `${k}: ${n}`).join(', ')
      const none = t('ai.prompt.none', 'none', { ns: 'web' })
      const system = t(
        'ai.prompt.system',
        'You help a person working in MutinyBIM, a browser building model for every AEC trade. Their model "{{model}}" is at revision {{revision}} with {{elements}} elements ({{kinds}}), levels {{levels}}, and {{connections}} connections. You can see only this summary, not the drawing. Answer plainly and briefly. To let an assistant change the model, they connect it with "Connect an assistant".',
        {
          ns: 'web',
          model: model.modelName,
          revision: summary.revision,
          elements: summary.elements,
          kinds: kinds || none,
          levels: summary.levels.join(', ') || none,
          connections: summary.connections,
        },
      )
      const text = await ask(settings, { system, question: question.trim(), signal: controller.signal }, t)
      setState({ kind: 'answer', text })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState({ kind: 'idle' })
        return
      }
      if (!(err instanceof AiError)) console.error('[mutinybim-web] Ask AI failed', err)
      setState({
        kind: 'error',
        text: err instanceof AiError ? err.message : t('askAi.failed', "Asking failed for a reason this page can't name. Try again.", { ns: 'web' }),
      })
    }
  }, [model.modelId, model.modelName, question, settings, t])

  return (
    <Card
      role="dialog"
      aria-label={t('askAi.title', 'Ask AI', { ns: 'web' })}
      data-testid="ask-ai-panel"
      className="fixed top-13 right-3 z-[2147483000] max-h-[calc(100dvh-70px)] w-[min(420px,calc(100vw-24px))] gap-3 overflow-auto shadow-xl"
    >
      <div className="flex items-center">
        <CardTitle className="text-base">{t('askAi.title', 'Ask AI', { ns: 'web' })}</CardTitle>
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClose} aria-label={t('askAi.closeLabel', 'Close Ask AI', { ns: 'web' })}>
          {t('askAi.close', 'Close', { ns: 'web' })}
        </Button>
      </div>
      {!settings ? (
        <CardDescription>
          {t('askAi.noKey', 'No AI key in this browser yet. This app pays for no AI: add your own Claude, ChatGPT or Grok key in', { ns: 'web' })}{' '}
          <a className="underline" href="/settings#ai">
            {t('askAi.settingsYourAi', 'Settings → Your AI', { ns: 'web' })}
          </a>{' '}
          {t('askAi.staysInBrowser', '(it stays in this browser), or', { ns: 'web' })}{' '}
          <a className="underline" href="/connect">
            {t('askAi.connectYourAssistant', 'connect your assistant app', { ns: 'web' })}
          </a>
          .
        </CardDescription>
      ) : (
        <>
          <CardDescription>
            {t('askAi.usesKey', 'Uses your {{provider}} key, from this browser straight to {{provider}}. It sees a summary of this model, not the drawing.', {
              ns: 'web',
              provider: providerName(settings, t),
            })}
          </CardDescription>
          <Textarea
            ref={input}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
            }}
            rows={4}
            placeholder={t('askAi.questionPlaceholder', 'What should I check before sizing these ducts?', { ns: 'web' })}
            aria-label={t('askAi.questionLabel', 'Your question', { ns: 'web' })}
          />
          <div className="flex items-center gap-2">
            <Button type="button" disabled={state.kind === 'asking' || !question.trim()} onClick={() => void submit()}>
              {state.kind === 'asking' ? <Spinner /> : null}
              {state.kind === 'asking' ? t('askAi.asking', 'Asking…', { ns: 'web' }) : t('askAi.ask', 'Ask', { ns: 'web' })}
            </Button>
            {state.kind === 'asking' ? (
              <Button type="button" variant="outline" onClick={() => abort.current?.abort()}>
                {t('askAi.stop', 'Stop', { ns: 'web' })}
              </Button>
            ) : null}
            {!question.trim() && state.kind !== 'asking' ? (
              <span className="text-sm text-(--mutiny-muted)">{t('askAi.typeFirst', 'Type a question first.', { ns: 'web' })}</span>
            ) : null}
          </div>
          <div role="status" aria-live="polite" className="text-sm">
            {state.kind === 'asking' ? (
              <p className="text-(--mutiny-muted)">{t('askAi.waiting', 'Waiting for {{provider}}…', { ns: 'web', provider: providerName(settings, t) })}</p>
            ) : null}
            {state.kind === 'error' ? <p className="text-(--mutiny-danger)">{state.text}</p> : null}
            {state.kind === 'answer' ? <div className="rounded-(--mutiny-radius) bg-(--mutiny-subtle) p-2.5 whitespace-pre-wrap">{state.text}</div> : null}
          </div>
        </>
      )}
    </Card>
  )
}

export function HostedBar({ model }: { readonly model: HostedBarModel }) {
  const t = useT('web')
  const [askOpen, setAskOpen] = useState(false)
  const close = useCallback(() => setAskOpen(false), [])
  return (
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-(--mutiny-border) bg-(--mutiny-surface) px-3 py-1.5 text-sm text-(--mutiny-text)" data-testid="hosted-bar">
      <Button asChild variant="ghost" size="sm">
        <a href="/models" title={t('bar.backTitle', 'Back to my models', { ns: 'web' })}>
          {t('bar.back', '← My models', { ns: 'web' })}
        </a>
      </Button>
      <img src="/assets/bim-ui/mutiny-icon.svg" alt="" width={20} height={20} />
      <strong className="max-w-[40ch] truncate">{model.modelName}</strong>
      {model.owner ? (
        <span className="text-(--mutiny-muted)">{t('bar.owner', "{{owner}}'s", { ns: 'web', owner: model.owner })}</span>
      ) : null}
      {model.access === 'view' ? (
        <Badge variant="secondary" title={t('bar.viewOnlyTitle', 'The owner shared this model to view. Edits are refused.', { ns: 'web' })}>
          {t('common.viewOnly', 'View only', { ns: 'web' })}
        </Badge>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
        <Button type="button" variant={askOpen ? 'outline' : 'default'} size="sm" onClick={() => setAskOpen((v) => !v)} aria-expanded={askOpen}>
          {t('askAi.title', 'Ask AI', { ns: 'web' })}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href="/connect">{t('nav.connect', 'Connect an assistant', { ns: 'web' })}</a>
        </Button>
        {model.quoteLabel ? (
          <Button asChild variant="outline" size="sm">
            <a href={`/quote?model=${encodeURIComponent(model.modelId)}`}>{model.quoteLabel}</a>
          </Button>
        ) : null}
      </span>
      {askOpen ? createPortal(<AskAiPanel model={model} onClose={close} />, document.body) : null}
    </div>
  )
}
