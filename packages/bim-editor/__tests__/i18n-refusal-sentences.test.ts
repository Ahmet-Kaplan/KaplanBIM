/**
 * The kernel's own sentences, on screen, in the language being drawn.
 *
 * A refusal arrives as `CommandError`: a code *and* a free-form English sentence
 * (`packages/bim-kernel/src/command-core.ts`). Most codes are said in the editor's
 * own words (`operatorMessage`), but six are passed through verbatim because the
 * kernel's sentence carries something the generic one cannot — which group, which
 * sheet, which revision. Those six reached the screen in English.
 *
 * `refusalWords` is the composition the session now uses at every refusal point:
 *
 *   1. the kernel's sentence, if a template can say it in Turkish
 *      (`translateProse`: numbers become `{0}` slots, the template comes from
 *      `locales/tr/prose.json`, the numbers go back in order);
 *   2. otherwise the translated sentence for the code — a Turkish sentence that
 *      says less, never an English one;
 *   3. in English, the kernel's sentence unchanged, because it is the source.
 *
 * What is proven here: every one of the six "kernel word" codes comes out Turkish
 * for a realistic sentence *and* for one no template can key; the specific sentence
 * wins when it can be translated; and no raw `{0}` or `{{…}}` ever reaches a screen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { englishOnly, withValues } from "../src/editor/i18n/translate";
import { operatorMessage, refusalWords } from "../src/editor/operator-messages";
import { translateFor } from "./helpers/editor-i18n";

const REPO_ROOT = join(__dirname, "../../..");

/** The catalogue the extractor writes: every sentence each code can carry. */
interface CatalogRow {
  readonly template: string;
  readonly codes: readonly string[];
  readonly matchable: boolean;
}
const catalogue: { readonly templates: readonly CatalogRow[] } = JSON.parse(
  readFileSync(join(REPO_ROOT, "docs/i18n/prose-templates.json"), "utf8"),
) as { readonly templates: readonly CatalogRow[] };

/** Every code the model can refuse an edit with (`CommandError['code']`). */
const CODES = [
  "element_not_found",
  "wrong_kind",
  "outside_host",
  "tap_spacing",
  "min_straight_length",
  "anchored_would_move",
  "unsupported_geometry",
  "profile_incompatible",
  "disconnected",
  "invalid_value",
  "already_exists",
  "in_use",
  "stale_base",
  "conflict",
  "forbidden",
  "has_dependents",
  "undo_refused",
  "locked",
] as const;

/**
 * A noun that names one particular screen, and the English the kernel would have to
 * use for that screen to be the subject. A generic sentence may name one only when
 * *every* sentence behind that code is about it.
 *
 * `locked`, backed by exactly one sentence — an element lock during a trace — used to
 * send the reader to `Manage › Groups & phases`; `in_use`, backed by nineteen
 * sentences about groups, phases, circuits and load points, sent them to a sheet.
 * Both were confidently wrong, which is worse than vague: the English they replaced
 * was accurate.
 */
const SCREEN_NOUNS: readonly (readonly [string, string])[] = [
  ["pafta", "sheet"],
  ["grup", "group"],
  ["faz", "phase"],
  ["devre", "circuit"],
  ["pano", "panel"],
  ["görünüm", "view"],
  ["ızgara", "grid"],
  ["bölge", "zone"],
  ["oda", "room"],
  ["mekan", "space"],
  ["kolon", "stack"],
  ["armatür", "fixture"],
  ["şalter", "breaker"],
  ["yük noktası", "load point"],
  ["kat", "level"],
  ["duvar", "wall"],
  ["tavan", "ceiling"],
];

/**
 * True when `text` names `word`.
 *
 * **Left boundary only, on purpose.** Turkish builds a word from a stem plus suffixes
 * on the *right*: `pafta` → `paftada`/`paftadan`, `grup` → `grupta`, `görünüm` →
 * `görünümü`, `faz` → `fazlar`. A right-hand boundary made this guard blind to exactly
 * the strings it exists to catch — it reported the old `in_use` sentence (“… bir
 * paftada kullanımda …”) as naming no sheet at all, so the two defects the review found
 * stayed invisible and only the English half of each self-test fired.
 *
 * The cost is over-reach in the other direction (`kat` also matches `kategori`), which
 * is the direction a guard should err: a false alarm is a sentence to rewrite, a missed
 * one is a wrong sentence on screen.
 */
function namesWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(String.raw`(?<![\p{L}])${escaped}`, "iu").test(text);
}

const TR = translateFor("tr");
const EN = translateFor("en");

/**
 * One realistic sentence per code the session shows verbatim, as the kernel composes
 * it: a name and a count in the middle of the English.
 */
const KERNEL_WORD_SENTENCES = {
  has_dependents: '2 elements are in "Level 1". Choose a group to move them to, then delete.',
  undo_refused: "You can only undo your own changes; Ada Lovelace made revision 12",
  conflict: 'Level 1 changed since your edit; undoing would overwrite that work.',
  already_exists: '"Level 1" already exists; choose a new id',
  in_use: '"Level 1" is locked. Unlock it before deleting it.',
  locked: "This element is locked so it can't slide while you trace. Unlock it first",
} as const;

test("the six codes the session shows verbatim come out Turkish", () => {
  const english = Object.entries(KERNEL_WORD_SENTENCES).filter(
    ([code, message]) => refusalWords(code as keyof typeof KERNEL_WORD_SENTENCES, message, "tr", TR) === message,
  );
  expect(english).toEqual([]);
});

test("a sentence a template can key is preferred to the generic one", () => {
  // `Revision {0} is not in the recent history…` is in the map: the person gets the
  // kernel's meaning *and* the revision number, not the shorter generic sentence.
  const shown = refusalWords("undo_refused", "Revision 12 is not in the recent history, so it can't be undone here", "tr", TR);
  expect(shown).toBe("Revizyon 12 son geçmişte yok, bu yüzden burada geri alınamaz");
  expect(shown).not.toBe(refusalWords("undo_refused", "an older kernel sentence", "tr", TR));
});

test("a sentence no template can key falls back to the translated code, never to English", () => {
  const shown = refusalWords("has_dependents", '2 elements are in "Level 1". Choose a group to move them to, then delete.', "tr", TR);
  // The generic sentence says less — and says it in Turkish, which is the point.
  expect(shown).toContain("Buna bağlı başka şeyler var");
  expect(shown).not.toContain("elements");
});

test("English is answered with the kernel's own sentence, unchanged", () => {
  const message = "Revision 12 is not in the recent history, so it can't be undone here";
  expect(refusalWords("undo_refused", message, "en", EN)).toBe(message);
});

test("no raw slot or placeholder reaches the screen", () => {
  const leaked = Object.entries(KERNEL_WORD_SENTENCES)
    .map(([code, message]) => refusalWords(code as keyof typeof KERNEL_WORD_SENTENCES, message, "tr", TR))
    .filter((shown) => /\{\{|\}\}|\{\d+\}/u.test(shown));
  expect(leaked).toEqual([]);
});

// ---------------------------------------------------------------------------
// The same defect, one layer up: the editor's own "not connected" prose
// ---------------------------------------------------------------------------

/**
 * `isn't connected`, in every form it reaches the source.
 *
 * `isn.t connected` looked like it covered them and covered none but the ASCII one:
 * `.` is *one* character and `isn&apos;t` has six between `isn` and `t`. The review
 * measured it false on the exact JSX form a revert would produce, so the whole guard
 * was decorative. Each apostrophe is spelled out and a self-test below proves it.
 */
const NOT_CONNECTED = /isn(?:'|&#39;|&apos;|\u2019)t\s+connected/iu;

/**
 * Sentences in `files` (`id` → source) that say "isn't connected" without being inside a
 * `t('session.…', '…')` call. Split out of its test so the guard can be proven to fire.
 */
function bareConnectedSentences(files: Readonly<Record<string, string>>): string[] {
  const bare: string[] = [];
  for (const [id, text] of Object.entries(files)) {
    for (const line of text.split("\n")) {
      const found = NOT_CONNECTED.exec(line);
      if (found === null) continue;
      // A comment explaining the family is not a sentence on a screen.
      if (/^\s*(?:\*|\/\*|\/\/)/u.test(line)) continue;
      // The key has to be on the same line, before the sentence: `t('session.…', "…"`
      // with any options after it (on this line or the next).
      if (/t\(\s*'session\.[A-Za-z]+',\s*"[^"]*$/u.test(line.slice(0, found.index))) continue;
      bare.push(`${id}: ${line.trim()}`);
    }
  }
  return bare;
}

const OWNED_FILES = ["packages/bim-editor/src/editor/model-session.ts", "packages/bim-editor/src/editor/BuildingModelSurface.tsx"];

/** The two files' sources, read once. */
function ownedSources(): Record<string, string> {
  return Object.fromEntries(OWNED_FILES.map((id) => [id, readFileSync(join(REPO_ROOT, id), "utf8")]));
}

test("the session and the surface say why editing is off in a translated sentence", () => {
  // These call sites hand a sentence back to a panel when there is no live session.
  // Written as a bare English literal they reached a Turkish screen as English — the
  // same complaint this file exists for, one layer above the kernel. Every one of
  // them is a `t('session.…', '…', { ns: 'editor' })` now, and this keeps it that way.
  expect(bareConnectedSentences(ownedSources())).toEqual([]);
});

test("the isn't-connected guard sees every apostrophe the source can carry", () => {
  const forms = [
    "Live editing isn't connected",
    "Live editing isn&apos;t connected",
    "Live editing isn&#39;t connected",
    "Live editing isn\u2019t connected",
  ];
  expect(forms.filter((form) => !NOT_CONNECTED.test(form))).toEqual([]);
  expect(NOT_CONNECTED.test("Live editing is connected")).toBe(false);
  expect(NOT_CONNECTED.test("Live editing is not connected")).toBe(false);
});

test("the isn't-connected guard fires on a bare JSX sentence and passes the keyed one", () => {
  // The exact shape of a revert of the read-only alert: JSX text, `&apos;`, no `t()`.
  expect(
    bareConnectedSentences({
      "surface.tsx": '                <AlertDescription>Live editing isn&apos;t connected for this project yet.</AlertDescription>',
    }),
  ).toHaveLength(1);
  expect(
    bareConnectedSentences({
      "surface.tsx": '                <AlertDescription>{t(\'session.viewOnlyBody\', "Live editing isn&apos;t connected for this project yet.", { ns: \'editor\' })}</AlertDescription>',
    }),
  ).toEqual([]);
});

test("every keyed sentence in those two files has a Turkish string, and the count is pinned", () => {
  // A site added without its Turkish, or a site quietly reverted to a bare literal,
  // has to fail here rather than in review.
  const turkish = JSON.parse(readFileSync(join(REPO_ROOT, "packages/bim-editor/locales/tr/editor.json"), "utf8")) as Record<
    string,
    Record<string, string> | string
  >;
  const files = ["packages/bim-editor/src/editor/model-session.ts", "packages/bim-editor/src/editor/BuildingModelSurface.tsx"];
  const used = new Map<string, number>();
  for (const id of files) {
    const text = readFileSync(join(REPO_ROOT, id), "utf8");
    // `t(\n  'session.…'` is a call too: the alert's sentences wrap.
    for (const match of text.matchAll(/t\(\s*'(session\.[A-Za-z]+)'/gu)) {
      const key = match[1] ?? "";
      used.set(key, (used.get(key) ?? 0) + 1);
    }
  }
  const session = (turkish.session ?? {}) as Record<string, string>;
  const missing = [...used.keys()].filter((key) => {
    const leaf = key.slice("session.".length);
    return session[leaf] === undefined || session[leaf].trim() === "";
  });
  expect(missing).toEqual([]);
  // The pinned counts: the read-only alert (`viewOnlyTitle`, `viewOnlyBody`), the two
  // "couldn't select" toasts and the rest of the family this task keyed. Changing a
  // count means changing a call site — update it deliberately.
  expect(Object.fromEntries([...used].sort())).toEqual({
    "session.boxDragCount": 1,
    "session.boxNothingInside": 1,
    "session.boxSelectedInside": 1,
    "session.boxSelectedTouching": 1,
    "session.boxTouchesNothing": 1,
    "session.changeNotSaved": 1,
    "session.inheritCancelled": 1,
    "session.inheritHint": 1,
    "session.levelNotAdded": 1,
    "session.modelNotOpen": 1,
    "session.notConnected": 7,
    "session.notConnectedDeleted": 1,
    "session.notConnectedDuct": 1,
    "session.notConnectedLevel": 1,
    "session.notConnectedMoved": 2,
    "session.notConnectedNudged": 1,
    "session.notConnectedResized": 1,
    "session.notConnectedRouted": 1,
    "session.notConnectedSaved": 5,
    "session.notConnectedSplit": 1,
    "session.notConnectedUndone": 1,
    "session.nothingToRedo": 1,
    "session.nothingToUndo": 1,
    "session.selectFailed": 1,
    "session.selectHint": 1,
    "session.viewOnlyBody": 1,
    "session.viewOnlyTitle": 1,
  });
});

// ---------------------------------------------------------------------------
// The generic sentence has to be true for every sentence it stands in for
// ---------------------------------------------------------------------------

/**
 * Everything wrong with one code's generic sentence, given the sentences it stands in
 * for. Split out of its test so the guard can be proven to fire (below): a guard that
 * never fires is worse than none.
 */
function genericSentenceDefects(
  code: string,
  generic: string,
  genericEnglish: string,
  backing: readonly { readonly template: string }[],
): string[] {
  const defects: string[] = [];
  for (const [turkish, english] of SCREEN_NOUNS) {
    const said = namesWord(generic, turkish) || namesWord(genericEnglish, english);
    if (!said) continue;
    // "Every sentence agrees" means: there is at least one, and all of them name it.
    const everySentenceSaysIt = backing.length > 0 && backing.every((row) => namesWord(row.template, english));
    if (everySentenceSaysIt) continue;
    const howMany = backing.filter((row) => namesWord(row.template, english)).length;
    defects.push(`${code}: "${generic}" names "${turkish}" but only ${howMany} of ${backing.length} of its sentences mention "${english}"`);
  }
  return defects;
}

test("no generic refusal names a screen that only some of its sentences are about", () => {
  const defects = CODES.flatMap((code) =>
    genericSentenceDefects(
      code,
      operatorMessage(code, TR),
      operatorMessage(code, EN),
      catalogue.templates.filter((row) => row.codes.includes(code)),
    ),
  );
  expect(defects).toEqual([]);
});

test("the cause-neutrality guard sees Turkish suffixes, so it can fire at all", () => {
  // Turkish attaches suffixes on the right. A boundary-strict matcher reported the old
  // `in_use` sentence as naming no sheet, which is why two rounds of review found this
  // and the guard did not.
  expect(namesWord("Bu hâlâ bir paftada kullanımda. Önce paftadan kaldırın.", "pafta")).toBe(true);
  expect(namesWord('"Level 1" is locked, so new elements can\'t go in it.', "grupta")).toBe(false);
  expect(namesWord("Kilitli bir grupta. Gruplar ve fazlar.", "grup")).toBe(true);
  expect(namesWord("Görünümünüz güncellendi.", "görünüm")).toBe(true);
  expect(namesWord("Karışık fazlar", "faz")).toBe(true);
  // Quiet where there is genuinely no such noun.
  expect(namesWord("Bu değer geçerli değil. Kontrol edip tekrar deneyin.", "pafta")).toBe(false);
  expect(namesWord("Kilitli olduğu için değiştirilemedi.", "grup")).toBe(false);
});

test("the cause-neutrality guard fires on the sentence from the Turkish side alone", () => {
  // The English says nothing about a sheet; only the Turkish half named one, which is
  // exactly the half the old matcher could not see.
  expect(
    genericSentenceDefects(
      "in_use",
      "Bu hâlâ bir paftada kullanımda. Önce paftadan kaldırın.",
      "That is still in use, so it can't be changed.",
      catalogue.templates.filter((row) => row.codes.includes("in_use")),
    ),
  ).not.toEqual([]);
});

test("the cause-neutrality guard fires on the two sentences the review found", () => {
  const backing = (code: string): readonly { template: string }[] => catalogue.templates.filter((row) => row.codes.includes(code));

  // Before this fix: `locked` sent the reader to `Manage › Groups & phases` while its
  // only sentence is an element lock during a trace.
  expect(
    genericSentenceDefects(
      "locked",
      "Bu, kilitli bir grupta. Önce Yönet › Gruplar ve fazlar bölümünden grubun kilidini açın.",
      "That is in a locked group. Unlock the group in Manage › Groups & phases first.",
      backing("locked"),
    ),
  ).not.toEqual([]);

  // And `in_use` sent them to a sheet, while all nineteen sentences are about groups,
  // phases, circuits and load points.
  expect(
    genericSentenceDefects(
      "in_use",
      "Bu hâlâ bir paftada kullanımda. Önce paftadan kaldırın.",
      "That's still placed on a sheet. Remove it from the sheet first.",
      backing("in_use"),
    ),
  ).not.toEqual([]);

  // The sentences that ship now are clean, and a noun every sentence agrees with is
  // allowed: `undo_refused` says only what all five of its sentences say.
  expect(genericSentenceDefects("locked", operatorMessage("locked", TR), operatorMessage("locked", EN), backing("locked"))).toEqual([]);
  expect(
    genericSentenceDefects("min_straight_length", "Bir parça çok kısa kalır.", "A piece would be too short.", [
      { template: "A piece would be too short" },
      { template: "A piece would be too short here" },
    ]),
  ).toEqual([]);
});

// ---------------------------------------------------------------------------
// Placeholders, under a translator that returns its English verbatim
// ---------------------------------------------------------------------------

test("no placeholder reaches the screen through englishOnly", () => {
  // `englishOnly` is the translator a host without an i18next instance hands the
  // session: it returns the English argument *including* `{{placeholders}}`. Every
  // sentence with a hole in it therefore has to be repaired by `withValues` — the
  // defect that has slipped through this project twice (a queued-edit count printed
  // as `{{n}}`).
  const sentences = [
    ["session.changeNotSaved", "Your change wasn't saved. {{reason}}", { reason: "That end is already connected" }],
    ["session.levelNotAdded", "Level 1 wasn't added: {{reason}}", { reason: "That end is already connected" }],
    ["session.boxSelectedInside", "{{count}} selected: {{mode}} the box.", { count: 3, mode: "fully inside" }],
    ["session.boxSelectedTouching", "{{count}} selected: {{mode}} the box.", { count: 1, mode: "touching" }],
    ["session.selectFailed", "Couldn't select {{label}}: live editing isn't connected.", { label: "Fan 3" }],
    ["session.selectHint", "Couldn't select {{label}}. It may have nothing drawn yet; find it in the Loads list.", { label: "Fan 3" }],
    ["session.boxDragCount", "{{count}} in the box.", { count: 2 }],
  ] as const;
  const leaked = sentences
    .map(([key, english, values]) => ({ key, shown: withValues(englishOnly(key, english), values) }))
    .filter(({ shown }) => /\{\{|\}\}/u.test(shown));
  expect(leaked).toEqual([]);
});

test("the two placeholder sentences are wrapped in withValues, not handed to a bare t()", () => {
  // `englishOnly` returns its English argument verbatim, `{{reason}}` and all, so a
  // call site that loses `withValues` leaks braces. Nothing asserted it before: reverting
  // either line stayed green.
  const source = readFileSync(join(REPO_ROOT, "packages/bim-editor/src/editor/model-session.ts"), "utf8");
  const unwrapped = ["session.changeNotSaved", "session.levelNotAdded"].filter(
    (key) => !new RegExp(String.raw`withValues\(\s*this\.t\(\s*'${key.replace(".", "\\.")}'`, "u").test(source),
  );
  expect(unwrapped).toEqual([]);
});
