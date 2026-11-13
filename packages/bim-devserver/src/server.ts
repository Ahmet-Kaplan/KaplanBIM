/**
 * `npm run demo`: the local dev server, started from the environment.
 *
 *   npm run demo                                             # http://127.0.0.1:3095 (in the open-source tree)
 *   node --import tsx packages/bim-devserver/src/server.ts   # the same, from any checkout
 *   BIM_DEV_PORT=3096 node --import tsx packages/bim-devserver/src/server.ts
 *
 * Everything it does lives in ./dev-server (a library, so a command can start
 * the same server: packages/bim-cli). This file reads the environment and
 * reports a failure as one sentence.
 */
import { startDevServer } from "./dev-server";

startDevServer().catch((err: unknown) => {
  console.error("[bim-devserver] failed to start", err instanceof Error ? err.message : err);
  process.exit(1);
});
