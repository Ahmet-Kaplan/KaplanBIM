/**
 * The "Groups & phases" surface in two languages — the half of Task 4.6 the
 * negative-space guard cannot see.
 *
 * `i18n-negative-space.test.ts` proves that no English caption in
 * `src/editor/organization` sits outside a translator (195 sites in 11 files to
 * zero). It cannot see four things this file does:
 *
 *   1. **The Turkish says the right thing.** §2.3 pins *Group* to **grup**,
 *      *Phase* to **faz**, *Phase filter* to **faz filtresi**, *Filter* to
 *      **filtre**, *Space* to **mekan** and *Area* to **alan**; §2.4 pins *Sheet*
 *      to **pafta**; §5/§7 keep *Mark* as **işaret** and the unit symbols as they
 *      are; §9/Ç20 makes the person the contract is with the **işveren**;
 *      §8 forbids a plural suffix after a number ("3 eleman", never "3
 *      elemanlar").
 *   2. **Every keyed caption actually has Turkish.** A `t('org.…')` call with no
 *      entry in `locales/tr/editor.json` shows English on a Turkish screen and no
 *      guard would say so.
 *   3. **The vocabulary tables are accessors, not tables of English.**
 *      `GROUP_VISIBILITY_LABEL`, `PHASE_DISPLAY_LABEL`, `PHASE_STATUS_LABEL`,
 *      `TAG_STYLE_KIND_LABEL`, the shape/units/leader tables, `TAG_TEXT_SIZES` and
 *      `MANAGE_PATH` were string tables; a table of strings is exactly how English
 *      shipped under a keyed frame. They take a `Translate` now, and this file
 *      draws each one in both languages.
 *   4. **The undo labels are words too.** Every `submit(command, label)` in the
 *      tree writes the toast a person reads when they undo — the guard counts
 *      those sites, and a label left as a literal would show English beside a
 *      translated screen.
 */
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";
import { editorResources } from "../src/editor/i18n/resources";
import { TAG_TEXT_SIZES } from "../src/editor/organization/TagStylesDialog";
import { groupVisibilityLabel, managePath, phaseDisplayLabel, phaseStatusLabel } from "../src/editor/organization/labels";

const TR = translateFor("tr");
const EN = translateFor("en");

/** The editor's Turkish, flattened to the dotted keys the call sites use. */
function flatten(node: unknown, prefix = ""): Record<string, string> {
  if (typeof node === "string") return { [prefix]: node };
  if (typeof node !== "object" || node === null) return {};
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>(
    (out, [key, value]) => Object.assign(out, flatten(value, prefix === "" ? key : `${prefix}.${key}`)),
    {},
  );
}

const TURKISH = flatten((editorResources.tr as Record<string, unknown> | undefined)?.editor);

/** One caption as the glossary writes it. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // §2.3: a group is a grup, a phase a faz, a phase filter a faz filtresi.
  { key: "org.fields.legend", english: "Group and phase", turkish: "Grup ve faz" },
  { key: "org.fields.group", english: "Group", turkish: "Grup" },
  { key: "org.groups.title", english: "Groups", turkish: "Gruplar" },
  { key: "org.groups.add", english: "Add group", turkish: "Grup ekle" },
  { key: "org.phases.title", english: "Phases", turkish: "Fazlar" },
  { key: "org.phases.add", english: "Add phase", turkish: "Faz ekle" },
  { key: "org.filters.title", english: "Phase filters", turkish: "Faz filtreleri" },
  { key: "org.filters.filter", english: "Filter", turkish: "Filtre" },
  { key: "org.viewPhase.phaseFilter", english: "Phase filter", turkish: "Faz filtresi" },
  // §2.3: Groups & phases is one breadcrumb, and Manage is Yönet.
  { key: "org.managePath", english: "Manage › Groups & phases", turkish: "Yönet › Gruplar ve fazlar" },
  // §2.3/§5: mark is işaret, not "işaret numarası" or "marka".
  { key: "org.typical.thisOnesMark", english: "This one’s mark", turkish: "Bunun işareti" },
  // §2.4: a sheet is a pafta, never a tablo.
  { key: "org.tagStyle.levelOnTheSheet", english: "Level on the sheet", turkish: "Paftada düz" },
  // §2.3: a space is a mekan (§2.1 forbids "öğe"; §0.1 one word per concept).
  { key: "org.tagStyle.kind.space", english: "Spaces", turkish: "Mekanlar" },
  { key: "org.tagStyle.kind.room", english: "Rooms", turkish: "Odalar" },
  { key: "org.tagStyle.kind.part", english: "Other parts", turkish: "Diğer parçalar" },
  { key: "org.tagStyle.kind.fixture", english: "Plumbing fixtures", turkish: "Sıhhi tesisat armatürleri" },
  // §5.2: halftone is yarım ton; a phase's four states are yeni / mevcut / yıkılan / geçici.
  { key: "org.visibility.halftone", english: "Halftone", turkish: "Yarım ton" },
  { key: "org.visibility.show", english: "Show", turkish: "Göster" },
  { key: "org.visibility.hide", english: "Hide", turkish: "Gizle" },
  { key: "org.phaseDisplay.dashed", english: "Dashed", turkish: "Kesikli" },
  { key: "org.phaseStatus.new", english: "New", turkish: "Yeni" },
  { key: "org.phaseStatus.existing", english: "Existing", turkish: "Mevcut" },
  { key: "org.phaseStatus.demolished", english: "Demolished", turkish: "Yıkılan" },
  { key: "org.phaseStatus.temporary", english: "Temporary", turkish: "Geçici" },
  // §0.7: a button is a singular command, a sentence a polite plural.
  { key: "org.typicalCap.save", english: "Save", turkish: "Kaydet" },
  { key: "org.groups.delete", english: "Delete group", turkish: "Grubu sil" },
  { key: "org.done", english: "Done", turkish: "Bitti" },
  { key: "org.cancel", english: "Cancel", turkish: "Vazgeç" },
  { key: "org.groups.deleteEmpty", english: "Nothing is in it. You can undo this.", turkish: "İçinde hiçbir şey yok. Bunu geri alabilirsiniz." },
  { key: "org.groups.unlockFirst", english: "Unlock it before deleting it.", turkish: "Silmeden önce kilidini açın." },
  // §9/Ç20: the party the contract is with is the işveren, never "müşteri".
  { key: "org.typicalCap.agreeOne", english: "Agree the extra one with the client, or change the number the contract covers.", turkish: "Fazla olanı işverenle kararlaştırın ya da sözleşmenin kapsadığı sayıyı değiştirin." },
  // §7: the spelled-out unit names travel, the symbols do not.
  { key: "org.tagStyle.units.inches", english: 'Inches (150")', turkish: 'İnç (150")' },
  { key: "org.tagStyle.units.metres", english: "Metres (3.81)", turkish: "Metre (3.81)" },
];

/**
 * How many call sites each shared caption has today.
 *
 * "Done" closes four dialogs, "Delete style" sits in the list header and again on
 * the editor's own button, and the three visibility words are drawn by both the
 * group list and the phase filter's pickers: a caption that went back to a
 * literal at one of them would still pass a presence check, so the count is
 * pinned. A new site means a deliberate bump here — the number must not fall
 * silently.
 */
const SITES: Readonly<Record<string, number>> = {
  "org.done": 4,
  "org.deleteNamed": 4,
  "org.keepIt": 2,
  "org.active": 2,
  "org.makeActive": 2,
  "org.tagStyle.arrowAlong": 2,
  "org.tagStyles.delete": 2,
  "org.typical.unit": 2,
  "org.undo.makeActive": 2,
  "org.undo.renameTo": 3,
  "org.undo.workIn": 2,
  "org.visibility.show": 2,
  "org.visibility.halftone": 2,
  "org.visibility.hide": 2,
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

/** The values each caption is drawn with, so a `{{placeholder}}` is filled the way a call site fills it. */
const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "org.managePath": {},
};

test("every organization caption is keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("every organization caption has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("every org key in the source has a Turkish value — no caption falls back to English", () => {
  const source = editorSourceCaptions();
  const missing = [...source.keys()].filter((key) => key.startsWith("org.")).filter((key) => TURKISH[key] === undefined || TURKISH[key] === "");
  expect(missing).toEqual([]);
});

test("a caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const [key, sites] of Object.entries(SITES)) {
    expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites });
  }
});

test("the Turkish placeholder in an organization caption matches the English one", () => {
  // `{{n}}` in the Turkish and `{{count}}` in the English would interpolate one
  // side and leak a raw `{{count}}` onto the other, which the parity guard in
  // bim-ui cannot see because it reads the written keys, not every namespace.
  const placeholders = (text: string): string[] =>
    [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  const wrong = [...source.entries()]
    .filter(([key]) => key.startsWith("org."))
    .map(([key, caption]) => ({ key, english: placeholders(caption.english), turkish: placeholders(TURKISH[key] ?? "") }))
    .filter((row) => row.english.join(",") !== row.turkish.join(","));
  expect(wrong).toEqual([]);
});

test("§8: a number is followed by a singular in Turkish — 3 eleman, never 3 elemanlar", () => {
  // The English says "1 element" and "3 elements"; the Turkish must not grow a suffix.
  const values = { ns: "editor" };
  expect(TR("org.group.elementOne", "{{n}} element", { ...values, n: 1 })).toBe("1 eleman");
  expect(TR("org.group.elementMany", "{{n}} elements", { ...values, n: 3 })).toBe("3 eleman");
  expect(TR("org.tagStyles.usedByOne", "{{n}} tag", { ...values, n: 1 })).toBe("1 etiket");
  expect(TR("org.tagStyles.usedByMany", "{{n}} tags", { ...values, n: 12 })).toBe("12 etiket");
  expect(TR("org.groups.deleteMany", "{{n}} elements are in it. They move to the group you pick. You can undo this.", { ...values, n: 3 })).toBe(
    "İçinde 3 eleman var. Seçtiğiniz gruba taşınır. Bunu geri alabilirsiniz.",
  );
});

test("the visibility and phase-status words are accessors, not tables of English", () => {
  // The same three words, twice each, in both languages — a table of strings would
  // answer English to a Turkish screen and this test would read the same string twice.
  expect(["show", "halftone", "hide"].map((v) => groupVisibilityLabel(v as "show", TR))).toEqual(["Göster", "Yarım ton", "Gizle"]);
  expect(["show", "halftone", "hide"].map((v) => groupVisibilityLabel(v as "show", EN))).toEqual(["Show", "Halftone", "Hide"]);
  // §5.2: a phase filter's fourth display is a dashed line.
  expect(["show", "halftone", "dashed", "hide"].map((d) => phaseDisplayLabel(d as "show", TR))).toEqual(["Göster", "Yarım ton", "Kesikli", "Gizle"]);
  expect(["show", "halftone", "dashed", "hide"].map((d) => phaseDisplayLabel(d as "show", EN))).toEqual(["Show", "Halftone", "Dashed", "Hide"]);
  // A phase status is a name and the one line that explains it, both translated.
  expect(phaseStatusLabel("demolished", TR)).toEqual({ label: "Yıkılan", hint: "Görünümün gösterdiği fazda kaldırıldı" });
  expect(phaseStatusLabel("demolished", EN)).toEqual({ label: "Demolished", hint: "Removed in the phase the view shows" });
  expect(phaseStatusLabel("temporary", TR).label).toBe("Geçici");
  // English first, so a host without a language reads exactly what it read before.
  expect(["new", "existing", "demolished", "temporary"].map((s) => phaseStatusLabel(s as "new", EN).label)).toEqual([
    "New",
    "Existing",
    "Demolished",
    "Temporary",
  ]);
});

test("the breadcrumb a tooltip quotes is translated with the words around it", () => {
  // The status bar's group tooltip interpolates it as `{{path}}`: an English
  // "Manage › Groups & phases" inside a Turkish sentence is the defect §0.1 names.
  expect(managePath(TR)).toBe("Yönet › Gruplar ve fazlar");
  expect(managePath(EN)).toBe("Manage › Groups & phases");
  expect(TR("org.lockedOne", '"{{name}}" is locked. Unlock it in {{path}} to change it.', { ns: "editor", name: "General", path: managePath(TR) })).toBe(
    '"General" kilitli. Değiştirmek için Yönet › Gruplar ve fazlar bölümünde kilidini açın.',
  );
});

test("the tag text sizes keep their fractions and translate only the word beside them (§7)", () => {
  // The heights are fractions of an inch: unit symbols and figures do not travel.
  expect(TAG_TEXT_SIZES.map((size) => size.label(TR))).toEqual(['1/16" (küçük)', '3/32" (standart)', '1/8"', '3/16" (büyük)']);
  expect(TAG_TEXT_SIZES.map((size) => size.label(EN))).toEqual(['1/16" (small)', '3/32" (standard)', '1/8"', '3/16" (large)']);
  expect(TAG_TEXT_SIZES.map((size) => size.mm)).toEqual([1.6, 2.4, 3.2, 4.8]);
});

test("the sentence a person reads before they undo is translated too", () => {
  // These are the `submit(command, label)` words the toast shows. One element and
  // many, each said in full — "restore these 3" is not "restore 3 elemanları".
  const values = { ns: "editor" };
  expect(TR("org.undo.restoreOne", "restore it", values)).toBe("yıkımı geri al");
  expect(TR("org.undo.restoreMany", "restore these {{n}}", { ...values, n: 3 })).toBe("bu 3 elemanın yıkımını geri al");
  expect(TR("org.undo.demolishOne", "demolish it", values)).toBe("yık");
  expect(TR("org.undo.moveOneTo", "move it to {{name}}", { ...values, name: "New work" })).toBe("New work grubuna taşı");
  expect(TR("org.undo.renameTo", "rename {{from}} to {{to}}", { ...values, from: "General", to: "Misc" })).toBe("General adını Misc yap");
  expect(TR("org.undo.showByDefault", "show {{name}} as {{visibility}} by default", { ...values, name: "New work", visibility: groupVisibilityLabel("halftone", TR).toLowerCase() })).toBe(
    "New work varsayılan olarak yarım ton görünsün",
  );
  // The English is unchanged, character for character.
  expect(EN("org.undo.restoreOne", "restore it", values)).toBe("restore it");
  expect(EN("org.undo.restoreMany", "restore these {{n}}", { ...values, n: 3 })).toBe("restore these 3");
});

test("a caption drawn with a placeholder fills it in both languages", () => {
  for (const caption of CAPTIONS) {
    const values = VALUES[caption.key];
    if (values === undefined) continue;
    expect({ key: caption.key, text: TR(caption.key, caption.english, { ...values, ns: "editor" }) }).toEqual({
      key: caption.key,
      text: fill(caption.turkish, values),
    });
  }
  // The count in a summary is a placeholder, never a bare word.
  expect(TR("org.typical.summaryHead", "{{n}} {{label}}s: {{mark}} and {{copies}} copies, {{cols}} across", { ns: "editor", n: 4, label: "ünite", mark: "001", copies: 3, cols: 2 })).toBe(
    "4 ünite: 001 ve 3 kopya, yan yana 2",
  );
});
