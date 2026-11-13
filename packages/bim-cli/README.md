# @permitzip/bim-cli

One command to a running editor:

```bash
npx @permitzip/bim-cli editor
```

It prints its address (`http://127.0.0.1:3999/m/<model>?view=plan`), serves the
editor and the model it edits, and stops on ctrl-c. Nothing is saved: the model
lives in memory for as long as the process does.

```bash
npx @permitzip/bim-cli editor --port 8080 --open
npx @permitzip/bim-cli editor --data-dir ./issued     # where issued PDFs go
npx @permitzip/bim-cli --help
```

Open the same address in a second window with `&name=Priya` added to edit
together.

## What it runs

The same server the open-source tree runs with `npm run demo`
([`packages/bim-devserver`](../bim-devserver)), started as a library with its
model in memory — not a second server. Two things differ, because this is a
package rather than a checkout:

- the editor page is the build this package ships (`dist/editor`, made from
  [`packages/bim-editor`](../bim-editor) by `scripts/build.mjs`), not one built
  from your sources at start-up;
- the small F-a feasibility viewer (`/feasibility`) is not part of this command,
  and answers with a sentence saying so. It needs esbuild at run time.

## Working on it

```bash
npm run build     # dist/index.js + dist/editor + dist/static; npm pack runs it too
npx jest packages/bim-cli
```

`src/args.ts` is the whole argument parser (no dependency: three options do not
need one) and `src/index.ts` starts the server. `dist/` is a build output and is
not in git: a checkout that has never run `npm run build` gets a sentence saying
exactly that, not a stack trace.
