# The tool and interaction machine

## What it owns

| Where | What |
|---|---|
| `packages/bim-editor/src/editor/ribbon/tool-shortcuts.ts` | **The tool list**: `BuildingModelTool`, seven names, and one key each (`:1`, `:3-4`) |
| `packages/bim-editor/src/editor/BuildingModelSurface.tsx` | The `tool` state (`:461`), `chooseTool` (`:1649-1688`), the keyboard handler (`:2119-2274`), the hint and the notice (`:3923-3934`) |
| `packages/bim-editor/src/editor/input/gesture-arbiter.ts` | **The arbiter**: which gesture a press becomes, decided once and held (`:1-18`, `:90-103`, `:132-172`) |
| `packages/bim-editor/src/editor/tool-readiness.ts` | `toolBlocker`: what the selected tool still needs, in words, with the fixes it can offer (`:85-173`) |
| `.../ToolReadinessNotice.tsx`, `.../ToolHintBar.tsx` | The two places a tool speaks: a blocking notice, and a status line that can be expanded |
| `packages/bim-editor/src/editor/tool-switch.ts` | Which pick stops which other tool (`:23-35`) |
| `packages/bim-editor/src/editor/escape-step.ts` | Esc: the ladder, and the words for each rung (`:66`, `:83-88`, `:91-93`) |
| `packages/bim-editor/src/editor/resize-scope.ts` | What a resize may touch: `resizeRequestFor`, at most 500 pieces, always one `resize_stretch` (`:14-28`) |
| `packages/bim-editor/src/editor/ribbon/types.ts` | `RibbonCommand.disabledReason` — readiness per command, shown in the tooltip (`:8-14`) |

## The contract

1. **One model tool is active at a time, out of seven.** `select`, `place`, `route`,
   `move`, `measure`, `box`, `split` (`tool-shortcuts.ts:1`), held in one `useState`
   (`BuildingModelSurface.tsx:461`). The ribbon draws Select and Create as radio groups
   whose value is the active tool and whose `onValueChange` calls `chooseTool`
   (`building-model-ribbon.ts:387`, `:513-516`). Pascal's `InteractionScope` union is the
   same idea with a different membership: ours is a closed set of *tools*, theirs a set of
   interaction modes with an explicit begin/update/end contract. There is no
   begin/update/end interface here — the surface calls session methods.
2. **Picking a tool tears down whatever was in flight, silently.** `chooseTool` cancels the
   arbiter's gesture, clears a planned placement, abandons a move (`endMove(false)`),
   disarms the placement, the measure, the split and — when the next tool is not Route —
   the route, then replaces the hint (`:1649-1688`). A half-drawn route with three points
   is gone; Esc would have said "Route cancelled; nothing was saved" (`:2266`), the pick
   says nothing.
3. **A press has exactly one owner, decided at pointerdown**: `tool` (box, route stroke,
   move) beats `grab` (a run, the selection, a slide) beats `click` beats `camera`
   (`gesture-arbiter.ts:1-18`, `pressOrder` `:90-103`, `OWNER_OF` `:40-48`). A tool or grab
   that wins takes the pointer from the camera; a click leaves it, so a press that moves
   4 px or more becomes an orbit (`CLICK_SLOP_PX`, `:59`). A second pointer during an edit
   is ignored (`:138`); the wheel never changes the owner.
4. **Esc backs out one rung at a time, then stops the tool.** The ladder is fixed and
   ordered: a typed field, a nudge, a drag, a run drag, a box, an armed inherit, an armed
   offset, the route, a move, and only then the tool (`BuildingModelSurface.tsx:2244-2272`;
   `escape-step.ts:83-88` for a printed drawing, which has its own order). Every rung that
   discards work has a sentence saying so.
5. **Readiness is an answer, not a gate.** `toolBlocker` returns a `ToolBlocker` — `id`,
   `title`, `message`, `fixes` — or null (`tool-readiness.ts:25-31`, `:85`). Seven ids:
   `read-only`, `paused`, `no-model-view`, `no-level`, `no-part`, `route-size`, `no-system`.
   It is computed once per render (`BuildingModelSurface.tsx:1735-1759`) and *shown*
   (`:3923-3926`), replacing the hint bar while it stands (`:3932`). What actually stops a
   click is elsewhere: `canEdit`, the paused session, and the arming effects that pass
   `null` when their inputs are missing (`:1772-1775`).
6. **Two readiness vocabularies, on purpose.** Per command, the ribbon's
   `disabledReason` says why a button is grey in its own tooltip (`ribbon/types.ts:8-14`);
   per active tool, the notice says why clicks do nothing. The first is about one action,
   the second about a state the person is now in.
7. **Which tool stops which is written down twice, once per direction.** A model tool pick
   stops Draw space, the ceiling tracer and a drawing tool
   (`stoppedByModelTool`, `tool-switch.ts:23-30`, in an effect keyed on `tool`,
   `BuildingModelSurface.tsx:2916-2930`); a drawing tool pick puts the model tool back to
   Select (`drawingToolStopsModelTool`, `:33-35`, `:2602`); and a side tool started from
   its own button stops the model tool at the entry point (`traceOnDrawing` calls
   `chooseTool('select')`, `:1856-1861`).
8. **The scope of a resize is a command builder, not a permission check.**
   `resizeRequestFor(view, ids, size, …)` keeps only `run_segment` ids, refuses an empty
   selection and more than 500 pieces, and always builds `resize_stretch` — never
   `resize_run`, "which is what made a split half resize the whole run"
   (`resize-scope.ts:1-13`, `:16-28`). It refuses with a sentence, not a code. What the
   command then does — transitions where a neighbour keeps its size, a refusal for a size
   already everywhere, splitting between two points — is the kernel's scope
   (`packages/bim-kernel/src/routing/stretch-commands.ts:283-320`).
9. **A tool speaks twice.** A blocking notice while it cannot act
   (`ToolReadinessNotice.tsx:1-20`), and a hint line for what a click would do next
   (`ToolHintBar.tsx:33-60`), which is `role="status"`, `aria-live="polite"`, and
   truncates rather than covers the drawing.

## How it goes wrong

- **Two tools active at once.** The model tool and the side tools are separate state, and
  only the three handoffs in contract 7 stop the other. A new holder of the view's clicks
  that does not go through `chooseTool` or `stoppedByModelTool` leaves both lit and the
  view answering whichever registered last. *Tell:* a new tool whose "on" state is a
  `useState` nobody else can see.
- **A gesture surviving a model change it depended on.** No effect cancels a gesture when
  the model's revision moves — only a new viewer (`:1292-1298`) and Esc/pointercancel do.
  The release submits and the server re-runs the command against the head
  (`model-session.ts:2356-2360`, [commands](commands.md)), so a delta computed over a
  stale head lands where the person did not draw it, or conflicts. *Tell:* a preview that
  resolved its target ids once, at pointerdown.
- **A readiness check that disagrees with the command.** `toolBlocker` never sees the
  placement height, yet arming requires a finite one (`:1772`), so a bad height leaves the
  tool silent and useless. The route panel's size check is positivity only
  (`RoutePanel.tsx:241-259`) while `route_run` checks the size against the domain
  (`routing/commands.ts:444`), so "0.5 in round" is ready and then refused.
- **A keyboard shortcut acting on a tool that is not ready.** The keys switch first and
  explain after: `p d m t b s` all pass `canEdit` (except Measure and Box) and nothing else
  (`:2199-2203`). So a shortcut is never refused — the person lands in a tool whose notice
  then says "Add a level first". That is a decision, not a bug, and it is the opposite of
  a greyed ribbon button.
- **A refusal that names no next step.** Five of the seven blockers carry `fixes: []`
  (`tool-readiness.ts:93`, `:117`, `:149`, `:161`, `:169`) and rely on their message naming the next
  step in words. A blocker added without either is a person told no.
- **A tool nothing displays.** Press M and both radio groups read empty, because the Select
  group's value is `select`/`box` or `''` and the Create group's is `place`/`route` or `''`
  (`building-model-ribbon.ts:387`, `:514`). The hint is then the only sign of what is on.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-editor/__tests__/i18n-operator-messages.test.ts:325-358`, `:389-403` | every branch of `toolBlocker` in both languages, including which fixes each blocker offers | whether a blocker matches what the tool then does — it tests the words, not the gate |
| `packages/bim-editor/__tests__/i18n-refusal-sentences.test.ts` | a command's refusal reaching a Turkish screen untranslated | a refusal the session shows without `refusalWords` |
| `packages/bim-kernel/__tests__/split-resize-scope.test.ts`, `stretch.test.ts` | the resize command's own scope and refusals | the editor's selection filter |
| nothing | — | `GestureArbiter`, `pressOrder`, `tool-switch.ts`, `resize-scope.ts` and `escape-step.ts` have **no test that runs them**: no test file imports any of them, and the three that mention `BuildingModelSurface.tsx` scan it as source text or name it in a comment — none renders it. The spine of the interaction machine is review-only, while the words it shows are tested in two languages |
