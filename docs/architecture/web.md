# The hosted web app

Everything here is `apps/mutinybim-web`. The bilingual rules it follows are in
[i18n](i18n.md); this page is how the app is put together and where it breaks.

## What it owns

| Where | What |
|---|---|
| `src/server.ts` (42 lines) | Config, the listener, `SIGINT`/`SIGTERM`. Nothing else |
| `src/app.ts` (1057 lines) | `createApp`: one request handler, every route, the editor page, the error page |
| `src/pages.tsx` (1454 lines) | The server-rendered pages, one function each, each taking `language` |
| `src/ui.tsx` | The frame every page shares, drawn with `bim-ui` primitives; `themeStyleSheet()` at `:20` |
| `src/i18n.ts` | Language resolution and the per-language translator |
| `client/` | The editor bundle: `entry.tsx`, `editor-language.tsx`, `approvals.ts`, `ai.ts`, `hosted-bar.tsx`, `settings.ts`, `web-i18n.ts` |
| `src/assistant-auth.ts`, `assistant-approvals.ts`, `assistant-tools.ts`, `linked-hosts.ts` | The assistant surfaces |
| `locales/tr/web.json` | The Turkish for `pages.tsx`, `ui.tsx` and `client/` |

## The contract

1. **One app, two halves.** The pages are rendered on the server: HTML built by
   functions in `pages.tsx`, wrapped by `page()` in `ui.tsx`, with the theme inlined as
   `--mutiny-*` variables from `themeStyleSheet()`. The editor is a separate client
   bundle, built by `src/build-editor.ts` from `client/entry.tsx` and served at
   `/dist/app.js`.
2. **What crosses between them is page data, and only page data.** The editor page
   embeds `<script type="application/json" id="mutinybim-page">` (`src/app.ts:873-901`)
   with the model id and name, the person, their access level, the owner, the colour
   scheme, the quote label **and the resolved language**. `client/entry.tsx:38` reads
   it once, validates each field, and falls back rather than throwing.
3. **Language is resolved once per request**, in this order: the language cookie, the
   account's own setting, `Accept-Language` (ranked, `q=0` honoured), then English
   (`src/i18n.ts:88-93`). The page and its `<html lang>` therefore always agree.
4. **Every page function takes `language`.** A page does not read the cookie; it is
   handed the answer the request already resolved. The same value is what the editor
   gets in the page data, so the bar and the stage cannot disagree.
5. **The cookie decode is fault tolerant.** A cookie whose value is not valid
   percent-encoding (`mutiny.lang=%`, `x=100%`, a truncated `%E0%A4%A`) is skipped, not
   thrown on: `decodeURIComponent` raises `URIError`, and a damaged preference is not a
   reason to lose the page (`src/app.ts:114-131`). `requestLanguage` is wrapped too, and
   answers `en` with a logged error rather than failing the request (`:148-164`).
6. **The listener does nothing synchronously.** `createServer`'s callback calls
   `handle(req, res).catch(...)` and nothing else, because that callback is outside
   every promise chain: a synchronous throw there ends the **process**, not the request
   (`src/app.ts:906-909`). The error page itself is drawn inside a `try`, with a plain
   text answer behind it.
7. **The assistant surfaces are pages, not API-only.** Consent
   (`assistantConsentPage`, `pages.tsx:1151`), the waiting approvals list and one
   approval (`/approvals`, `/approvals/<id>`, `pages.tsx:1217,1269`) and the linked-host
   offer (`linkedOfferPage`, `pages.tsx:1398`). Approvals are answered by the signed-in
   person in the assistant's own box, on these pages, or not at all — the assistant
   cannot approve (`assistant-approvals.ts:18-19`). Tokens from the assistant sign-in
   reach the tool server only and never sign anyone in to a page (`assistant-auth.ts:20-21`).

`docs/LINKED-HOSTS.md` is what a host implements; the app side is in its README.

## How it goes wrong

- **A handler that can throw outside a `try` in the listener.** This shipped once: the
  language was read synchronously inside `createServer`'s callback, so an undecodable
  cookie threw `URIError` there and took the process down. Commit `e79880a` moved the
  read inside the promise chain and wrapped it. *Tell:* any work added to that callback
  before `handle(...)`.
- **A client module with English chrome above a Turkish editor.** `Ask AI`, `View only`,
  `← My models`, `Connect an assistant` — the pages and the editor were Turkish while
  the app's own bar was English, and every guard stayed green because none of them
  looked outside `packages/`.
- **A namespace not merged into the provider.** The editor page passed
  `editorResources` alone, so the schedule surfaces' 360 keys fell back to English at
  runtime while their tests passed. The provider now merges three
  (`apps/mutinybim-web/client/editor-language.tsx:36-50`); a fourth surface needs a
  fourth argument, and nothing fails if it is forgotten.
- **A page that reads its own cookie** instead of taking the resolved language. Two
  answers to one question, and the header, the page and the editor's stage drift apart.
- **A damaged page data field treated as fatal.** `readPageData` throws only when the
  script element is missing or not an object; every field falls back. A new required
  field added without a fallback makes a deploy-time mismatch a blank screen.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `apps/mutinybim-web/__tests__/i18n-language-cookie.test.ts` | the resolution order; a malformed cookie answering English instead of throwing; `q=0` | a page that ignores the value it was given |
| `packages/bim-editor/__tests__/i18n-negative-space.test.ts` | unkeyed user-visible English in **every** `apps/*/client` directory, found by discovery rather than a list (`:260-273`) | the server-rendered pages — those are covered by `pages-language.test.ts` |
| `apps/mutinybim-web/__tests__/client-captions.test.ts` | a **keyed** caption whose English was quietly rewritten, and the number of sites each key is written at | a key with no pin |
| `apps/mutinybim-web/__tests__/pages-language.test.ts` | a page function that does not speak Turkish; a request with the cookie or only `Accept-Language: tr` arriving in English; a raw key reaching the screen | a caption with no `t()` |
| `apps/mutinybim-web/__tests__/i18n-header.test.ts` | the shared frame in both languages; choosing a language saving it and changing the very next request; dates formatted with the page's locale | a new page that never goes through `page()` |
| `apps/mutinybim-web/__tests__/editor-language.test.ts` | page data → provider → editor translator → a ribbon word in Turkish, across the editor and schedules namespaces | a namespace nobody merges |
| `apps/mutinybim-web/__tests__/app.test.ts` | the end-to-end product over HTTP and WebSocket: sign-up, strangers kept out, sharing, agent-key edits, restart | a malformed request header crashing the process |
| `packages/bim-ui/__tests__/theme-token-compliance.test.ts` | hex outside the theme in `apps/mutinybim-web/src` too — see [viewers](viewers.md) | colours the server inlines as a string attribute rather than a style |

No guard drives a malformed `Cookie` header through the real HTTP listener; the seam it
would reach first, `cookies()`, is tested directly. No guard asserts that
`createServer`'s callback stays free of synchronous work. Both are review-only, which
is thin for a failure mode whose cost was the whole process.
