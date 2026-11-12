# Agent tools

`AGENTS.md` ("Tools: script-first, ten at most") is the rule; [`../SCRIPTING.md`](../SCRIPTING.md)
is the guide to what a script does. This page is why the rule is shaped that way,
and what enforces it.

## What it owns

| Where | What |
|---|---|
| `packages/bim-mcp/` | The tool server: the core pack, the transports, the host seam (`src/host.ts`), the CLI (`src/cli.ts`) |
| `packages/bim-mcp-packs/` | The 159 add-on tools, in opt-in families |
| `packages/bim-script/`, `-script-runner` | The kit an agent writes in, and the sealed process it runs in |
| `packages/bim-plugin/` | The catalogue: which tool belongs to which pack, one Agent Skill per pack, one MCP server entry per pack |
| `docs/SCRIPTING-COVERAGE.md` | Per tool, what a script does instead |

## The contract

1. **The script API is the product.** An agent acts on a model by writing a script
   with the kit, checking it, previewing it and applying it after a person approves.
   The tools run, check and apply scripts, plus four reads. Everything a model can do
   is a kit function, so the tool list does not have to grow with the feature list.
2. **The core pack is at most ten tools.** `CORE_TOOL_BUDGET = 10`
   (`packages/bim-mcp/src/server.ts:41`). The list is nine: five script tools
   (`bim_script_reference`, `bim_check_output`, `bim_run_script`, `bim_apply_output`,
   `bim_save_part_type`) and four reads (`bim_model_summary`, `bim_query_elements`,
   `bim_inspect_network`, `bim_validation_issues`) — plus `bim_enable_pack`, which is
   on the server only when a family exists to turn on and counts against the budget.
3. **A new capability goes into the kit and `bim_script_reference`, with a worked
   example** — never into the core list. `packages/bim-script/examples` holds the
   examples; `bim_script_reference({ example: "<name>" })` serves them, and
   `packages/bim-mcp/__tests__/examples-run.test.ts` runs every one through
   check → preview → apply against a fresh model.
4. **Extra families are opt-in, in three ways.** `--packs drafting,ducts-pipes`
   (slug, id or skill name), `/packs/<family>/mcp` over HTTP, or `bim_enable_pack`
   for the session, where the server sends `notifications/tools/list_changed`. The
   default with no flags is `none` (`parseArgs([]).packs === "none"`).
5. **"All tools" is never a default anywhere** — not the plugin bundle, not the hosted
   app, not the CLI. `--packs all` exists and is something a person types.
6. **Refusals are answers, one shape for every surface.** A check that fails names the
   line and the reason; a preview that cannot land answers `stale_preview` and nothing
   lands; a tool that needs a hosted service says in plain words that it is not
   available here. The MCP tool result, the CLI and the chat surface report the same
   sentences, because the answers come from one place: `{ status: "refused", message,
   nothing_changed: true }` (`packages/bim-mcp/src/scripts/tools.ts:252,834`).
   A refusal is never an exception and never an empty answer.
7. **The tool server decides nothing about access.** Which person is calling, whether
   they may read or edit, how they approve, where scripts run and how the model server
   is reached are five answers the host gives (`BimToolHost`, `src/host.ts`). See
   [`../CONNECT-AN-AGENT.md`](../CONNECT-AN-AGENT.md).

## Why

Nov 7, 2026: 159 add-on MCP tools had been built at a cost of several thousand
dollars, and no AI used them well. A long tool list makes a model pick worse — every
tool is another description competing for attention, and the ones that matter get
buried. A model that writes code is more capable and cheaper than a model choosing
among 159 tools: one script tool plus a kit replaces a family, and the script is
inspectable before it lands. `docs/SCRIPTING-COVERAGE.md` is that trade written out
per tool: 138 covered by the kit today, 21 that genuinely need a host step, none
missing. Every line marked *covered* is a retirement candidate.

## How it goes wrong

- **A new tool for a feature a script can do.** The pull is real — a tool is a day's
  work, a kit function with a worked example and a `bim_script_reference` entry is
  more. But the tool list is the thing that decays, and a tenth-one-more tool is how
  159 happened. *Tell:* a new tool whose body could be a `ctx` helper.
- **The budget raised.** `CORE_TOOL_BUDGET` is a constant; editing it is a one-line
  diff that makes the guard agree with whatever was just done. It is the maintainer's
  call, never a test edit.
- **A pack on by default.** A family added to the default list "just for the hosted
  app", or `--packs all` becoming the npm script someone runs. Then the promise that a
  server started with no flags lists ten tools stops being true, and nobody notices
  because everything still works.
- **A gap closed with a tool instead of the kit.** `docs/SCRIPTING-COVERAGE.md` marks
  a job *missing*; the fix is a kit function. Adding a tool moves the row to *host
  step* and leaves the next agent unable to script it.
- **A refusal that is not an answer.** An exception, an empty result, or "not
  supported" with no next step, so the agent retries the same call.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-mcp/__tests__/core-tool-budget.test.ts` | `CORE_TOOL_BUDGET` being other than 10; the default list over budget; no flags listing anything beyond the core; the catalogue's core pack differing from the server's; a family repeating a core tool; `--packs` accepting anything but none/all/a comma list; `bim_enable_pack` listing the families, turning one on, and emitting `list_changed`; `/packs/everything/mcp` answering 404 | a tool added to a *family* that duplicates a kit function |
| `packages/bim-mcp/__tests__/examples-run.test.ts` | an example script that stopped running, or a folder file missing from the catalogue | a kit function with no example |
| `packages/bim-mcp/__tests__/core-only-gaps.test.ts` | the jobs the add-on tools did reaching a script that uses only core tools | a job that is still only a tool |
| `packages/bim-mcp/__tests__/oss-local-end-to-end.test.ts` | the documented sequence (reference → check → preview → apply → summary) against the real local runner | a host with its own approval flow |
| `packages/bim-mcp/__tests__/script-sent-once.test.ts`, `script-previews.test.ts` | an id swapped between the preview a person saw and the change they approved | a store that keeps the right record wrongly |

`docs/SCRIPTING-COVERAGE.md`'s own counts have no guard: nothing asserts that its
"138 covered / 0 missing" table still matches the catalogue, so it can drift while
staying green. Review-only, and worth a test that reads it.
