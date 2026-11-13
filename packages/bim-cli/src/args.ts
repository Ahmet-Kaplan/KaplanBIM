/**
 * `mutinybim`'s command line, read by hand: three options do not need an
 * argument-parsing package, and a refusal has to be a sentence a person can
 * act on (CONTRIBUTING, "a refusal is a sentence, not a code").
 *
 * Terminal text stays English: the repo's i18n rule is about the editor's
 * screens, not about what a command prints.
 */

/** The port the editor listens on when nobody names one. */
export const DEFAULT_PORT = 3999;

export type Command =
  /** Serve the editor and the model it edits. */
  | { readonly kind: "editor"; readonly port: number; readonly dataDir: string | null; readonly open: boolean }
  /** Print the usage and stop, happily. */
  | { readonly kind: "help" }
  /** Refuse, in a sentence: what was wrong, and what to do about it. */
  | { readonly kind: "refused"; readonly message: string };

const USAGE = `mutinybim - the MutinyBIM editor on your computer

Usage
  mutinybim editor [--port <n>] [--data-dir <path>] [--open]

Commands
  editor            Serve the Building Model editor and the model it edits, and print its address.

Options
  --port <n>        The port to listen on. Default ${DEFAULT_PORT}.
  --data-dir <path> Where issued PDFs and their snapshots are written. Default: mutinybim-issued in the system temp folder.
  --open            Open the address in your browser once it answers.
  --help, -h        This page.

The model itself lives in memory and stops with the editor: nothing is saved yet.
The editor page is served from the bundle this package ships; it needs no build.`;

export const usage = (): string => USAGE;

const refuse = (message: string): Command => ({ kind: "refused", message });

/** The value of an option given as `--name value` or `--name=value`; `undefined` when absent, `null` when the value is missing. */
function optionValue(argv: readonly string[], index: number, name: string): { readonly value: string | null; readonly next: number } | undefined {
  const arg = argv[index];
  if (arg === undefined) return undefined;
  if (arg === name) {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) return { value: null, next: index + 1 };
    return { value, next: index + 2 };
  }
  if (arg.startsWith(`${name}=`)) {
    const value = arg.slice(name.length + 1);
    return { value: value === "" ? null : value, next: index + 1 };
  }
  return undefined;
}

/** A port a person meant: a whole number a computer can listen on. */
function parsePort(raw: string): number | string {
  if (!/^\d+$/.test(raw)) return `--port takes a whole number between 1 and 65535, and "${raw}" is not one.`;
  const port = Number(raw);
  if (port < 1 || port > 65535) return `--port takes a whole number between 1 and 65535, and ${port} is not one.`;
  return port;
}

/**
 * Read the arguments the way a person writes them: `mutinybim editor
 * --port 3999`, `--port=3999`, `--data-dir ./issued`, `--open`, `--help`.
 * Nothing here touches the file system or starts a server.
 */
export function parseArgs(argv: readonly string[]): Command {
  if (argv.length === 0) return { kind: "help" };
  let port = DEFAULT_PORT;
  let dataDir: string | null = null;
  let open = false;
  let command: "editor" | null = null;
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index] ?? "";
    if (arg === "--help" || arg === "-h" || arg === "help") return { kind: "help" };
    if (!arg.startsWith("-")) {
      if (arg !== "editor") {
        return refuse(`I do not know the command "${arg}". The commands are: editor. Try: mutinybim editor --help`);
      }
      if (command !== null) return refuse(`You named the command "${arg}" twice. Name it once: mutinybim editor --port ${port}`);
      command = "editor";
      index += 1;
      continue;
    }
    if (arg === "--open") {
      open = true;
      index += 1;
      continue;
    }
    const portOption = optionValue(argv, index, "--port") ?? null;
    if (portOption) {
      if (portOption.value === null) return refuse("--port needs a number, like --port 3999.");
      const parsed = parsePort(portOption.value);
      if (typeof parsed === "string") return refuse(parsed);
      port = parsed;
      index = portOption.next;
      continue;
    }
    const dataOption = optionValue(argv, index, "--data-dir") ?? null;
    if (dataOption) {
      if (dataOption.value === null) return refuse("--data-dir needs a folder, like --data-dir ./issued.");
      dataDir = dataOption.value;
      index = dataOption.next;
      continue;
    }
    return refuse(`I do not know the option "${arg}". The options are --port, --data-dir, --open and --help. Try: mutinybim editor --help`);
  }
  if (command === null) return refuse("Name the command: mutinybim editor. Try: mutinybim editor --help");
  return { kind: "editor", port, dataDir, open };
}
