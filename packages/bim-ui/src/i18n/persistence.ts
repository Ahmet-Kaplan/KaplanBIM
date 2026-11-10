import { isMutinyLanguage, type MutinyLanguage } from "./index";

/**
 * Where a language choice is kept between visits. The editor's local demo writes
 * the same name to `localStorage`; the hosted app uses it as its cookie name, so
 * one name describes the choice on both sides. The value is a contract with the
 * server (see the language cookie), so the guard test pins it.
 */
export const LANGUAGE_STORAGE_KEY = "mutiny.lang";

/**
 * The saved language, or `undefined` when there is none, when the value is not a
 * language this kit speaks, or when the store cannot be read at all (no `window`
 * on the server, or a browser that refuses `localStorage` in private mode).
 * Never throws: a damaged preference must not stop the app from starting.
 */
export function readLanguagePreference(storage: Storage | undefined): MutinyLanguage | undefined {
  if (!storage) return undefined;
  try {
    const stored = storage.getItem(LANGUAGE_STORAGE_KEY);
    return isMutinyLanguage(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Saves the choice. A refusal (private mode, full quota) is swallowed on purpose:
 * the language still holds for this visit, and losing a stored preference is not
 * worth breaking the click that set it.
 */
export function writeLanguagePreference(storage: Storage | undefined, language: MutinyLanguage): void {
  if (!storage || !isMutinyLanguage(language)) return;
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Nothing to do: the in-memory choice is already on screen.
  }
}

/** What the app knows about the person's language before it draws the first frame. */
export interface InitialLanguageInput {
  /** The signed-in person's own setting; it travels with them, so it wins. */
  readonly account?: MutinyLanguage;
  /** This browser's saved choice (see `readLanguagePreference`). */
  readonly stored?: MutinyLanguage;
  /** `navigator.language` (or `navigator.languages[0]`) on the client. */
  readonly navigator?: string;
}

/** A tag like `tr`, `tr-TR` (and `TR-tr`) is Turkish; every other tag is English. */
function isTurkishTag(tag: string | undefined): boolean {
  return tag !== undefined && tag.toLowerCase().startsWith("tr");
}

/**
 * The language to open in, in the order the bilingual UI settled on:
 * account → this browser's saved choice → the browser's own language → English.
 * A person's account preference beats the machine they happen to be on, and
 * English is the floor: an unknown tag never leaves the app blank.
 */
export function resolveInitialLanguage({ account, stored, navigator: tag }: InitialLanguageInput): MutinyLanguage {
  if (isMutinyLanguage(account)) return account;
  if (isMutinyLanguage(stored)) return stored;
  return isTurkishTag(tag) ? "tr" : "en";
}
