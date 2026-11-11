'use client'

import { Check, RefreshCw, Users } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../ui/command'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Spinner } from '../../ui/spinner'
import type { ForwardCandidate } from '../../contracts/bim/questions/contract'
import { useEditorTranslate } from '../i18n/translate'

export type PeopleState = { readonly kind: 'loading' } | { readonly kind: 'error'; readonly message: string } | { readonly kind: 'ready'; readonly people: readonly ForwardCandidate[] }

/** "Acme Steel · Guest", "Team · Project Lead": who they are and where their access comes from. */
export function personDetail(p: ForwardCandidate): string {
  return [p.company, p.access].filter((x): x is string => Boolean(x && x.trim())).join(' · ')
}

/**
 * Pick one person on the project: the list comes from the project's real
 * access (members, groups, guests, client organization, administrators),
 * only people who can open the building model, never you. Names and
 * companies are shown, nothing to remember (Nielsen 6). Loading, empty and
 * error are visible, the error with Try again (1, 9).
 */
export function ProjectPersonPicker({ state, selected, onSelect, onRetry }: { readonly state: PeopleState; readonly selected: string | null; readonly onSelect: (person: ForwardCandidate) => void; readonly onRetry: () => void }) {
  const t = useEditorTranslate()
  if (state.kind === 'loading')
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="person-picker-loading">
        <Spinner />
        {t('questions.loadingPeople', "Loading the project's people…", { ns: 'editor' })}
      </p>
    )
  if (state.kind === 'error')
    return (
      <Alert variant="destructive" data-testid="person-picker-error">
        <AlertTitle>{t('questions.peopleDidntLoadTitle', "The project's people didn't load", { ns: 'editor' })}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>{state.message}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" />
            {t('questions.tryAgain', 'Try again', { ns: 'editor' })}
          </Button>
        </AlertDescription>
      </Alert>
    )
  if (state.people.length === 0)
    return (
      <Empty className="p-4" data-testid="person-picker-empty">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>{t('questions.noOneElse', 'No one else here can open the model', { ns: 'editor' })}</EmptyTitle>
          <EmptyDescription>{t('questions.noOneElseHint', 'Ask a project lead to add them to the project, or forward it to a company outside the project.', { ns: 'editor' })}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <Command className="rounded-md border" data-testid="person-picker">
      <CommandInput placeholder={t('questions.searchPeoplePlaceholder', 'Search by name or company', { ns: 'editor' })} aria-label={t('questions.searchPeople', "Search the project's people", { ns: 'editor' })} />
      <CommandList className="max-h-56">
        <CommandEmpty>{t('questions.noMatch', 'No one on this project matches.', { ns: 'editor' })}</CommandEmpty>
        <CommandGroup heading={t('questions.peopleOnThisProject', 'People on this project', { ns: 'editor' })}>
          {state.people.map((p) => (
            <CommandItem key={p.userId} value={`${p.name} ${p.company ?? ''} ${p.email}`} onSelect={() => onSelect(p)} data-testid="person-picker-option" data-user={p.userId} aria-selected={selected === p.userId}>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{p.name}</span>
                <span className="truncate text-xs text-muted-foreground">{personDetail(p)}</span>
              </div>
              {selected === p.userId ? <Check aria-label={t('questions.picked', 'Picked', { ns: 'editor' })} /> : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
