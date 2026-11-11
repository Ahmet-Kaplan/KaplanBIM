/**
 * The theme rule, enforced.
 *
 * AGENTS.md: *every colour, font and radius comes from a `--mutiny-*` variable*.
 * No hex in a stylesheet, no hex in a component, no inline style colour, no
 * one-off palette. This guard is what makes that binding rather than a habit:
 * a hex added anywhere a screen is drawn fails the build, naming the file and
 * line, and the only place hex may live is the theme's source of truth
 * (`packages/bim-ui/src/theme.ts` and `color-scheme.ts`), where the variables
 * themselves are defined.
 *
 * Two other things it checks, because a token nobody defines is the same defect
 * wearing a variable's name:
 *
 *   - every `--mutiny-*` a package reads exists in **both** themes, so a
 *     stylesheet cannot look right in light and transparent in dark (this is the
 *     honest half of the "check light and dark" rule: a browser cannot be opened
 *     here, but every variable can be resolved);
 *   - a colour set through `style={{ … }}` is a variable, not a literal.
 *
 * **What it does not police, and why.** Some hex is *content*, not styling, and a
 * theme cannot own it: a discipline's colour and a system's graphic colour are
 * stored in the model, a person's presence colour is theirs, paper output stays
 * black on white (spec §7/Ç-G), and the 3D viewer needs parseable hex for WebGL
 * (`HexColor` in `theme.ts` says so). Those modules are listed below with their
 * reason; each list entry is checked to still exist and still carry hex, so an
 * exemption cannot quietly outlive the file it excused.
 */
import fs from "node:fs";
import path from "node:path";
import { mutinyDarkTheme } from "../src/color-scheme";
import { mutinyDefaultTheme, themeToCssVars } from "../src/theme";

const REPO_ROOT = path.resolve(__dirname, "../../..");

/** Where a screen is drawn: every package's and app's `src`. */
const SOURCE_ROOTS = ["packages", "apps"] as const;

/** The files hex is allowed to live in: the theme's own definition. */
const THEME_SOURCE = [
  "packages/bim-ui/src/theme.ts",
  "packages/bim-ui/src/color-scheme.ts",
] as const;

interface Exemption {
  /** Repo-relative path, exact. */
  readonly file: string;
  readonly reason: string;
}

/**
 * Hex that is content rather than styling. Every entry names the mechanism that
 * makes it content; none of them is "the colour was hard to reach".
 */
const DATA_EXEMPTIONS: readonly Exemption[] = [
  { file: "packages/bim-kernel/src/disciplines/types.ts", reason: "a discipline's colour is model data the registry stores and drawings print" },
  { file: "packages/bim-kernel/src/services/builtin.ts", reason: "a service's graphic colour is model data (`graphics.colour`)" },
  { file: "packages/bim-kernel/src/organization/model.ts", reason: "the element graphic colours a model carries" },
  { file: "packages/bim-kernel/src/organization/commands.ts", reason: "the default colour a new element is given, stored in the model" },
  { file: "packages/bim-kernel/src/routing/system-graphics.ts", reason: "a routed system's graphic colour, stored in the model" },
  { file: "packages/bim-kernel/src/drawing/svg.ts", reason: "drawing output: paper stays black on white (spec §7/Ç-G)" },
  { file: "packages/bim-kernel/src/drawing/title-block-definition.ts", reason: "title block graphics, printed on paper" },
  { file: "packages/bim-kernel/src/annotation/rich-text.ts", reason: "the rich-text colour an annotation stores, printed on paper" },
  { file: "packages/bim-kernel/src/part-model/preview.ts", reason: "a part's preview graphics, drawn on the sheet" },
  { file: "packages/bim-kernel/src/diagrams/graph.ts", reason: "diagram drawing colours, printed on paper" },
  { file: "packages/bim-kernel/src/diagrams/riser-layout.ts", reason: "diagram drawing colours, printed on paper" },
  { file: "packages/bim-first-party/src/fire-protection.ts", reason: "first-party disciplines' and systems' colours: model data" },
  { file: "packages/bim-pack-civil/src/classes.ts", reason: "a civil class's graphic colour, stored in the model" },
  { file: "packages/bim-pack-electrical/src/disciplines.ts", reason: "a discipline's colour: model data" },
  { file: "packages/bim-pack-mechanical/src/disciplines.ts", reason: "a discipline's colour: model data" },
  { file: "packages/bim-pack-plumbing/src/disciplines.ts", reason: "a discipline's colour: model data" },
  { file: "packages/bim-pack-electrical/src/services/rows.ts", reason: "electrical systems' graphic colours: model data" },
  { file: "packages/bim-pack-electrical/src/catalog/feeder-types.ts", reason: "a feeder type's stored colour" },
  { file: "packages/bim-pack-electrical/src/fields/electrical-resolver.ts", reason: "a computed field's stored colour" },
  { file: "packages/bim-pack-electrical/src/diagrams/one-line-layout.ts", reason: "one-line drawing colours, printed on paper" },
  { file: "packages/bim-pack-mechanical/src/services/rows.ts", reason: "mechanical systems' graphic colours: model data" },
  { file: "packages/bim-pack-plumbing/src/services.ts", reason: "plumbing systems' graphic colours: model data" },
  { file: "packages/bim-library/src/builtin/title-blocks.ts", reason: "built-in title block graphics, printed on paper" },
  { file: "packages/bim-sync/src/schedules/protocol.ts", reason: "a person's presence colour: theirs, not the screen's" },
  { file: "packages/bim-viewer/src/schedules-demo.ts", reason: "the demo's presence colours, the same protocol" },
  { file: "packages/bim-viewer-3d/src/viewer-colors.ts", reason: "WebGL needs parseable hex; the theme's `HexColor` slots feed it" },
  { file: "packages/bim-viewer-3d/src/viewer.ts", reason: "WebGL clear colours, same reason" },
  { file: "packages/bim-mcp-packs/src/support/render-image.ts", reason: "an image an agent is shown, not a screen (spec §7/Ç-G)" },
  { file: "packages/bim-plugin/src/skill-files.ts", reason: "a skill file's text, content not styling" },
];

/** Every `.css`, `.tsx` and `.ts` under every `src` a screen is drawn from. */
function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (/\.(css|tsx|ts)$/u.test(entry.name)) {
        files.push(path.relative(REPO_ROOT, full).split(path.sep).join("/"));
      }
    }
  };
  for (const container of SOURCE_ROOTS) {
    const root = path.join(REPO_ROOT, container);
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = path.join(root, entry.name, "src");
      if (fs.existsSync(src)) walk(src);
    }
  }
  return files.sort();
}

const FILES = sourceFiles();
const EXEMPT = new Set<string>([...THEME_SOURCE, ...DATA_EXEMPTIONS.map((entry) => entry.file)]);
const POLICED = FILES.filter((file) => !EXEMPT.has(file));

/**
 * `&nbsp;`-style character references are text, and `url(#…)` is an SVG reference,
 * not a colour. Built fresh per scan: a `/g` regex carries a `lastIndex` between
 * calls, and a stateful guard would miss the second offence on a line.
 */
const hexPattern = (): RegExp => /(?<!&)#[0-9a-f]{3,8}\b/giu;

interface Offence {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** Every hex colour literal in one file, as `file:line` for the failure list. */
function hexesIn(file: string): Offence[] {
  const offences: Offence[] = [];
  const source = fs.readFileSync(path.join(REPO_ROOT, file), "utf8");
  source.split("\n").forEach((text, index) => {
    // A `url(#id)` reference names an element; `abc` in it is not a colour.
    const withoutReferences = text.replace(/url\(#[^)]*\)/gu, "url()");
    for (const match of withoutReferences.matchAll(hexPattern())) {
      offences.push({ file, line: index + 1, text: `${file}:${index + 1}: ${match[0]}` });
    }
  });
  return offences;
}

/** The colour-ish properties a React `style` object may not set to a literal. */
const INLINE_COLOUR = /\b(?:color|background|backgroundColor|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|outlineColor|fill|stroke|stopColor|caretColor|textDecorationColor|boxShadow)\s*:\s*([^,\n}]+)/gu;

/** Every `style={{ … }}` that sets a colour to something that is not a variable. */
function inlineColourOffences(file: string): Offence[] {
  const offences: Offence[] = [];
  const source = fs.readFileSync(path.join(REPO_ROOT, file), "utf8");
  source.split("\n").forEach((text, index) => {
    if (!/\bstyle=\{\{/u.test(text)) return;
    for (const match of text.matchAll(INLINE_COLOUR)) {
      const value = match[1] ?? "";
      if (/var\(--mutiny-/u.test(value)) continue;
      if (!/(?:#|rgba?\(|hsla?\()/iu.test(value)) continue;
      offences.push({ file, line: index + 1, text: `${file}:${index + 1}: style sets ${match[0].trim()}` });
    }
  });
  return offences;
}

/**
 * Every `--mutiny-*` name a package *reads*: `var(--mutiny-x)`, its
 * `var(--mutiny-x, fallback)` form, and Tailwind's `text-(--mutiny-x)` arbitrary
 * value. A name in a comment or a doc string is not a read, so the scan is shaped
 * like a use — otherwise prose about the theme would fail the theme's own guard.
 */
const VARIABLE_READS: readonly RegExp[] = [/var\(\s*--mutiny-([a-z0-9-]+)/gu, /\(--mutiny-([a-z0-9-]+)\)/gu];

function usedVariables(): Map<string, string> {
  const used = new Map<string, string>();
  for (const file of POLICED) {
    const source = fs.readFileSync(path.join(REPO_ROOT, file), "utf8");
    for (const pattern of VARIABLE_READS) {
      for (const match of source.matchAll(pattern)) {
        const name = `--mutiny-${match[1] ?? ""}`;
        if (!used.has(name)) used.set(name, file);
      }
    }
  }
  return used;
}

// ---------------------------------------------------------------------------
// The guards
// ---------------------------------------------------------------------------

test("the guard found the files it is meant to guard", () => {
  // Without this, a renamed directory would leave every rule below scanning
  // nothing and reporting green.
  expect(FILES.length).toBeGreaterThan(200);
  expect(POLICED).toContain("packages/bim-viewer/src/viewer.css");
  expect(POLICED).toContain("packages/bim-schedules-ui/src/schedules.css");
  expect(POLICED).toContain("packages/bim-grid/src/grid.css");
  expect(POLICED).toContain("apps/mutinybim-web/src/app.ts");
  // And the theme's own source is out, or the rule would forbid the variables.
  expect(POLICED).not.toContain("packages/bim-ui/src/theme.ts");
  expect(POLICED).not.toContain("packages/bim-ui/src/color-scheme.ts");
});

test("no hex colours outside the theme source of truth", () => {
  const offences = POLICED.flatMap(hexesIn).map((offence) => offence.text);
  expect(offences).toEqual([]);
});

test("no inline style colours, only theme variables", () => {
  const offences = POLICED.filter((file) => file.endsWith(".tsx")).flatMap(inlineColourOffences).map((offence) => offence.text);
  expect(offences).toEqual([]);
});

test("every --mutiny-* a package reads is defined in both themes", () => {
  const light = new Set(Object.keys(themeToCssVars(mutinyDefaultTheme)));
  const dark = new Set(Object.keys(themeToCssVars(mutinyDarkTheme)));
  const undefinedNames = [...usedVariables()]
    .filter(([name]) => !light.has(name) || !dark.has(name))
    .map(([name, file]) => `${file} reads ${name}, which ${light.has(name) ? "the dark theme" : "no theme"} does not define`);
  expect(undefinedNames).toEqual([]);
});

// ---------------------------------------------------------------------------
// Proof the guards bite
// ---------------------------------------------------------------------------

test("the exemptions are real files that still carry the content they are excused for", () => {
  const stale = DATA_EXEMPTIONS.filter((entry) => !fs.existsSync(path.join(REPO_ROOT, entry.file))).map((entry) => `${entry.file} is gone; drop its exemption`);
  expect(stale).toEqual([]);
  // An exemption for a file that no longer has hex should be deleted, not kept:
  // the next reader would think the rule was measured and satisfied.
  const pointless = DATA_EXEMPTIONS.filter((entry) => !hexPattern().test(fs.readFileSync(path.join(REPO_ROOT, entry.file), "utf8"))).map((entry) => `${entry.file} has no hex; drop its exemption ("${entry.reason}")`);
  expect(pointless).toEqual([]);
  expect(new Set(DATA_EXEMPTIONS.map((entry) => entry.file)).size).toBe(DATA_EXEMPTIONS.length);
});

test("the guard catches the colour it exists for, and only that", () => {
  // A guard that never fires is worse than no guard. These are the shapes it must
  // reject — the in-process half of the proof; the other half is a planted file
  // in a scratch copy, reported with the task.
  const flags = (line: string): boolean => [...line.replace(/url\(#[^)]*\)/gu, "url()").matchAll(hexPattern())].length > 0;

  expect(flags("  color: #f2611d;")).toBe(true);
  expect(flags("  color: #fff;")).toBe(true);
  expect(flags("  background: var(--mutiny-panel, #f2f3f4);")).toBe(true); // a hex fallback is a hex
  expect(flags("const C = { stop: '#7c3aed' }")).toBe(true);
  expect(flags("  fill: #dbeafe;")).toBe(true);

  expect(flags("  color: var(--mutiny-text);")).toBe(false);
  expect(flags("  --brand: var(--mutiny-accent);")).toBe(false);
  expect(flags("<p>&#215; 3</p>")).toBe(false); // a character reference is text
  expect(flags("  filter: url(#drop-shadow);")).toBe(false); // an element reference
  expect(flags("  color: var(--mutiny-muted, currentColor);")).toBe(false);

  // The inline-style rule: a literal fails, a variable passes, a non-colour
  // property is none of its business.
  const inline = (line: string): boolean => [...line.matchAll(INLINE_COLOUR)].some((match) => !/var\(--mutiny-/u.test(match[1] ?? "") && /(?:#|rgba?\(|hsla?\()/iu.test(match[1] ?? ""));
  expect(inline("      <tr style={{ color: '#5d6670' }}>")).toBe(true);
  expect(inline("      <tr style={{ backgroundColor: 'rgba(0,0,0,.2)' }}>")).toBe(true);
  expect(inline("      <table style={{ borderColor: '#dde1e4' }}>")).toBe(true);
  expect(inline("      <tr style={{ color: 'var(--mutiny-muted)' }}>")).toBe(false);
  expect(inline("      <tr style={{ width: 12, height: 3 }}>")).toBe(false);
  expect(inline("      <tr className=\"text-(--mutiny-muted)\">")).toBe(false);
});
