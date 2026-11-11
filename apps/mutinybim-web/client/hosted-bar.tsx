/**
 * The hosted editor's bar: the way back to the model list, the model's name and who
 * owns it, then the language and theme controls, Ask AI (the person's own key,
 * browser to provider) and, when the deployment has one, the quote link.
 *
 * Kept out of `entry.tsx` so it can be rendered in a test: `entry.tsx` reads the
 * page data, opens a model host and mounts the app, which a test cannot do. The
 * model it draws comes in as a prop, and the words in the bar are still Stage 2's
 * English (`docs/i18n/` keeps that remainder); the language control beside the
 * theme control is what a person presses to change the editor's language, and the
 * chrome around it follows in the hosted-editor task.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge, Button, Card, CardDescription, CardTitle, LanguageToggle, Spinner, Textarea, ThemeToggle } from '@permitzip/bim-ui'
import { AiError, ask, providerName, readAiSettings } from './ai'

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

async function fetchSummary(modelId: string, signal: AbortSignal): Promise<Summary> {
  const response = await fetch(`/api/hosted/models/${encodeURIComponent(modelId)}/summary`, { signal, credentials: 'same-origin' })
  if (!response.ok) throw new AiError(response.status === 401 ? 'You are signed out. Log in again, then ask.' : 'The model summary could not be read from the server. Try again.')
  return (await response.json()) as Summary
}

function AskAiPanel({ model, onClose }: { readonly model: HostedBarModel; readonly onClose: () => void }) {
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
      const summary = await fetchSummary(model.modelId, controller.signal)
      const kinds = Object.entries(summary.byKind).map(([k, n]) => `${k}: ${n}`).join(', ')
      const system = `You help a person working in MutinyBIM, a browser building model for every AEC trade. Their model "${model.modelName}" is at revision ${summary.revision} with ${summary.elements} elements (${kinds || 'none'}), levels ${summary.levels.join(', ') || 'none'}, and ${summary.connections} connections. You can see only this summary, not the drawing. Answer plainly and briefly. To let an assistant change the model, they connect it with "Connect an assistant".`
      const text = await ask(settings, { system, question: question.trim(), signal: controller.signal })
      setState({ kind: 'answer', text })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState({ kind: 'idle' })
        return
      }
      if (!(err instanceof AiError)) console.error('[mutinybim-web] Ask AI failed', err)
      setState({ kind: 'error', text: err instanceof AiError ? err.message : 'Asking failed for a reason this page can\'t name. Try again.' })
    }
  }, [model.modelId, model.modelName, question, settings])

  return (
    <Card role="dialog" aria-label="Ask AI" data-testid="ask-ai-panel" className="fixed top-13 right-3 z-[2147483000] max-h-[calc(100dvh-70px)] w-[min(420px,calc(100vw-24px))] gap-3 overflow-auto shadow-xl">
      <div className="flex items-center">
        <CardTitle className="text-base">Ask AI</CardTitle>
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClose} aria-label="Close Ask AI">
          Close
        </Button>
      </div>
      {!settings ? (
        <CardDescription>
          No AI key in this browser yet. This app pays for no AI: add your own Claude, ChatGPT or Grok key in <a className="underline" href="/settings#ai">Settings → Your AI</a> (it stays in this browser), or <a className="underline" href="/connect">connect your assistant app</a>.
        </CardDescription>
      ) : (
        <>
          <CardDescription>Uses your {providerName(settings)} key, from this browser straight to {providerName(settings)}. It sees a summary of this model, not the drawing.</CardDescription>
          <Textarea
            ref={input}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
            }}
            rows={4}
            placeholder="What should I check before sizing these ducts?"
            aria-label="Your question"
          />
          <div className="flex items-center gap-2">
            <Button type="button" disabled={state.kind === 'asking' || !question.trim()} onClick={() => void submit()}>
              {state.kind === 'asking' ? <Spinner /> : null}
              {state.kind === 'asking' ? 'Asking…' : 'Ask'}
            </Button>
            {state.kind === 'asking' ? (
              <Button type="button" variant="outline" onClick={() => abort.current?.abort()}>
                Stop
              </Button>
            ) : null}
            {!question.trim() && state.kind !== 'asking' ? <span className="text-sm text-(--mutiny-muted)">Type a question first.</span> : null}
          </div>
          <div role="status" aria-live="polite" className="text-sm">
            {state.kind === 'asking' ? <p className="text-(--mutiny-muted)">Waiting for {providerName(settings)}…</p> : null}
            {state.kind === 'error' ? <p className="text-(--mutiny-danger)">{state.text}</p> : null}
            {state.kind === 'answer' ? <div className="rounded-(--mutiny-radius) bg-(--mutiny-subtle) p-2.5 whitespace-pre-wrap">{state.text}</div> : null}
          </div>
        </>
      )}
    </Card>
  )
}

export function HostedBar({ model }: { readonly model: HostedBarModel }) {
  const [askOpen, setAskOpen] = useState(false)
  const close = useCallback(() => setAskOpen(false), [])
  return (
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-(--mutiny-border) bg-(--mutiny-surface) px-3 py-1.5 text-sm text-(--mutiny-text)" data-testid="hosted-bar">
      <Button asChild variant="ghost" size="sm">
        <a href="/models" title="Back to my models">
          ← My models
        </a>
      </Button>
      <img src="/assets/bim-ui/mutiny-icon.svg" alt="" width={20} height={20} />
      <strong className="max-w-[40ch] truncate">{model.modelName}</strong>
      {model.owner ? <span className="text-(--mutiny-muted)">{model.owner}'s</span> : null}
      {model.access === 'view' ? (
        <Badge variant="secondary" title="The owner shared this model to view. Edits are refused.">View only</Badge>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
        <Button type="button" variant={askOpen ? 'outline' : 'default'} size="sm" onClick={() => setAskOpen((v) => !v)} aria-expanded={askOpen}>
          Ask AI
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href="/connect">Connect an assistant</a>
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
