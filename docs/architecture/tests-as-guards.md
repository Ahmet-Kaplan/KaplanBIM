# Tests as guards

## What it owns

The tests that exist to **prevent a specific mistake from coming back**, as opposed to
tests that check a function's behaviour. They live where the thing they guard lives, and
several have a helper beside them:

| Guard | Where |
|---|---|
| Layer violations and import cycles | `packages/bim-kernel/src/__tests__/import-layers.test.ts` |
| Kernel trade-neutrality (a ratchet on trade words) | `packages/bim-kernel/src/__tests__/` |
| Add-ons need no kernel edits (the proof pack: civil) | `packages/bim-kernel/__tests__/c5k-proof-pack-isolation.test.ts`, `scripts/bim/check-proof-pack-commits.sh` |
| MCP core tool budget (≤10) | `packages/bim-mcp/__tests__/core-tool-budget.test.ts` |
| i18n parity, glossary, negative space, site pins | see [`i18n.md`](i18n.md) |
| Theme tokens (no hex outside the theme source) | `packages/bim-ui/__tests__/theme-token-compliance.test.ts` |
| Prose catalogue is byte-pinned to its sources | `tools/i18n/__tests__/extract-prose.test.mjs` |
| Locale walk agreement (two walkers, one answer) | `tools/i18n/__tests__/locale-walk-agreement.test.ts` |
| Performance budgets | `docs/PERFORMANCE.md`, `tools/perf` |

## The contract

1. **A guard states the mistake it prevents in its own comment.** Not "tests the parity of
   locales" but "a translator who copies the glossary would write `{n}`, which i18next
   renders literally". The comment is how the next person decides whether their change
   needs to respect it.
2. **A guard pins its own corpus.** A test that globs files and passes because the glob
   matched nothing is worse than no test: it reports safety it never checked. Every
   corpus-based guard asserts it found something, and names one file it must have found.
3. **A guard proves it bites.** Each has a self-test — sometimes a planted fixture, often a
   comment recording the violation that was planted and the failure it produced. When you
   add or change a guard, plant the violation and watch it go red before you trust it.
4. **A guard declares its blind spots.** "Cannot verify from the diff", "what its roots do
   not cover", "review-only, no guard" — written down, not implied. A rule whose enforcement
   is assumed but absent is the expensive case.
5. **Site counts over existence.** For anything repeated (a caption drawn from two call
   sites), pin the **count**, not just presence. "The key exists somewhere" passes after a
   revert; "the key appears at three sites" does not.
6. **Ratchets only tighten.** Where a guard counts something that may only go down (trade
   words in the kernel, known layer debts), the baseline file may shrink and grow only with
   an explicit, reviewed edit.

## How it goes wrong

- **The vacuous guard.** A glob that found nothing, a `for` over an empty list, an
  assertion that everything `.not.toEqual([])` — green forever. *Tell:* the test has no
  assertion about *how many* things it looked at.
- **The tautological assertion.** A test that compares a table to itself, or asserts
  English against a default it supplied. We shipped one: "the schedule builder is unchanged
  in English" asserted against the new default, so it could not see the reword.
- **The guard that guards the wrong file.** A test walking `locales/tr/*.json` proves the
  *file* is consistent; it says nothing about whether the component still calls `t()`.
  Both are needed, and the second is the negative-space guard.
- **The guard whose scope is a hand-written list.** `NOT_YET_GUARDED` named the directories
  someone remembered; the trees nobody remembered were invisible. Root discovery, not a
  list, is the fix — and a list is acceptable only when it names what is *owed*, with an
  owner.
- **The claim nobody executed.** Twice in one plan a report asserted a fix that the diff
  did not contain, and once asserted a coverage claim the code contradicted. *Tell:* a
  status line whose evidence is a sentence rather than a command and its output.
- **The guard that fails on correct input.** A plural heuristic rejected
  `30 dakika bekler`, and the translation lost the word "waits" to satisfy it. A guard that
  fires on correct work teaches people to ignore it.
- **The scratch test left behind.** `zz-*.test.ts` from an agent's investigation is not a
  guard; it is noise that will fail on someone else's machine. Delete it before committing.

## Where the guard is

This page has no guard of its own. It is the index to the others, and its rules are
review-only: a guard that does not bite, or a claim without executed evidence, is caught by
a reviewer reading the diff — not by a test.
