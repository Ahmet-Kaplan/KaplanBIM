# Lint: coordination findings

## What it owns

| Where | What |
|---|---|
| `packages/bim-lint/src/types.ts` | `Finding`, `LintConfig`, linked-model shapes |
| `packages/bim-lint/src/engine.ts` | `LintEngine`: the index, `advance(changedIds)`, the run, availability |
| `packages/bim-lint/src/rules/registry.ts` | `RuleDef`, `RuleScope`, rulesets, `findingId` |
| `packages/bim-lint/src/rules/packs/*.ts` | the built-in checks: coordination, placement, clearance, systems, documents, requirements, questions, typicals, connectors |
| `packages/bim-lint/src/rules/index.ts` | `LINT_RULE_POINT`: the extension point an add-on contributes rules through |
| `packages/bim-lint/src/block.ts` | the `lint` block an edit returns, capped |
| `packages/bim-lint/src/index-state.ts`, `spatial/grid.ts`, `shapes.ts` | bodies, surfaces, the broad phase |
| `packages/bim-kernel/src/findings/` | the one ledger a finding becomes a `FindingRef` in |

## The contract

1. **A finding is a check on the model, not a gate on the edit.** The engine is *"a
   derived read over one model revision. It never edits and never blocks a save"*
   (`engine.ts:9-16`). The kernel cannot reach it — `bim-lint` depends on the kernel,
   never the reverse — so no commit path could consult it. The edit returns a `lint`
   block; when the 50 ms budget runs out that block is `deferred`, not the save
   (*"the next call or bim_lint_check picks it up"*, `block.ts:16-17`, `:98-99`), and it
   is capped at 8 findings / 160-character messages / 2 KB (`block.ts:5-14`,
   `types.ts:60`).
2. **A rule is data plus a small pure function.** `RuleDef` carries `id`, `version`,
   `pack`, `severity`, `title`, `scope`, `kinds`, and optionally `reads`, `pairsOnly`,
   `rank`, `available` and `run` (`registry.ts:68-99`). Rules report what a
   deterministic test found; they never edit the model and never rank
   (`registry.ts:6-9`). The engine sorts: errors first, then by finding id
   (`engine.ts:285`).
3. **An add-on contributes a rule through the extension point, not by editing lint.**
   `LINT_RULE_POINT` is `defineExtensionPoint<RuleDef>` (`rules/index.ts:49-57`); a
   pack's ids are `<pack>.<rule>` and its `pack` is the pack's namespace, so it never
   collides with a built-in bare id (`rules/index.ts:45-47`). `rank` places the group
   among the built-in ones (`rules/index.ts:18-23`), and `rulesFor` decides which packs
   a ruleset runs (`registry.ts:102-117`). Proof that this is real: no shared package
   may import an add-on (`__tests__/c6x-no-addon-cycle.test.ts`).
4. **A finding points at something a person can select.** `elementIds` are ours and
   sorted; `linked` names linked-model elements by GlobalId; `at` gives the level and a
   plan position (`types.ts:32-46`). The id is stable — the rule plus the sorted ids — so
   an acceptance suppresses it, and a long one is shortened deterministically rather
   than truncated into a collision (`registry.ts:122-132`). A pair finding carries two
   ids, so accepting it is a decision about that pair, not about either element.
5. **A finding becomes a ledger row, not a private list.** `lintFindingRef` maps it to a
   `FindingRef` with source `{kind: "lint_rule", id: rule, version}` and the model
   revision (`bim-kernel/src/findings/sources/host-feeds.ts:37-49`), so one acceptance
   store answers for lint, validity and requirements.
6. **The sentence is the rule's own English, translated at the display boundary if at
   all.** A rule composes plain words with its measurements (`rules/format.ts`:
   feet-and-inches, compass, `clip`), embedding names and numbers; that text is the
   finding's `message`, and the pane, the MCP tool result and the screenshot all show
   those same words. The mechanism that turns kernel prose into the reader's language —
   numbers out to slots, template looked up, nothing translated falls back to a shorter
   sentence rather than to English — is [i18n](i18n.md) and
   `bim-ui/src/i18n/prose.ts`. Read it before assuming a lint message is translated
   today: the pane draws `finding.message` as it arrives
   (`coordination/CoordinationPane.tsx:115`), and no rule passes a template key.
7. **"Not available" is a first-class answer.** `available(ctx)` returns why a rule
   cannot run on this model (`registry.ts:97`); the engine skips it and reports the
   reason (`engine.ts:169`, `:304-309`), and `bim_lint_check` returns `not_available`
   with those reasons (`bim-mcp-packs/src/coordination/lint.ts:152`).

## How it goes wrong

- **A check that silently stops when its input is missing.** The real instance is one
  layer up: the live-block freshness chip answered `status: 'error'` for a host without
  the optional blocks service, so every sheet showed "Couldn't check the last issue"
  (`bim-editor/src/editor/blocks/use-block-freshness.ts`, fixed in `4945df1` to
  `'unavailable'`). The lint shapes of the same bug: a rule that `return`s after a
  failed `buildSheetSceneFor` (`rules/packs/documents.ts:155-160`) or `evaluateSchedule`
  (`:132-135`) reports nothing and looks clean. *Tell:* a `catch` in `run` with no
  `emit`. The honest alternatives already here: say what was not checked
  (`planned-not-checked`, `rules/packs/coordination.ts:154-176`) or declare
  `available`.
- **A finding nobody can locate.** `at` defaulting to level `""` and 0,0 with no
  `elementIds` leaves a row you cannot click to; the pane disables Select for a
  linked-only finding (`coordination/CoordinationPane.tsx:103`) and prints "No level".
  *Tell:* `at: noAt()` on a rule whose elements have a body, or a message that names a
  place the ids do not.
- **A check that mutates the model.** `RuleContext` hands rules the live `ModelState`
  (`registry.ts:24`) and nothing freezes it, so a rule that edits an element while
  checking it corrupts the revision being linted. No guard; review-only.
- **A finding sentence whose parameters do not match its template.** A message with an
  interpolated name keys no prose template and falls back to the generic sentence, by
  design; but a message whose *numbers* arrive in a different order than the English
  prints the wrong quantity, because `locales/tr/prose.json` slots are positional
  (`{0}`, `{1}`).
- **A rule version that never reaches the finding.** `Finding.ruleVersion` is optional
  and documented as reopening a decision on a version change (`types.ts:44`), and
  `floating-equipment` is at `version: 2` (`rules/packs/placement.ts:205`) — but no rule
  in this repo sets `ruleVersion` on what it emits (grep: `types.ts:44` only;
  `engine.ts:528-534` copies nothing), and the ledger then defaults it to `"1"`
  (`bim-kernel/src/findings/lint-acceptance.ts:15`). So an acceptance taken against
  version 1 survives the rewrite. `bim-kernel/__tests__/f11-version-reopens.test.ts:26`
  passes a version by hand and proves the ledger, not the rule.
- **A rule counted as running when it is not.** Availability is computed from the
  engine's own state (`hasNativeCeilings`, linked indexes), so a run without them checks
  less. `scripts/perf/mutinybim/lint.ts:21-24` asserts the findings after `advance`
  equal a fresh engine's — the invariant that catches it, and only under the perf gate.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-lint/__tests__/rules.test.ts` | one fixture where each rule fires and one near miss where it does not | a rule whose input is absent |
| `__tests__/planned-not-checked.test.ts` | a rule skipping planned parts *without saying so* | any other silent skip |
| `__tests__/c6x-lint-order.test.ts`, `c6x-batch-5c-rules.ts` | each rule running in the recorded order, with its severity and pack unchanged | a rule added without a row |
| `__tests__/c6x-no-addon-cycle.test.ts` | a shared package importing an add-on | an add-on's rule that never registers |
| `__tests__/c5s-level-edit-index`, `g15-clash-reads-mesh`, `spatial-rules`, `r4e-electrical-checks` | index/level correctness, mesh reads, each discipline's check | a composed sentence's wording |
| `scripts/perf/mutinybim/lint.ts` invariants | scoped findings differing from a fresh engine's, a block over 2 KB, an edit touching over 50 elements | whatever the perf gate does not run |

Rule mutation, message wording in either language, and `ruleVersion` on a real rule are
unguarded: review-only.
