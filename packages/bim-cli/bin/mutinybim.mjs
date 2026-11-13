#!/usr/bin/env node
/**
 * `npx @permitzip/bim-cli editor` - the thin end of the command: everything is
 * in dist/index.js, the bundle scripts/build.mjs makes.
 *
 * Exit codes: 0 for help or a clean stop, 1 when the editor could not start
 * (and the sentence is already printed), 2 for arguments it cannot act on.
 */
const { main } = await import("../dist/index.js");

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
