# The editor and its host

## What it owns

| Where | What |
|---|---|
| `packages/bim-editor-host/` | The **host contract**, types only: `data.ts` (one optional port per capability, `EditorDataHost` at `:385`), `shell.ts` (the host's frame), `index.ts` (`EditorHost`, `EditorStorage`, `EditorAgentHost`, `EditorHostCapabilities`) |
| `packages/bim-editor/` | The editing screens, their vendored shadcn primitives, `src/host/` (the provider, the contract's conformance check, the words for a missing service) and `src/editor/i18n/` |
| `packages/bim-editor/src/host/local.ts` | The standalone host: one person, the local model server, no built-in agent, no file storage. Its own entry (`/host/local`), because it imports the kernel |
| `packages/bim-editor/demo/` | The standalone page (`entry.tsx`) and the small server that serves it (`server.ts`, `build.ts`), which `packages/bim-devserver` mounts at `/m/<model>` |

## The contract

1. **The editor creates none of its own providers.** It *consumes* the theme
   (`useMutinyTheme`) and the language (`useEditorTranslate`, `useEditorLanguage`)
   from context. There is no `createI18n` and no `MutinyThemeProvider` in
   `packages/bim-editor/src`; the only hits are the doc comment in
   `src/editor/i18n/resources.ts:7` saying the host wraps it.
2. **The host supplies four things.**
   - **Theme**: `MutinyThemeProvider` from `@permitzip/bim-ui`, with the host's own
     overrides and colour-scheme adapter.
   - **Language**: `I18nProvider` with the host's language **and every namespace
     merged** — the editor's `editorResources` *and* the schedule surfaces'
     `schedulesResources`, plus the host app's own. The editor's own test wraps the
     surfaces itself, so a host that forgets one is invisible to it.
   - **Services**: `host.data`, one optional port per capability — firm library,
     linked models, drawing sets, IFC import and export, code adoption, questions,
     signing, preferences, underlays, route defaults. A missing port is not an error.
   - **The frame**: `host.shell` — the settings layout, the header slot, the link
     component, the issued-sheet links. Absent pieces are replaced by plain words.
3. **Identity, session, routing and messages are the host's too**:
   `identity`, `session.openConfig`/`getAccessToken`, `router`, `links`,
   `notify`, `preferences` (`index.ts:173-187`).
4. **What the editor says when a port is missing.** `unavailableWords(service, host)`
   produces "`Firm title blocks`: not available here, because `this app` doesn't
   provide it. Connect it in Settings › Integrations, or open this model where it is
   set up." — built from `capabilities.hostName` and `capabilities.connectHint`
   (`src/host/unavailable.ts:10-14`). It is a sentence about the host, not an error
   thrown at the person.
5. **`storage` and `agent` are optional and named.** Both are in `EditorHost` as
   optional, and `EditorOptionalService` names them for those messages
   (`index.ts:184-190`). A host with no storage can still edit.
6. **The standalone host exists so the editor can be opened without a product.**
   `createLocalEditorHost({ authorityUrl })` (`src/host/local.ts:105`) plus
   `createLocalShellHost` gives a real `EditorHost` with no sign-in, no storage and no
   agent; `checkEditorHostConformance` passes on it
   (`__tests__/local-host.test.tsx:13`). The demo page wraps it in the theme, the
   language provider and a `Toaster`, and that page is what the dev server serves.
7. **The editor does not know the hosted app.** `@permitzip/bim-editor-host` is a peer
   dependency; `apps/` is not referenced anywhere in its manifest, and the
   open-source boundary forbids `@/` and a relative path that leaves the MutinyBIM
   trees (`eslint/plugins/mutinybim-oss-boundary.mjs:10`). The hosted app is a client
   of the contract, not a special case in it.

## How it goes wrong

- **The editor creating its own i18n or theme instance.** Convenient for a page that
  only wanted a schedule, and it silently overrides the host's language for everything
  underneath. *Tell:* `createI18n(` or `<I18nProvider` appearing under
  `packages/bim-editor/src` outside a comment or a test.
- **A host forgetting a namespace.** This happened: the app passed `editorResources`
  alone, so 360 schedule keys fell back to English at runtime while the package's own
  tests stayed green, because those tests wrap the surfaces themselves. The hosted
  app's comment now records it and merges three namespaces in one place
  (`apps/mutinybim-web/client/editor-language.tsx:36-50`); the same hole also left the
  app's own bar English under a Turkish editor.
- **A screen that says "not available here" where the host contract could have
  supplied it.** The message is for a capability the host genuinely lacks. Using it
  because the port was not wired yet makes a missing integration look like a product
  decision, and the person has no way to tell the difference.
- **A new port invented inside the editor.** `host.data` is the seam; a `fetch` to a
  host route from an editor screen re-couples the two, and there is no rule against it.
- **The editor knowing about the hosted app.** A branch on `hostName === 'MutinyBIM'`,
  or an import from `apps/`. The next host then has to match that name.
- **A host entry that drags the engine along.** `@permitzip/bim-editor/host` is imported
  by pages that never open the editor; it must stay kernel-free. It once re-exported
  the standalone host and shipped the kernel, units and formulas to a project page
  (`__tests__/host-entries-light.test.ts:1-10`).

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-editor/__tests__/host-entries-light.test.ts` | `/host` and `/host/context` reaching `bim-kernel`, `bim-units` or `bim-formula` by value | the size of anything those entries legitimately import |
| `checkEditorHostConformance` (`src/host/conformance.ts:15`) | an incomplete host: empty identity or `hostName`, a bad token shape, a missing router or notifier method, a `storage` or `agent` present but incomplete | whether the host supplies the right *namespaces*; it never renders |
| `packages/bim-editor/__tests__/local-host.test.tsx` | the standalone host drifting out of conformance | any other host |
| `apps/mutinybim-web/__tests__/editor-language.test.ts` | page data → provider → editor translator → a ribbon word in Turkish, including the schedules namespace | a fourth namespace nobody merges |
| `packages/bim-editor/__tests__/i18n-*.test.tsx`, `i18n-negative-space.test.ts` | captions reverting to literals; user-visible English outside a translator (see [i18n](i18n.md)) | a namespace merged nowhere |

No guard forbids the editor from creating a provider, and none checks that a host
merges every namespace a surface needs. Both are review-only.
