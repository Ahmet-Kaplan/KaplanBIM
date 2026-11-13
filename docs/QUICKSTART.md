# Quick start

MutinyBIM is a building model you edit in a browser. There are three ways in;
pick the first one that fits, and see [README](../README.md) for what the model
does once it is open.

## 1. One command, nothing else installed

```bash
npx @permitzip/bim-cli editor
```

Open the address it prints (`http://127.0.0.1:3999/m/<model>?view=plan`); add
`&name=Priya` in a second window to edit together. The editor page is the build
the package ships, the model is in memory, and everything stops with ctrl-c.
`--port <n>`, `--data-dir <path>` and `--open` are in `--help`.

This is the way for a person in a firm's IT department: no checkout, no Docker,
no database.

## 2. The open-source tree

```bash
npm install
npm run demo
```

Open <http://127.0.0.1:3095>. The first start builds the editor from your
checkout (a second or two on a warm machine, longer on a cold one); later starts
reuse that build. Same in-memory model as above, plus the small F-a feasibility
viewer at `/feasibility`.

## 3. The full stack, with a real model server

```bash
docker compose up --build
```

Open <http://localhost:3095/m/demo?view=plan>. This time the editor talks to the
real model server, which keeps every edit in Postgres: stop the stack, start it
again, and the model is still there. The people who can sign in are You, Avery,
Priya and Sam (a local sign-in for one computer; never expose it).
`docker compose down -v` deletes the model.

## Checking that it works

```bash
npm test            # unit tests
npm run typecheck   # TypeScript across the packages
npm run lint        # ESLint, including the boundary and license rules
```

The published CLI is packed and proved from a clean folder before it goes out:
`npm pack` in `packages/bim-cli`, then `npx ./permitzip-bim-cli-*.tgz editor`
somewhere with no `node_modules`.
