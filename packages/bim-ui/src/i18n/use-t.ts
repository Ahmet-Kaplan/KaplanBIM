"use client";

import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

/**
 * The translator for one namespace (`common` by default).
 *
 * Write `t('some.key', 'English text')`: English is the single source of truth at
 * the call site, and Turkish comes from the namespace's `locales/tr` file. A
 * missing Turkish key falls back to that English text, never to the key name.
 */
export function useT(namespace?: string): TFunction {
  const { t } = useTranslation(namespace);
  return t;
}
