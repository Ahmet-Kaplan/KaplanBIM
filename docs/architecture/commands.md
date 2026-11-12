# The edit spine

## What it owns

| Where | What |
|---|---|
| `packages/bim-kernel/src/commands.ts` | `commandSchema` (every intent command, strict), `executeCommand`, the dispatch to each domain |
| `packages/bim-kernel/src/command-core.ts` | `finish`, `guard`, refusal, the handler table, what an authored write and an intent predicate are |
| `packages/bim-kernel/src/commands/batch.ts`, `batch_edit` schemas | `executeSteps`, `MAX_BATCH_STEPS` |
| `packages/bim-kernel/src/changeset.ts` | `planCommit`, `applyChangeset`, `commandRequestSchema` |
| `packages/bim-kernel/src/strict-commands.ts` | strict parsing and the words a parse refusal uses |
| `packages/bim-kernel/src/model.ts` | `TrackedReader`: the read set |
| `packages/bim-sync/src/sequencer.ts` | decides one commit at a time against the head |
| `packages/bim-sync/src/agent-principal.ts` | who an agent may act as |

## The contract

1. **Every change is an intent command.** A small JSON object naming a `type`,
   with a zod schema, parsed before it runs. The schema is **strict**: a key the
   command does not take is refused by name, never dropped
   (`strict-commands.ts:5-16`, `commands.ts:406`). A command that sends
   `crop_min_ft` where millimetres are wanted used to edit the wrong thing
   silently; now it says so.
2. **The server never trusts the client.** The client may predict locally, but
   the server re-runs the command on the current head with its own code
   (`changeset.ts:109-122`) and takes what the command read and wrote **from
   that run, never from the caller** (`changeset.ts:115-116`). The read set is
   the `TrackedReader`'s record of every element it touched, with the version it
   saw (`model.ts:17-52`); a command cannot declare it, and a client cannot send
   it.
3. **No last-write-wins on intent.** If an authored field this command sets was
   set to a different value after the base revision, the later writer gets a
   conflict and decides (`changeset.ts:183-195`). Derived values just recompute;
   but a change whose geometric propagation would undo someone's recorded intent
   conflicts instead (`changeset.ts:205-221`). Deleting something another person
   changed after you looked conflicts too (`changeset.ts:167-174`). Your own
   earlier edits in *this session* are not competing intent
   (`changeset.ts:288-290`).
4. **Idempotency.** Every request carries an `idempotencyKey` (8–128
   characters); the answer is stored with the key, so a retry gets the same
   answer, including a rejection (`store.ts:79-94`, `InMemoryCommitStore` at
   `:136-139`). The stored answer carries the command's digest; a key reused for
   a **different** change is refused, not answered with the first change's
   "saved" (`sequencer.ts:9-22`, `store.ts:20-24`).
5. **Batches.** `batch_edits` runs up to 500 steps as one revision, one changeset
   and one undo step, all or nothing (`commands.ts:125`, `:348-362`). Each step
   runs on the result of the steps before it under the same rules as alone; the
   commit checks the **union** of what they read (`commands/batch.ts:1-10`,
   `:44-49`). Undo is not a step: undo the batch's revision. Scripts and pastes
   produce their output as batches.
6. **Agents are actors, not a second kind of authority.** An agent id is
   `agent:<userId>:<runId>`, parsed by the kernel; the sync layer binds it to the
   verified login, so an agent can only act for the person who signed it in
   (`agent-principal.ts:1-48`). It gets exactly that person's capabilities,
   never more, and each run is its own editing session, so an agent's edit
   conflicts with its person's concurrent edit like anyone else's.
7. **Sessions.** Each tab or agent run is its own session (`clientSessionId`).
   The same person in two tabs can conflict with themselves, exactly as two
   people would (`changeset.ts:53-57`, `:288-290`).
8. **Refusals are in words, in operator language.** A refusal is a code plus a
   sentence that names what to do: "Leg 3 is 0.51 ft long, but the elbow and
   transition there need 1.27 ft". A bad key names the keys the command does
   take and their units (`strict-commands.ts:61-76`); a locked group names the
   group; an older model server is named as such, not as "invalid"
   (`part-model/unit-gate.ts:22-32`).
9. **A handler is registered through the spine's table.** `command-core.ts`
   imports no command module: the parser arrives through
   `registerCommandParser` (`command-core.ts:318`) and per-edit upgrades through
   `registerEditHook` (`command-core.ts:329`). A domain that wants a command
   registers it; it does not get imported by the spine.
10. **Server-only commands exist and are refused when a client sends one.**
    `merge_branch_part` and `import_elements` are built by the server, and their
    records come from the server's own recomputation, never from the wire
    (`commands.ts:367-395`).

## How it goes wrong

- **A command that reads state it did not declare.** Reading `model.elements[id]`
  directly instead of through `TrackedReader` compiles, works, and leaves the
  read out of the read set, so a concurrent edit to that element is not
  re-checked at commit and one of the two edits is lost quietly. **No test
  checks that a handler used the reader** — the read set is only as good as the
  handler that built it. Review-only.
- **A handler registered outside the spine.** An `if (command.type === …)` chain
  in `command-core.ts`, or importing a domain command module from it, recreates
  the cycle of round 4 and breaks the kernel's ability to build without its
  domains. The layer test fails on exactly this (see below).
- **Derived output computed client-side and trusted.** A client that sends a
  total, or trusts its own prediction as the answer, produces a number no
  server run agrees with. The server's `outcome` is what settles an edit;
  predictions are dropped on it, never merged as truth (see [sync](sync.md)).
- **A refusal that says only "invalid".** It sends the person to the wrong
  screen or none. A refusal is a `CommandError`: a code, a sentence, and the
  elements it is about (`command-core.ts:40-45`). A message that names nothing,
  no element and no next step is the failure.
- **A batch that is not atomic in undo.** If a step's changes land as their own
  revision, undo takes back one cell of a 500-cell paste, and the person cannot
  tell which. `edit-batch.test.ts:1-6` records the pre-`batch_edits` behaviour
  as 500 revisions.
- **A silent late write.** A command decided against a head that moved, without
  re-running, overwrites what landed in between. `planCommit` inside the atomic
  commit *is* the fix (`changeset.ts:110-112`: the sequencer, a Postgres
  transaction or a reducer all call it there).

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-kernel/__tests__/kernel.test.ts:151` | competing authored values conflicting instead of last-write-wins | derived values, which are meant to overwrite |
| `packages/bim-kernel/__tests__/stale-base-intents.test.ts` | a rewrite of the intent check that examines every intent since the base instead of those on the touched elements | an intent a command quietly does not record |
| `packages/bim-kernel/__tests__/edit-batch.test.ts`, `edit-batch-equivalence.test.ts` | a batch's one revision, one undo step, and its landing exactly where the same steps one by one land | a pack command that runs steps itself and skips the batch's read union |
| `packages/bim-sync/__tests__/r8-key-reuse.test.ts` | a reused key answering the first change's "saved"; run against both the serial and the group-commit store | a key reused for a change whose digest is identical |
| `packages/bim-sync/__tests__/sessions.test.ts` | two tabs of one person conflicting; separate agent runs as separate identities; a host revoking live | a client that lies about its `clientSessionId` |
| `packages/bim-sync/src/agent-principal.ts` (its own tests, `s9-a7-agent-principal.test.ts`) | an agent id for a person other than the signer; a human claiming an agent id; a provider mismatch | capabilities, which the host authorizer answers |
| `packages/bim-kernel/src/__tests__/c6k-command-dispatch.test.ts` | a kernel command and a pack command both parsing through the one schema, and an unregistered `type` failing | a command registered but never reachable |
| `packages/bim-kernel/src/__tests__/import-layers.test.ts:198-212` | the spine importing a command module or derived output | a handler registered at runtime that should not have been |
| nothing | — | a refusal's **wording** is review-only. `strict-commands.ts` builds the unknown-key and unit hints, and no test reads the text of any other message |
