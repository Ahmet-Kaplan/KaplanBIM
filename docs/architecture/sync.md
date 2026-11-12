# Sync

## What it owns

| Where | What |
|---|---|
| `packages/bim-sync/src/protocol.ts`, `protocol-version.ts` | the wire messages as zod schemas; `PROTOCOL_VERSION` and the features each side reads |
| `packages/bim-sync/src/store.ts`, `sequencer.ts`, `group-commit.ts` | the `CommitStore` contract and `InMemoryCommitStore`; commits decided one at a time; durable writes grouped |
| `packages/bim-sync/src/client.ts`, `hub.ts` | `SyncClient`, `SyncHub` |
| `packages/bim-sync/src/authorization.ts`, `packages/bim-sync/AUTHORIZATION.md` | three capabilities; the host answers, the engine applies |
| `packages/bim-devserver` | the dev server: one process, in-memory store, `ws://127.0.0.1:3095/sync` |
| `services/bim-authority` | the model server: a lease per model, commits in Postgres |

`bim-sync` is **backend-neutral**: it defines the protocol and the store
contract, not a server (`packages/bim-sync/package.json:14`). It imports the
kernel, `bim-units` and no host product's code. The two servers implement the
store.

## The contract

1. **The protocol is messages, each checked.** A client sends `hello`, then
   `command`, `heartbeat`, `sync`, `interest` and `presence`; the server sends
   `welcome`, `changeset`, `outcome`, `head`, `advance`, `area`, `presence`,
   `left`, `error`, `denied`, `unsaved`, `unavailable`. Branches, merges,
   quantity comparisons, schedules and lineages add their own message sets
   (`protocol.ts:30-66`, extended at `client.ts:179`). Every message is parsed;
   one that cannot be acted on is answered with an `error` carrying a code, never
   dropped silently (`protocol.ts:203-218`).
2. **Revisions are consecutive and a changeset applies whole.** A client that
   receives revision N+2 while holding N gets `RevisionGapError` and asks for the
   gap with `sync`; it never applies half a changeset
   (`changeset.ts:300-325`; the client's `catching_up` path is `client.ts:581-585`).
3. **A commit is decided by the store, inside one atomic unit.** `transact`
   takes the lease generation, the idempotency key and the base revision, and
   runs the decision with the head and every changeset since the base
   (`store.ts:79-94`). The sequencer holds **no authority of its own**: the store
   owns the state and enforces the lease, so a stale sequencer cannot commit
   (`sequencer.ts:75-80`).
4. **A lease is not ownership.** The model server keeps one model per process by
   renewing a database lease, but the keeper only stops *this* process from
   trying; the write is stopped by the database checking owner, generation and
   expiry in the same statement as the write
   (`services/bim-authority/src/lease.ts:15-18`, `pg-store.ts:229-231`,
   `:528-529`). A process that has lost its lease is refused even if nobody has
   taken the model over.
5. **"Saved" means durable; "visible" does not.** With group commit, others see
   an edit as soon as it is decided, and its author is told saved only once the
   batch is written (`group-commit.ts`, the promise table in
   `services/bim-authority/README.md`). A client tracks the highest durable
   revision separately from the head it holds (`client.ts:314-319`), so a server
   that dies mid-batch is not mistaken for a reset.
6. **Access is a host answer, re-checked live.** Three capabilities —
   `model.read`, `model.edit`, `model.issue` — from a host-supplied
   `ModelAuthorizer` (`authorization.ts:13`). The model server re-checks them
   every few seconds; a person who loses read access is disconnected with a
   sentence, and one who loses edit access becomes read-only mid-session
   (`services/bim-authority/README.md`).
7. **A newer shape is written only to peers that read it.** `hello` and
   `welcome` carry a `protocol`; `PROTOCOL_VERSION` is 2 and absent means version
   1 with no features (`protocol-version.ts:25-35`). A writer emits a gated shape
   only when every peer advertises the feature; withdrawing a feature means
   deploying a server that no longer advertises it and clients writing the old
   shape again.
8. **The dev server and the model server are the same protocol and not the same
   thing.** The dev server is one process with an in-memory store, no sign-in and
   `ws://127.0.0.1:3095/sync` (`bim-devserver/src/server.ts:45`, `:297`), and
   state lost on restart unless the host saves and replays it. The model server
   verifies a sign-in **before** it leases, loads or warms a model, routes a
   client to the machine that holds the model, and keeps every edit in Postgres
   before the author is told saved.

## What a client may assume, and what it must re-check

**May assume:** a message is well formed or answered with an `error` stating
why; a changeset is one atomic revision; a retry with the same idempotency key
gets the same answer (`store.ts:20-24`, `:136-139`); a pending command is
re-sent on reconnect, so a lost answer does not lose the edit
(`client.ts:555-560`).

**Must re-check, every time:** its own prediction — the view is the confirmed
head with pending commands re-run locally (`client.ts:768-777`) and is not the
truth; the head, on any gap; its capabilities, which can change under it; the
peer's protocol features, before assuming a shape round-trips. "The server
accepted my command" is not "the model holds it": the model is what the next
changeset says.

## How it goes wrong

- **A client applying a changeset without the server's outcome.** Prediction
  plus an applied changeset is not agreement: the server may have rebased the
  command onto a later head. A client that settles on its own prediction shows a
  value nobody else has and never notices.
- **A lease treated as ownership.** A process that commits because *it* believes
  it holds the lease, without the database's check in the same statement, writes
  into a model another process now owns. The write is what must be fenced, not
  the intent to write.
- **A protocol change without `protocol-version.ts` moving.** A new field, a
  changed envelope, a message whose meaning shifted: nothing fails. The new
  server writes a shape an older page cannot read; the old page keeps what it
  cannot parse and drops the rest. **No test asserts that a protocol change
  bumps `PROTOCOL_VERSION` or adds a feature** — review-only. The mixed-version
  tests prove the *existing* features behave; they cannot see a change nobody
  registered.
- **A derived value synced instead of recomputed.** A changeset carries whole
  element records, derived fields included; a client that sends one back as a
  command's intent has made a computed total an authored value, which conflicts
  with the next legitimate recompute. Derived values come from the server's run,
  never from the wire.
- **A feature honoured for the peers present and not for one that joins
  later.** `b9-older-peer-lowered` exists because the welcome and changesets
  once sent every peer the *stored* record rather than the shape it reads.

## Where the guard is

Paths in `__tests__/` below are under `packages/bim-sync/`.

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-sync/src/protocol-version.ts` + `__tests__/x8-protocol-setup.test.ts` | a feature whose constant does not match the kernel's, or is advertised by one side only | a protocol change that adds no feature at all |
| `__tests__/r5w-protocol-mixed-version`, `b8-mixed-version`, `l11-mixed-version`, `b9-older-peer-lowered` | new page vs old server and the reverse; a gated shape never reaching a peer that does not read it, in the welcome, in later changesets and in their `before` records | a message neither side has; a gate nobody wrote |
| `__tests__/r8-key-reuse.test.ts` | a reused key answering the first change's "saved", against both the serial and the group-commit store | a retry whose digest changed because the model did |
| `__tests__/group-commit-kill.test.ts` + `support/kill-drill.ts` | killing the authority mid-batch: every client lands on the durable model, each edit applied exactly once | a crash between decide and broadcast, which `sync` covers |
| `__tests__/sessions.test.ts` | two tabs conflicting, separate agent runs, a host admitting, revoking live and halting commits, session measurement | a client that lies about its session id |
| `__tests__/authorization.test.ts`, `AUTHORIZATION.md` | the three capabilities and their refusals; copy and branch rights | the host's own sign-in |
| `__tests__/drills.test.ts` | the R1–R7 outcomes, including a read set that went stale at commit (`:152`) | a real process: the `services/bim-authority/drills/deployed.ts` its own comment names does **not exist**; that directory holds restart, group-commit and paged-boot drills |
| `__tests__/in-memory-host-snapshot.test.ts` | a snapshot replaying a log it already holds | a real Postgres restart |
