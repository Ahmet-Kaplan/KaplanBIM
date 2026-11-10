"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import type { Resource } from "i18next";
import { createI18n, isMutinyLanguage, type MutinyLanguage } from "./index";

/** The language as any control sees it, with the reason the last change failed. */
export interface MutinyLanguageState {
  /** The language on screen now. */
  readonly language: MutinyLanguage;
  /** Switches the whole tree, tells the host and updates `<html lang>`. */
  setLanguage(language: MutinyLanguage): void;
  /** Plain-words reason the last change was not applied, else undefined. */
  readonly error?: string;
}

const LanguageContext = createContext<MutinyLanguageState | null>(null);

export interface I18nProviderProps {
  readonly children: ReactNode;
  /** The language to show. The host owns it: change this prop to change the tree. */
  readonly language: MutinyLanguage;
  /** Told about every change made through `setLanguage`, so the host can persist it. */
  readonly onLanguageChange?: (language: MutinyLanguage) => void;
  /** Extra namespaces (or overrides) on the Turkish strings the kit ships with. Read once, so pass a stable object. */
  readonly resources?: Resource;
}

interface LanguageState {
  /** What the tree shows. */
  readonly stored: MutinyLanguage;
  /** The `language` prop these values were taken from. */
  readonly hostLanguage: MutinyLanguage;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Gives the tree one i18next instance in the host's language, and keeps
 * `<html lang>` in step so screen readers and the browser agree with the screen.
 *
 * English text never changes: Turkish keys live in `locales/tr`, and a key that
 * is missing there shows the call site's English `defaultValue`.
 */
export function I18nProvider({ children, language, onLanguageChange, resources }: I18nProviderProps) {
  const [instance] = useState(() => createI18n({ language, resources }));
  const [state, setState] = useState<LanguageState>(() => ({ stored: language, hostLanguage: language }));
  const [error, setError] = useState<string | undefined>(undefined);

  // The host owns `language`. A changed prop is adopted in this render, so the
  // first paint after a settings page or another window changes it is already
  // in the new language — not one effect tick (and one stale frame) later.
  if (language !== state.hostLanguage) {
    setState({ stored: language, hostLanguage: language });
    if (error !== undefined) setError(undefined);
  }
  const current = state.stored;

  // The language the instance is really in, so a failed switch knows where to go back to.
  const applied = useRef<MutinyLanguage>(language);

  useEffect(() => {
    if (instance.resolvedLanguage === current) {
      applied.current = current;
      return;
    }
    const previous = applied.current;
    const failed = (err: unknown) => {
      console.error("[I18nProvider] switching language failed; going back to the previous one", { language: current, previous, err });
      setError(`Couldn't switch language: ${errorText(err)}`);
      // Put the screen back where it really is; the effect then settles on
      // `previous` because the instance is already there.
      setState((s) => (s.stored === previous ? s : { ...s, stored: previous }));
    };
    try {
      void Promise.resolve(instance.changeLanguage(current)).then(() => {
        applied.current = current;
      }, failed);
    } catch (err) {
      failed(err);
    }
  }, [instance, current]);

  const previousDocumentLanguage = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    if (previousDocumentLanguage.current === null) previousDocumentLanguage.current = el.lang;
    el.lang = current;
  }, [current]);

  useEffect(() => {
    const previous = previousDocumentLanguage.current;
    return () => {
      if (typeof document === "undefined" || previous === null) return;
      document.documentElement.lang = previous;
    };
  }, []);

  const setLanguage = useCallback(
    (next: MutinyLanguage) => {
      if (!isMutinyLanguage(next) || next === current) return;
      setError(undefined);
      setState((s) => ({ ...s, stored: next }));
      onLanguageChange?.(next);
    },
    [current, onLanguageChange],
  );

  const value = useMemo<MutinyLanguageState>(() => ({ language: current, setLanguage, error }), [current, setLanguage, error]);

  return (
    <I18nextProvider i18n={instance}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </I18nextProvider>
  );
}

export function useMutinyLanguage(): MutinyLanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useMutinyLanguage must be used inside <I18nProvider>.");
  return ctx;
}
