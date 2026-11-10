/**
 * @jest-environment node
 *
 * Which language a request is answered in, in the order the bilingual app
 * settled on: the language cookie → the account's own language →
 * `Accept-Language` → English.
 *
 * The cookie wins over the account because it is this browser's explicit
 * choice, made by pressing the language toggle a moment ago; the account is
 * the preference that travels with the person; `Accept-Language` is only the
 * machine's guess. English is the floor: a header that names no language this
 * app speaks, and a damaged cookie, both answer in English rather than nothing.
 */
import { COOKIE_NAME, resolveRequestLanguage, type RequestLanguageInput } from "../src/i18n";

interface RequestParts {
  /** The value of the `mutiny.lang` cookie; omitted means no cookie at all. */
  readonly cookie?: string;
  /** The account's stored language, when the person is signed in. */
  readonly accountLanguage?: string;
  /** The `Accept-Language` header, exactly as a browser would send it. */
  readonly acceptLanguage?: string;
}

/** A request built the way the app builds one, with only the parts a case varies. */
function request(parts: RequestParts = {}): RequestLanguageInput {
  const headers: Record<string, string> = {};
  if (parts.acceptLanguage !== undefined) headers["accept-language"] = parts.acceptLanguage;
  return {
    cookies: parts.cookie === undefined ? {} : { [COOKIE_NAME]: parts.cookie },
    ...(parts.accountLanguage === undefined ? {} : { user: { language: parts.accountLanguage } }),
    header: (name: string) => headers[name.toLowerCase()],
  };
}

test("the language cookie decides the language", () => {
  // The cookie is the browser's own choice and beats everything behind it.
  expect(resolveRequestLanguage(request({ cookie: "tr", accountLanguage: "en", acceptLanguage: "en-US,en;q=0.9" }))).toBe("tr");
  expect(resolveRequestLanguage(request({ cookie: "en", accountLanguage: "tr", acceptLanguage: "tr-TR,tr;q=0.9" }))).toBe("en");
});

test("the account's language decides when there is no cookie", () => {
  expect(resolveRequestLanguage(request({ accountLanguage: "tr", acceptLanguage: "en-US,en;q=0.9" }))).toBe("tr");
  expect(resolveRequestLanguage(request({ accountLanguage: "en", acceptLanguage: "tr-TR,tr;q=0.9" }))).toBe("en");
});

test("Accept-Language: tr is honoured when neither the cookie nor the account says", () => {
  expect(resolveRequestLanguage(request({ acceptLanguage: "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7" }))).toBe("tr");
  // A language this app does not speak is skipped, not treated as a refusal.
  expect(resolveRequestLanguage(request({ acceptLanguage: "fr-FR,tr;q=0.9" }))).toBe("tr");
});

test("English is the answer when nothing names a language this app speaks", () => {
  expect(resolveRequestLanguage(request())).toBe("en");
  expect(resolveRequestLanguage(request({ acceptLanguage: "en-GB,en;q=0.9" }))).toBe("en");
  expect(resolveRequestLanguage(request({ acceptLanguage: "de-DE,de;q=0.9" }))).toBe("en");
});

test("a cookie or account value that is not a language is ignored, never thrown", () => {
  // A hand-edited or half-written cookie must not cost the person their page.
  for (const damaged of ["", "TR", "turkish", "tr-TR", "{}", "en;tr"]) {
    expect(resolveRequestLanguage(request({ cookie: damaged, acceptLanguage: "tr" }))).toBe("tr");
    expect(resolveRequestLanguage(request({ accountLanguage: damaged, acceptLanguage: "tr" }))).toBe("tr");
  }
});

test("the cookie name is the one stage 1 writes", () => {
  // `LANGUAGE_STORAGE_KEY` in packages/bim-ui is the same name for the browser's
  // local storage; one name describes the choice on both sides.
  expect(COOKIE_NAME).toBe("mutiny.lang");
});
