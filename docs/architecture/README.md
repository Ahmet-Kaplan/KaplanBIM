# Architecture

Canonical rules for code under `packages/`, `services/`, `apps/` and `tools/`. Read on
demand from [`AGENTS.md`](../../AGENTS.md) and before an architecture review.

`docs/ARCHITECTURE.md` is the **tour**: how the pieces fit and how an edit travels. This
directory is the **contract** for each subsystem: what it owns, what it promises, and how
it goes wrong. When the two disagree, this directory wins and the tour is out of date.

## Why this exists

Every rule below was paid for. Almost all of them were learnt by shipping the wrong thing
first, and the code now carries the *what* while the *why* decays in pull-request
conversation. That is expensive: an agent or a new contributor re-derives the same
conclusions, or breaks the rule and fixes the symptom.

These pages are short on purpose. Each one answers four questions and stops:

- **What it owns** — the files, and the boundary.
- **The contract** — what callers may rely on, in plain sentences.
- **How it goes wrong** — the tells of drift: the specific smell that means someone has
  broken the contract. This is the part that saves time.
- **Where the guard is** — the test that fails, if one exists. A rule with no test is a
  hope; say so rather than implying enforcement.

## Pages

### The engine

| Page | Covers |
|---|---|
| [layers](layers.md) | The seven layers, what may import what, and the test that walks every runtime import |
| [model](model.md) | `ModelState`, element kinds as registry rows, types over parameters, connected networks, groups/phases/partitions, and why models hold no money |
| [commands](commands.md) | The edit spine: intent commands, the server re-running them, conflict on authored fields, idempotency, batches, agents as actors |
| [sync](sync.md) | Backend-neutral sync, leases, durable commits, the two servers, and what a client may assume |
| [units](units.md) | Typed units: why no bare number crosses a boundary, and how a unit kind is declared |
| [geometry](geometry.md) | The primitives, the polygon algorithms, and what a solid is allowed to be |

### Working with a model

| Page | Covers |
|---|---|
| [qto](qto.md) | Measure → group → takeoff; the measure vocabulary; **layers take off per face**; why prices never enter the model |
| [ifc](ifc.md) | Import and export: what we read, what we refuse, the classification gap, and the wall-axis lesson |
| [sheets](sheets.md) | Sheets, title blocks, PDF; paper stays black on white and never reads the theme |
| [lint](lint.md) | Coordination findings: what a lint finding is, and what it is not |
| [library](library.md) | The firm library format, and why it is a documented file format rather than a database |

### Surfaces

| Page | Covers |
|---|---|
| [addons](addons.md) | The add-on contract: every trade plugs in through versioned extension points, and proof packs prove it |
| [viewers](viewers.md) | `bim-viewer`, `bim-viewer-3d`, `bim-ui`, `bim-grid`: what each draws and what it may not know |
| [editor](editor.md) | The editor, the small host contract, and how a host supplies theme, language and services |
| [agent-tools](agent-tools.md) | MCP: the script-first rule, the ten-tool budget, and why a new tool is the last resort |
| [web](web.md) | The hosted app: routes, the server-rendered pages, the editor bundle, and what crosses between them |

### Practices that are load-bearing

| Page | Covers |
|---|---|
| [tests-as-guards](tests-as-guards.md) | The guards this repo relies on: what each catches, what each is blind to, and how to prove one bites |
| [i18n](i18n.md) | The bilingual contract: English as the `defaultValue`, Turkish beside it, `{{n}}` not `{n}`, and the negative-space guard |
| [performance](performance.md) | The measured budgets, and the difference between an absolute and a relative one |

Existing long-form documents that stay where they are, because they are instructions
rather than contracts: [`docs/SCRIPTING.md`](../SCRIPTING.md),
[`docs/PERFORMANCE.md`](../PERFORMANCE.md),
[`docs/ADD-ON-CONTRACT.md`](../ADD-ON-CONTRACT.md),
[`docs/CONNECT-AN-AGENT.md`](../CONNECT-AN-AGENT.md),
[`docs/SCRIPTING-COVERAGE.md`](../SCRIPTING-COVERAGE.md).

## Reading order for an architecture review

1. Always: [layers](layers.md), [model](model.md), [commands](commands.md).
2. Then, by what the diff touches:

| If the diff touches… | Also read |
|---|---|
| `bim-kernel/src/**` (schema, commands, derived output) | [commands](commands.md), [units](units.md) |
| `bim-sync`, `bim-authority`, leases, commits | [sync](sync.md), [commands](commands.md) |
| `bim-qto`, measures, schedules, takeoff | [qto](qto.md), [units](units.md) |
| `bim-ifc`, converters, `sample-models` | [ifc](ifc.md), [geometry](geometry.md) |
| `bim-mcp`, `bim-mcp-packs`, `bim-script*` | [agent-tools](agent-tools.md), [tests-as-guards](tests-as-guards.md) |
| any `locales/`, `t(` call, `MUTINY_NAMESPACES` | [i18n](i18n.md) |
| `bim-viewer*`, `bim-ui`, `bim-grid`, CSS | [viewers](viewers.md), [i18n](i18n.md) (theme rule) |
| `bim-editor`, `bim-editor-host` | [editor](editor.md), [viewers](viewers.md) |
| `apps/mutinybim-web` | [web](web.md), [i18n](i18n.md) |
| `bim-pack-*`, a new trade | [addons](addons.md), [layers](layers.md) |
| a new test, or a `__tests__` helper | [tests-as-guards](tests-as-guards.md) |

3. When a diff changes a contract rather than an implementation, update the page **in the
   same pull request**. A contract that lives only in the diff is the failure this
   directory exists to prevent.

## Writing a new page

Copy the shape of an existing one. Four headings, in this order: **What it owns**,
**The contract**, **How it goes wrong**, **Where the guard is**. Keep it under a page.
If a rule has no test, write "no guard; review-only" — do not let a reader assume
enforcement that is not there.
